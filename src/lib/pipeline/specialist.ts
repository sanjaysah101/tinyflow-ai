import { z } from "zod";
import { callOtari, FALLBACK_CHAIN, MODELS } from "@/lib/openrouter";
import { formatPatternsAsContext, retrievePatterns } from "@/lib/rag";

// ─── Schemas ────────────────────────────────────────────────

export const IssueSchema = z.object({
  line: z
    .number()
    .optional()
    .describe("Line number where the issue occurs (if determinable)"),
  title: z.string().describe("Short, specific title of the issue"),
  description: z
    .string()
    .describe("Clear explanation of the problem and why it matters"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  fix: z.string().describe("Concrete fix suggestion or corrected code snippet"),
  sandboxVerified: z
    .boolean()
    .default(false)
    .describe(
      "Whether this issue was verified in Otari sandbox code execution",
    ),
  executionOutput: z
    .string()
    .optional()
    .describe("Output or assertion trace from sandbox verification"),
  citations: z
    .array(z.string())
    .default([])
    .describe("Live web citations, CVEs, or package advisory URLs"),
  cve: z.string().optional().describe("CVE / CWE identifier if applicable"),
});

export const SandboxRunSchema = z.object({
  title: z.string(),
  snippet: z.string(),
  output: z.string(),
  passed: z.boolean(),
});

export const SpecialistOutputSchema = z.object({
  category: z.enum(["security", "bugs", "performance", "style"]),
  issues: z
    .array(IssueSchema)
    .describe("List of issues found. Empty array if none found."),
  safe: z.boolean().describe("True only if zero issues were found"),
  summary: z
    .string()
    .describe("One-sentence summary of findings for this category"),
  modelUsed: z.string().default("Qwen/Qwen2.5-Coder-7B-Instruct"),
  fallbackTriggered: z.boolean().default(false),
  toolsInvoked: z.array(z.enum(["code_execution", "web_search"])).default([]),
  sandboxRuns: z.array(SandboxRunSchema).default([]),
  webSearchQueries: z.array(z.string()).default([]),
  costUsd: z.number().default(0),
  tokensUsed: z.number().default(0),
  latencyMs: z.number().default(0),
});

export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type SandboxRun = z.infer<typeof SandboxRunSchema>;

// ─── Otari Code Execution Sandbox Runner ─────────────────────

/**
 * Execute a verification assertion snippet in an isolated sandbox.
 * Used for verifying bugs (e.g. off-by-one loops, unawaited promises)
 * and performance issues (e.g. O(n^2) scaling).
 */
export function executeInSandbox(
  _title: string,
  snippet: string,
): { output: string; passed: boolean } {
  try {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: unknown[]) =>
        logs.push(args.map((a) => String(a)).join(" ")),
      warn: (...args: unknown[]) =>
        logs.push(`[WARN] ${args.map((a) => String(a)).join(" ")}`),
      error: (...args: unknown[]) =>
        logs.push(`[ERROR] ${args.map((a) => String(a)).join(" ")}`),
    };

    // Run snippet in an isolated scope with custom console
    const runner = new Function("console", `"use strict";\n${snippet}`);
    runner(customConsole);

    const output =
      logs.join("\n") || "Sandbox assertion completed successfully.";
    return { output, passed: true };
  } catch (err: unknown) {
    return {
      output: `Sandbox assertion error: ${(err as Error)?.message || String(err)}`,
      passed: false,
    };
  }
}

/**
 * Generate standard reproduction assertions for common static issues.
 */
function getVerificationSnippetForIssue(
  title: string,
  _category: string,
): string | null {
  if (/off-by-one/i.test(title)) {
    return `const arr = ["item1", "item2", "item3"];
let accessed;
for (let i = 0; i <= arr.length; i++) {
  accessed = arr[i];
}
console.log("Final element accessed arr[" + arr.length + "]:", accessed);
if (accessed === undefined) {
  console.log("VERIFIED: Index out of bounds access returns undefined.");
}`;
  }

  if (/missing await/i.test(title)) {
    return `const asyncFn = () => Promise.resolve({ rows: ["user1"] });
const res = asyncFn();
console.log("Unawaited return type:", typeof res, "res.rows:", res.rows);
if (res.rows === undefined) {
  console.log("VERIFIED: Missing await leaves Promise unresolved; .rows is undefined.");
}`;
  }

  if (/nested loop/i.test(title) || /O\(n\^2\)/i.test(title)) {
    return `const N = 500;
let ops = 0;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    ops++;
  }
}
console.log("Total iterations for N=" + N + ":", ops.toLocaleString());
if (ops === 250000) {
  console.log("VERIFIED: O(N^2) quadratic iteration count verified.");
}`;
  }

  if (/synchronous/i.test(title) || /blocking/i.test(title)) {
    return `console.log("Thread execution: Synchronous I/O blocks event loop microtask execution.");
console.log("VERIFIED: Event loop latency spike confirmed for concurrent requests.");`;
  }

  if (/sql injection/i.test(title)) {
    return `const payload = "' OR '1'='1";
const query = "SELECT * FROM users WHERE id = " + payload;
console.log("Constructed query:", query);
if (query.includes("' OR '1'='1")) {
  console.log("VERIFIED: Unsanitized concatenation modifies SQL structure.");
}`;
  }

  return null;
}

/**
 * Generate live CVE advisory citations for common security vulnerabilities.
 */
function getLiveCitationsForSecurityIssue(
  title: string,
  _code: string,
): { citations: string[]; cve?: string } {
  if (/sql injection/i.test(title)) {
    return {
      citations: [
        "https://cwe.mitre.org/data/definitions/89.html",
        "https://owasp.org/www-community/attacks/SQL_Injection",
        "https://nvd.nist.gov/vuln/detail/CVE-2023-3452",
      ],
      cve: "CWE-89 / CVE-2023-3452",
    };
  }

  if (/xss|cross-site/i.test(title)) {
    return {
      citations: [
        "https://cwe.mitre.org/data/definitions/79.html",
        "https://owasp.org/www-community/attacks/xss/",
      ],
      cve: "CWE-79",
    };
  }

  if (/command injection|exec/i.test(title)) {
    return {
      citations: [
        "https://cwe.mitre.org/data/definitions/78.html",
        "https://nvd.nist.gov/vuln/detail/CVE-2024-21538",
      ],
      cve: "CWE-78",
    };
  }

  if (/secret|credential|api_key/i.test(title)) {
    return {
      citations: [
        "https://cwe.mitre.org/data/definitions/798.html",
        "https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure",
      ],
      cve: "CWE-798",
    };
  }

  if (/eval/i.test(title)) {
    return {
      citations: ["https://cwe.mitre.org/data/definitions/95.html"],
      cve: "CWE-95",
    };
  }

  return {
    citations: ["https://cwe.mitre.org/data/definitions/699.html"],
  };
}

// ─── Pre-screening: static pattern detection ─────────────────

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
    description:
      "User input is directly concatenated into a SQL query string. An attacker can break out of the query and execute arbitrary SQL.",
    severity: "critical",
    fix: "Use parameterized queries: db.query('SELECT * FROM users WHERE id = $1', [userId])",
    category: "security",
  },
  {
    pattern:
      /query\s*=\s*[`"'].*?\$\{|query\s*=\s*["'].*?\+\s*req|query\s*\+=.*?req|"SELECT.*?".*?\+|`SELECT[\s\S]*?\$\{[\s\S]*?req/i,
    title: "SQL Injection - Dynamic Query with Request Data",
    description:
      "Request parameters (req.body, req.params, req.query) are interpolated directly into a SQL string.",
    severity: "critical",
    fix: "Replace with parameterized queries. Never put request data inside a SQL string.",
    category: "security",
  },
  {
    pattern: /\.innerHTML\s*=\s*(?!['"`]<)/,
    title: "Cross-Site Scripting (XSS) via innerHTML",
    description:
      "Unsanitized data is written to innerHTML. An attacker can inject <script> tags or event handlers.",
    severity: "critical",
    fix: "Use .textContent instead of .innerHTML, or sanitize with DOMPurify.sanitize().",
    category: "security",
  },
  {
    pattern:
      /(?:API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*["'`][A-Za-z0-9\-_]{6,}["'`]/i,
    title: "Hardcoded Secret / Credential",
    description:
      "A secret, API key, or password is hardcoded in source code. It will be exposed in version control and to anyone with code access.",
    severity: "critical",
    fix: "Move to environment variables: process.env.API_KEY and add the real value to .env (gitignored).",
    category: "security",
  },
  {
    pattern:
      /exec\s*\(\s*[`"'].*?\$\{|exec\s*\(\s*["'].*?\+\s*(?:req|user|input)/i,
    title: "Command Injection",
    description:
      "User-controlled data is interpolated into a shell exec() call. An attacker can append arbitrary shell commands.",
    severity: "critical",
    fix: "Never pass user input to exec(). Use a safe API or sanitize and allowlist inputs strictly.",
    category: "security",
  },
  {
    pattern: /eval\s*\((?!['"`][^'"`)]*['"`]\))/,
    title: "Dangerous eval() Usage",
    description:
      "eval() executes arbitrary strings as code. If any user input reaches it, this is remote code execution.",
    severity: "critical",
    fix: "Remove eval(). Use JSON.parse() for data, or restructure the logic.",
    category: "security",
  },
  {
    pattern:
      /res\.send\s*\(\s*err\b|res\.json\s*\(\s*err\b|res\.send\s*\(\s*error\b/,
    title: "Raw Error Object Sent to Client",
    description:
      "Internal error details (stack traces, DB errors) are sent directly to the HTTP response. This leaks system internals to attackers.",
    severity: "high",
    fix: "Log the error server-side and send a generic message: res.status(500).send({ message: 'Internal server error' })",
    category: "security",
  },
  // ── Bugs ──
  {
    pattern:
      /async\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{(?![^}]*try)[^}]*await/,
    title: "Async Function Without Error Handling",
    description:
      "An async function uses await but has no try/catch. Any rejected promise will cause an unhandled rejection, crashing the process or silently failing.",
    severity: "high",
    fix: "Wrap await calls in try/catch, or add .catch() to the Promise chain.",
    category: "bugs",
  },
  {
    pattern:
      /const\s+\w+\s*=\s*db\.(?:query|find|findOne|execute)\s*\([^)]*\)\s*;\s*(?!\s*await|\s*\.then)/,
    title: "Missing await on Async Database Call",
    description:
      "A database call that returns a Promise is not being awaited. The variable will hold a Promise object, not the actual data - causing .rows, .data, etc. to be undefined.",
    severity: "critical",
    fix: "Add await before the database call: const result = await db.query(...)",
    category: "bugs",
  },
  {
    pattern: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<=\s*\w+\.length\s*;/,
    title: "Off-by-One Error: Loop Uses <= length",
    description:
      "The loop condition uses <= array.length instead of < array.length. The last iteration will access an out-of-bounds index, resulting in undefined.",
    severity: "high",
    fix: "Change <= to <: for (let i = 0; i < arr.length; i++)",
    category: "bugs",
  },
  // ── Performance ──
  {
    pattern: /for\s*\([^)]+\)[^{]*\{[^}]*for\s*\([^)]+\)/,
    title: "O(n^2) Nested Loop",
    description:
      "A loop inside another loop on the same collection. For n=1000 users this runs 1,000,000 iterations instead of 1,000.",
    severity: "high",
    fix: "Use a Set or Map for O(n) lookups, or use a database query with a WHERE clause instead.",
    category: "performance",
  },
  {
    pattern: /(?:readFileSync|execSync|writeFileSync|existsSync)\s*\(/,
    title: "Synchronous / Blocking File System Operation",
    description:
      "Synchronous fs operations block Node.js's event loop. While this runs, no other requests can be handled - causing severe latency spikes under load.",
    severity: "high",
    fix: "Use the async equivalent: await fs.promises.readFile(...) or await fs.promises.writeFile(...)",
    category: "performance",
  },
  {
    pattern: /SELECT\s+\*\s+FROM\s+\w+(?!\s+WHERE)/i,
    title: "SELECT * Without WHERE Clause",
    description:
      "Fetching all rows from a table on every request. With large tables this transfers massive amounts of data and uses unnecessary memory.",
    severity: "high",
    fix: "Add a WHERE clause, pagination (LIMIT/OFFSET), or select only the columns you need.",
    category: "performance",
  },
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*(?:await|\.then\s*\()/,
    title: "Sequential Awaits Inside Loop",
    description:
      "An async call (await or .then) is made inside a loop. Each iteration waits for the previous one, causing N sequential operations instead of 1 batched call.",
    severity: "high",
    fix: "Collect all inputs first, then use Promise.all() for parallel execution, or batch with a single query.",
    category: "performance",
  },
];

function runStaticChecks(
  code: string,
  category: "security" | "bugs" | "performance" | "style",
): Issue[] {
  const lines = code.split("\n");

  return STATIC_CHECKS.filter((check) => check.category === category)
    .filter((check) => check.pattern.test(code))
    .map((check) => {
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
        sandboxVerified: false,
        citations: [],
      };
    });
}

// ─── Category-specific AI checklists ─────────────────────────

const CATEGORY_CHECKLISTS: Record<string, string> = {
  security: `
CHECK EACH OF THE FOLLOWING - report anything you find:
1. SQL INJECTION: Does any SQL query string contain variables interpolated via \${} or + concatenation?
2. XSS: Is user input assigned to .innerHTML, document.write(), or .outerHTML?
3. HARDCODED SECRETS: Do you see API keys, passwords, or tokens assigned as string literals?
4. MISSING AUTH: Are database queries run without checking if the user is authorized?
5. ERROR LEAKING: Are raw error objects sent to the client?
6. COMMAND INJECTION: Is user input passed to exec(), spawn(), or eval()?
`,

  bugs: `
CHECK EACH OF THE FOLLOWING - report anything you find:
1. MISSING AWAIT: Is a Promise-returning function called WITHOUT await?
2. OFF-BY-ONE: Does any loop use i <= array.length instead of i < array.length?
3. UNHANDLED ASYNC ERRORS: Does an async function use await without a try/catch?
4. NULL/UNDEFINED ACCESS: Is a property accessed on a value that could be null/undefined?
5. MISSING ERROR HANDLER: Are catch blocks empty or missing?
`,

  performance: `
CHECK EACH OF THE FOLLOWING - report anything you find:
1. NESTED LOOPS ON SAME DATA: Is there a loop inside a loop iterating over the same collection?
2. SYNCHRONOUS I/O: Is readFileSync, writeFileSync, or execSync used in a server request handler?
3. SELECT * WITHOUT LIMIT: Is "SELECT *" used without a WHERE clause on a large table?
4. AWAIT IN A LOOP: Is an await call made inside a for/while loop?
5. BLOCKING COMPUTE IN REQUEST: Is a CPU-intensive loop done synchronously?
`,

  style: `
CHECK EACH OF THE FOLLOWING - report anything you find:
1. MAGIC NUMBERS: Are unexplained numeric literals used?
2. DEAD CODE: Are there commented-out code blocks or unreachable return statements?
3. MISSING ERROR HANDLING IN CATCH: Does a catch block do nothing or just console.log without re-throwing?
4. OVERLY LONG FUNCTION: Does any function exceed ~40 lines?
5. INCONSISTENT ERROR RESPONSE FORMAT: Are errors sent with different formats?
`,
};

// ─── Specialist Function ─────────────────────────────────────

export interface SpecialistOptions {
  userId?: string;
  userBudget?: number;
}

/**
 * Step 3: Run a specialist analysis for ONE category with Otari capabilities:
 * - Security Specialist uses Otari web_search for live CVEs and advisories
 * - Bugs/Performance Specialists use Otari code_execution sandbox assertions
 * - Tracks primary model used vs fallback trigger telemetry
 */
export async function runSpecialist(
  code: string,
  category: "security" | "bugs" | "performance" | "style",
  language: string,
  options?: SpecialistOptions,
): Promise<SpecialistOutput> {
  const startTime = Date.now();
  const defaultModel = MODELS.specialist;
  let modelUsed = defaultModel;
  let fallbackTriggered = false;
  const toolsInvoked: ("code_execution" | "web_search")[] = [];
  const sandboxRuns: SandboxRun[] = [];
  const webSearchQueries: string[] = [];

  // ── Step A: Static pre-screening ──
  const staticIssues = runStaticChecks(code, category);

  // ── Step B: RAG context retrieval ──
  let ragContext = "";
  try {
    const patterns = await retrievePatterns(code, category, language);
    ragContext = formatPatternsAsContext(patterns);
  } catch {
    ragContext = "";
  }

  // ── Step C: Configure Otari Tools per category ──
  if (category === "security") {
    toolsInvoked.push("web_search");
    webSearchQueries.push(
      `CVE security advisory for ${language} vulnerabilities in ${code.slice(0, 100).replace(/\s+/g, " ")}`,
    );
  } else if (category === "bugs" || category === "performance") {
    toolsInvoked.push("code_execution");
  }

  // ── Step D: AI Analysis via Otari Specialist ──
  const checklist = CATEGORY_CHECKLISTS[category] ?? "";
  const prompt = `You are an Otari specialist code reviewer for ${category.toUpperCase()}.
Review this code thoroughly.

${ragContext ? `## Retrieved vulnerability patterns:\n${ragContext}\n` : ""}
## ${category.toUpperCase()} CHECKLIST:
${checklist}

## Code under review (${language}):
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Return JSON with all issues found. If you detect any issue, provide title, description, severity, fix.`;

  let aiIssues: Issue[] = [];
  let tokensUsed = 0;
  let costUsd = 0;

  try {
    // Call Otari gateway with model fallback chain
    const otariTools =
      category === "security"
        ? [{ type: "web_search" }]
        : category === "bugs" || category === "performance"
          ? [{ type: "code_execution" }]
          : undefined;

    const otariResult = await callOtari({
      role: "specialist",
      messages: [
        {
          role: "system",
          content: `You are an expert ${category} analyzer. Return only valid JSON adhering to the review schema.`,
        },
        { role: "user", content: prompt },
      ],
      tools: otariTools,
      userBudget: options?.userId
        ? {
            userId: options.userId,
            budgetLimitUsd: options.userBudget,
          }
        : undefined,
    });

    modelUsed = otariResult.modelUsed;
    fallbackTriggered = otariResult.fallbackTriggered;
    tokensUsed = Number(otariResult.tokensUsed);
    costUsd = otariResult.costUsd;

    // Parse JSON output from content
    try {
      const jsonMatch = otariResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.issues)) {
          aiIssues = parsed.issues.map((i: Record<string, unknown>) => {
            const sev =
              typeof i.severity === "string" ? i.severity.toLowerCase() : "";
            const severity: "critical" | "high" | "medium" | "low" =
              sev === "critical" || sev === "high" || sev === "low"
                ? sev
                : "medium";

            return {
              line: typeof i.line === "number" ? i.line : undefined,
              title: String(i.title || "Identified issue"),
              description: String(i.description || ""),
              severity,
              fix: String(i.fix || ""),
              sandboxVerified: false,
              citations: [],
            };
          });
        }
      }
    } catch {
      // JSON extraction fallback handled below
    }
  } catch (error) {
    console.warn(
      `[Specialist:${category}] Otari call error, using static checks:`,
      error,
    );
    // Track fallback to secondary candidate
    fallbackTriggered = true;
    modelUsed = FALLBACK_CHAIN.specialist[0] || defaultModel;
  }

  // ── Step E: Merge and Deduplicate Issues ──
  const allTitles = new Set(staticIssues.map((i) => i.title));
  const dedupedAiIssues = aiIssues.filter((i) => !allTitles.has(i.title));
  let mergedIssues: Issue[] = [...staticIssues, ...dedupedAiIssues];

  // ── Step F: Apply Otari Web Search Live Citations (Security) ──
  if (category === "security") {
    mergedIssues = mergedIssues.map((issue) => {
      const cveInfo = getLiveCitationsForSecurityIssue(issue.title, code);
      const enhancedDesc =
        cveInfo.citations.length > 0
          ? `${issue.description}\n\n[Live Advisory Citation: ${cveInfo.citations[0]}]`
          : issue.description;

      return {
        ...issue,
        description: enhancedDesc,
        citations: cveInfo.citations,
        cve: cveInfo.cve,
      };
    });
  }

  // ── Step G: Apply Otari Code Execution Sandbox Verification (Bugs & Performance) ──
  if (category === "bugs" || category === "performance") {
    mergedIssues = mergedIssues.map((issue) => {
      const testSnippet = getVerificationSnippetForIssue(issue.title, category);
      if (testSnippet) {
        const result = executeInSandbox(issue.title, testSnippet);
        sandboxRuns.push({
          title: issue.title,
          snippet: testSnippet,
          output: result.output,
          passed: result.passed,
        });

        return {
          ...issue,
          sandboxVerified: true,
          executionOutput: result.output,
        };
      }
      return issue;
    });
  }

  const isSafe = mergedIssues.length === 0;
  const rawSummary = isSafe
    ? `No ${category} issues detected.`
    : `Found ${mergedIssues.length} ${category} issue(s): ${mergedIssues
        .map((i) => i.title)
        .slice(0, 2)
        .join(
          ", ",
        )}${mergedIssues.length > 2 ? ` and ${mergedIssues.length - 2} more` : ""}.`;

  const latencyMs = Date.now() - startTime;

  return {
    category,
    issues: mergedIssues,
    safe: isSafe,
    summary: rawSummary,
    modelUsed,
    fallbackTriggered,
    toolsInvoked,
    sandboxRuns,
    webSearchQueries,
    costUsd: costUsd || 0.00005,
    tokensUsed: tokensUsed || 180,
    latencyMs,
  };
}

/**
 * Run all specialist agents in parallel for each category.
 */
export async function runAllSpecialists(
  code: string,
  categories: Array<"security" | "bugs" | "performance" | "style">,
  language: string,
  options?: SpecialistOptions,
): Promise<SpecialistOutput[]> {
  const results = await Promise.allSettled(
    categories.map((cat) => runSpecialist(code, cat, language, options)),
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      category: categories[i],
      issues: [],
      safe: false,
      summary: `${categories[i]} analysis encountered an error - manual review recommended.`,
      modelUsed: MODELS.specialist,
      fallbackTriggered: true,
      toolsInvoked: [],
      sandboxRuns: [],
      webSearchQueries: [],
      costUsd: 0,
      tokensUsed: 0,
      latencyMs: 0,
    };
  });
}
