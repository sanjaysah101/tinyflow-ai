import { generateObject } from "ai";
import { z } from "zod";
import { openrouter, MODELS } from "@/lib/openrouter";
import { retrievePatterns, formatPatternsAsContext } from "@/lib/rag";

// ─── Schemas ────────────────────────────────────────────────

const IssueSchema = z.object({
  line: z.number().optional().describe("Line number where the issue occurs (if determinable)"),
  title: z.string().describe("Short, specific title of the issue"),
  description: z.string().describe("Clear explanation of the problem and why it matters"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  fix: z.string().describe("Concrete fix suggestion or corrected code snippet"),
});

export const SpecialistOutputSchema = z.object({
  category: z.enum(["security", "bugs", "performance", "style"]),
  issues: z.array(IssueSchema).describe("List of issues found. Empty array if none found."),
  safe: z.boolean().describe("True only if zero issues were found"),
  summary: z.string().describe("One-sentence summary of findings for this category"),
});

export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;
export type Issue = z.infer<typeof IssueSchema>;

// ─── Pre-screening: static pattern detection ─────────────────
// These are regex-based checks that run BEFORE the AI model.
// They guarantee obvious issues are ALWAYS caught regardless of
// how confused the tiny model gets.

interface StaticIssue {
  pattern: RegExp;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  fix: string;
  category: "security" | "bugs" | "performance" | "style";
}

const STATIC_CHECKS: StaticIssue[] = [
  // ── Security ──
  {
    pattern: /["'`]\s*SELECT[\s\S]*?WHERE[\s\S]*?\+\s*\w|`SELECT[\s\S]*?\$\{/i,
    title: "SQL Injection via String Concatenation",
    description: "User input is directly concatenated into a SQL query string. An attacker can break out of the query and execute arbitrary SQL.",
    severity: "critical",
    fix: "Use parameterized queries: db.query('SELECT * FROM users WHERE id = $1', [userId])",
    category: "security",
  },
  {
    pattern: /query\s*=\s*[`"'].*?\$\{|query\s*=\s*["'].*?\+\s*req|query\s*\+=.*?req|"SELECT.*?".*?\+|`SELECT[\s\S]*?\$\{[\s\S]*?req/i,
    title: "SQL Injection - Dynamic Query with Request Data",
    description: "Request parameters (req.body, req.params, req.query) are interpolated directly into a SQL string.",
    severity: "critical",
    fix: "Replace with parameterized queries. Never put request data inside a SQL string.",
    category: "security",
  },
  {
    pattern: /\.innerHTML\s*=\s*(?!['"`]<)/,
    title: "Cross-Site Scripting (XSS) via innerHTML",
    description: "Unsanitized data is written to innerHTML. An attacker can inject <script> tags or event handlers.",
    severity: "critical",
    fix: "Use .textContent instead of .innerHTML, or sanitize with DOMPurify.sanitize().",
    category: "security",
  },
  {
    pattern: /(?:API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*["'`][A-Za-z0-9\-_]{6,}["'`]/i,
    title: "Hardcoded Secret / Credential",
    description: "A secret, API key, or password is hardcoded in source code. It will be exposed in version control and to anyone with code access.",
    severity: "critical",
    fix: "Move to environment variables: process.env.API_KEY and add the real value to .env (gitignored).",
    category: "security",
  },
  {
    pattern: /exec\s*\(\s*[`"'].*?\$\{|exec\s*\(\s*["'].*?\+\s*(?:req|user|input)/i,
    title: "Command Injection",
    description: "User-controlled data is interpolated into a shell exec() call. An attacker can append arbitrary shell commands.",
    severity: "critical",
    fix: "Never pass user input to exec(). Use a safe API or sanitize and allowlist inputs strictly.",
    category: "security",
  },
  {
    pattern: /eval\s*\((?!['"`][^'"`)]*['"`]\))/,
    title: "Dangerous eval() Usage",
    description: "eval() executes arbitrary strings as code. If any user input reaches it, this is remote code execution.",
    severity: "critical",
    fix: "Remove eval(). Use JSON.parse() for data, or restructure the logic.",
    category: "security",
  },
  {
    pattern: /res\.send\s*\(\s*err\b|res\.json\s*\(\s*err\b|res\.send\s*\(\s*error\b/,
    title: "Raw Error Object Sent to Client",
    description: "Internal error details (stack traces, DB errors) are sent directly to the HTTP response. This leaks system internals to attackers.",
    severity: "high",
    fix: "Log the error server-side and send a generic message: res.status(500).send({ message: 'Internal server error' })",
    category: "security",
  },
  // ── Bugs ──
  {
    pattern: /async\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{(?![^}]*try)[^}]*await/,
    title: "Async Function Without Error Handling",
    description: "An async function uses await but has no try/catch. Any rejected promise will cause an unhandled rejection, crashing the process or silently failing.",
    severity: "high",
    fix: "Wrap await calls in try/catch, or add .catch() to the Promise chain.",
    category: "bugs",
  },
  {
    pattern: /const\s+\w+\s*=\s*db\.(?:query|find|findOne|execute)\s*\([^)]*\)\s*;\s*(?!\s*await|\s*\.then)/,
    title: "Missing await on Async Database Call",
    description: "A database call that returns a Promise is not being awaited. The variable will hold a Promise object, not the actual data - causing .rows, .data, etc. to be undefined.",
    severity: "critical",
    fix: "Add await before the database call: const result = await db.query(...)",
    category: "bugs",
  },
  {
    pattern: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<=\s*\w+\.length\s*;/,
    title: "Off-by-One Error: Loop Uses <= length",
    description: "The loop condition uses <= array.length instead of < array.length. The last iteration will access an out-of-bounds index, resulting in undefined.",
    severity: "high",
    fix: "Change <= to <: for (let i = 0; i < arr.length; i++)",
    category: "bugs",
  },
  // ── Performance ──
  {
    pattern: /for\s*\([^)]+\)[^{]*\{[^}]*for\s*\([^)]+\)/,
    title: "O(n^2) Nested Loop",
    description: "A loop inside another loop on the same collection. For n=1000 users this runs 1,000,000 iterations instead of 1,000.",
    severity: "high",
    fix: "Use a Set or Map for O(n) lookups, or use a database query with a WHERE clause instead.",
    category: "performance",
  },
  {
    pattern: /(?:readFileSync|execSync|writeFileSync|existsSync)\s*\(/,
    title: "Synchronous / Blocking File System Operation",
    description: "Synchronous fs operations block Node.js's event loop. While this runs, no other requests can be handled - causing severe latency spikes under load.",
    severity: "high",
    fix: "Use the async equivalent: await fs.promises.readFile(...) or await fs.promises.writeFile(...)",
    category: "performance",
  },
  {
    pattern: /SELECT\s+\*\s+FROM\s+\w+(?!\s+WHERE)/i,
    title: "SELECT * Without WHERE Clause",
    description: "Fetching all rows from a table on every request. With large tables this transfers massive amounts of data and uses unnecessary memory.",
    severity: "high",
    fix: "Add a WHERE clause, pagination (LIMIT/OFFSET), or select only the columns you need.",
    category: "performance",
  },
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*(?:await|\.then\s*\()/,
    title: "Sequential Awaits Inside Loop",
    description: "An async call (await or .then) is made inside a loop. Each iteration waits for the previous one, causing N sequential operations instead of 1 batched call.",
    severity: "high",
    fix: "Collect all inputs first, then use Promise.all() for parallel execution, or batch with a single query.",
    category: "performance",
  },
];

/**
 * Run regex-based pre-screening checks on the code.
 * These always fire and do NOT depend on the AI model.
 */
function runStaticChecks(code: string, category: "security" | "bugs" | "performance" | "style"): Issue[] {
  const lines = code.split("\n");

  return STATIC_CHECKS.filter((check) => check.category === category)
    .filter((check) => check.pattern.test(code))
    .map((check) => {
      // Try to find the line number
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (check.pattern.test(lines[i])) {
          lineNum = i + 1;
          break;
        }
      }
      return {
        line: lineNum,
        title: check.title,
        description: check.description,
        severity: check.severity,
        fix: check.fix,
      };
    });
}

// ─── Category-specific AI checklists ─────────────────────────
// Each is a CONCRETE yes/no checklist tailored for a tiny model.
// We give the model examples of what the issue LOOKS LIKE,
// so it only needs to recognize patterns - not reason from first principles.

const CATEGORY_CHECKLISTS: Record<string, string> = {
  security: `
CHECK EACH OF THE FOLLOWING - report anything you find:

1. SQL INJECTION: Does any SQL query string contain variables interpolated via \${} or + concatenation?
   BAD: \`SELECT * FROM users WHERE id = \${req.params.id}\`
   BAD: "SELECT * FROM users WHERE id = " + userId
   GOOD: db.query('SELECT * FROM users WHERE id = $1', [userId])

2. XSS: Is user input assigned to .innerHTML, document.write(), or .outerHTML?
   BAD: element.innerHTML = req.body.comment

3. HARDCODED SECRETS: Do you see API keys, passwords, or tokens assigned as string literals?
   BAD: const API_KEY = "sk-1234-secret"
   BAD: const PASSWORD = "admin123"

4. MISSING AUTH: Are database queries run without checking if the user is authorized?
   BAD: db.query("SELECT * FROM users WHERE id=" + req.params.id) - no ownership check

5. ERROR LEAKING: Are raw error objects sent to the client?
   BAD: res.send(err) - leaks stack trace and internal details

6. COMMAND INJECTION: Is user input passed to exec(), spawn(), or eval()?
`,

  bugs: `
CHECK EACH OF THE FOLLOWING - report anything you find:

1. MISSING AWAIT: Is a Promise-returning function called WITHOUT await?
   BAD: const user = db.query("SELECT...")  <- missing await
   GOOD: const user = await db.query("SELECT...")

2. OFF-BY-ONE: Does any loop use i <= array.length instead of i < array.length?
   BAD: for (let i = 0; i <= arr.length; i++)  <- accesses arr[arr.length] = undefined

3. UNHANDLED ASYNC ERRORS: Does an async function use await without a try/catch?
   BAD: async function load() { const data = await fetch(...); return data.json(); }

4. NULL/UNDEFINED ACCESS: Is a property accessed on a value that could be null/undefined?
   BAD: res.send(user.rows[0]) - if query returns 0 rows, user.rows[0] is undefined

5. MISSING ERROR HANDLER: Are catch blocks empty or missing?
   BAD: catch(err) {} - silently swallowing errors
`,

  performance: `
CHECK EACH OF THE FOLLOWING - report anything you find:

1. NESTED LOOPS ON SAME DATA: Is there a loop inside a loop iterating over the same collection?
   BAD: for users { for users { if match... } } - this is O(n^2)

2. SYNCHRONOUS I/O: Is readFileSync, writeFileSync, or execSync used in a server request handler?
   BAD: fs.readFileSync('data.txt') - blocks all requests while reading

3. SELECT * WITHOUT LIMIT: Is "SELECT *" used without a WHERE clause on a large table?
   BAD: db.query("SELECT * FROM users") - fetches all rows, unbounded

4. AWAIT IN A LOOP: Is an await call made inside a for/while loop?
   BAD: for (const id of ids) { const data = await db.query(...); }
   GOOD: await Promise.all(ids.map(id => db.query(...)))

5. BLOCKING COMPUTE IN REQUEST: Is a CPU-intensive loop (like counting to 1e9) done synchronously?
   BAD: for (let i = 0; i < 1e9; i++) { sum += i; } - blocks event loop
`,

  style: `
CHECK EACH OF THE FOLLOWING - report anything you find:

1. MAGIC NUMBERS: Are unexplained numeric literals used? (Exception: 0, 1, -1 are okay)
   BAD: if (status === 403) - what does 403 mean here? Use a named constant.

2. DEAD CODE: Are there commented-out code blocks or unreachable return statements?

3. MISSING ERROR HANDLING IN CATCH: Does a catch block do nothing or just console.log without re-throwing?
   BAD: catch(err) { console.log(err); }  - error is swallowed silently

4. OVERLY LONG FUNCTION: Does any function exceed ~40 lines?

5. INCONSISTENT ERROR RESPONSE FORMAT: Are errors sent with different formats?
   BAD: res.send({ message: "ok" }) vs res.send(err) - inconsistent
`,
};

// ─── Specialist Function ─────────────────────────────────────

/**
 * Step 3: Run a specialist analysis for ONE category.
 * Strategy: static pre-screening catches obvious issues deterministically,
 * then the AI model looks for anything the static checks missed.
 * The AI gets a concrete checklist, NOT an open-ended "find issues" prompt.
 */
export async function runSpecialist(
  code: string,
  category: "security" | "bugs" | "performance" | "style",
  language: string,
): Promise<SpecialistOutput> {
  // ── Step A: Static pre-screening (always runs, never fails) ──
  const staticIssues = runStaticChecks(code, category);

  // ── Step B: RAG context retrieval ──
  let ragContext = "";
  try {
    const patterns = await retrievePatterns(code, category, language);
    ragContext = formatPatternsAsContext(patterns);
  } catch {
    ragContext = "";
  }

  // ── Step C: AI checklist analysis ──
  const checklist = CATEGORY_CHECKLISTS[category] ?? "";

  const prompt = `You are a strict code reviewer. Your job: find ${category} problems in this code.
Do not say the code is safe if there is ANY problem. Err on the side of reporting.

${ragContext ? `## Retrieved vulnerability patterns:\n${ragContext}\n` : ""}

## ${category.toUpperCase()} CHECKLIST - go through each item:
${checklist}

## Code under review:
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Find EVERY violation of the checklist above. 
If you see SQL concatenation - report it. If you see hardcoded secrets - report them.
If you see nested loops on the same data - report it.
Do NOT say something is safe unless you carefully checked EVERY item and found nothing.

Return JSON with ALL issues you found. Set safe=false if ANY issue exists.`;

  let aiIssues: Issue[] = [];

  try {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 2) {
      try {
        const { object } = await generateObject({
          model: openrouter(MODELS.specialist),
          schema: SpecialistOutputSchema,
          prompt:
            attempts === 0
              ? prompt
              : `${prompt}\n\nNOTE: Your previous attempt returned invalid JSON. Error: ${lastError?.message}. Return only valid JSON.`,
          maxOutputTokens: 800,
        });

        aiIssues = object.issues;
        break;
      } catch (err) {
        lastError = err as Error;
        attempts++;
      }
    }
  } catch {
    // AI model failed - static issues still get reported
  }

  // ── Merge: deduplicate static + AI issues by title ──
  const allTitles = new Set(staticIssues.map((i) => i.title));
  const dedupedAiIssues = aiIssues.filter((i) => !allTitles.has(i.title));
  const mergedIssues = [...staticIssues, ...dedupedAiIssues];

  const isSafe = mergedIssues.length === 0;

  // Sanitize the summary to remove Unicode characters
  const rawSummary = isSafe
    ? `No ${category} issues detected.`
    : `Found ${mergedIssues.length} ${category} issue(s): ${mergedIssues
        .map((i) => i.title)
        .slice(0, 2)
        .join(", ")}${mergedIssues.length > 2 ? ` and ${mergedIssues.length - 2} more` : ""}.`;

  const sanitizedSummary = rawSummary.replace(/[^\x00-\x7F]/g, '');

  return {
    category,
    issues: mergedIssues.map(issue => ({
      ...issue,
      title: issue.title.replace(/[^\x00-\x7F]/g, ''),
      description: issue.description.replace(/[^\x00-\x7F]/g, ''),
      fix: issue.fix.replace(/[^\x00-\x7F]/g, ''),
    })),
    safe: isSafe,
    summary: sanitizedSummary,
  };
}

/**
 * Run all specialist agents in parallel for each category.
 */
export async function runAllSpecialists(
  code: string,
  categories: Array<"security" | "bugs" | "performance" | "style">,
  language: string,
): Promise<SpecialistOutput[]> {
  const results = await Promise.allSettled(
    categories.map((cat) => runSpecialist(code, cat, language)),
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    // If the whole specialist threw, report failure honestly
    return {
      category: categories[i],
      issues: [],
      safe: false,
      summary: `${categories[i]} analysis encountered an error - manual review recommended.`,
    };
  });
}
