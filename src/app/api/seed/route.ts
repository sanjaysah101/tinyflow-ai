import { createClient } from "@/utils/supabase/server";
import { openrouter, MODELS } from "@/lib/openrouter";
import { embed } from "ai";

// ─── Seed Data ──────────────────────────────────────────────────────────────

const VULNERABILITY_PATTERNS = [
  // ── Security ──
  {
    category: "security",
    language: "any",
    pattern_name: "SQL Injection",
    description: "User input is concatenated directly into SQL queries without parameterization, allowing attackers to manipulate the query.",
    example_code: `db.query("SELECT * FROM users WHERE id = " + userId)`,
    fix_suggestion: "Use parameterized queries or prepared statements: db.query('SELECT * FROM users WHERE id = $1', [userId])",
    severity: "critical",
  },
  {
    category: "security",
    language: "javascript",
    pattern_name: "Cross-Site Scripting (XSS)",
    description: "Unsanitized user input is inserted into the DOM via innerHTML, allowing script injection.",
    example_code: `element.innerHTML = userInput`,
    fix_suggestion: "Use textContent instead of innerHTML, or sanitize with DOMPurify.",
    severity: "critical",
  },
  {
    category: "security",
    language: "any",
    pattern_name: "Hardcoded Credentials",
    description: "API keys, passwords, or tokens are hardcoded in source code and will be exposed in version control.",
    example_code: `const API_KEY = "sk-1234567890abcdef"`,
    fix_suggestion: "Use environment variables and never commit secrets to version control.",
    severity: "critical",
  },
  {
    category: "security",
    language: "any",
    pattern_name: "Path Traversal",
    description: "User-controlled input is used to construct file paths, allowing access to files outside the intended directory.",
    example_code: `fs.readFile('/uploads/' + req.params.filename)`,
    fix_suggestion: "Sanitize paths with path.resolve() and verify the result stays within the allowed directory.",
    severity: "high",
  },
  {
    category: "security",
    language: "any",
    pattern_name: "Command Injection",
    description: "User input is passed directly to shell commands, allowing arbitrary code execution.",
    example_code: `exec('ls ' + userInput)`,
    fix_suggestion: "Never pass user input to shell commands. Use safe APIs or allowlist-validate inputs.",
    severity: "critical",
  },
  {
    category: "security",
    language: "javascript",
    pattern_name: "Prototype Pollution",
    description: "Merging user-controlled objects can pollute Object.prototype, affecting all objects in the application.",
    example_code: `Object.assign({}, userInput)  // if userInput has __proto__`,
    fix_suggestion: "Use JSON.parse(JSON.stringify(obj)) for deep copies, or use libraries like lodash with prototype pollution protection.",
    severity: "high",
  },
  {
    category: "security",
    language: "any",
    pattern_name: "Insecure Direct Object Reference (IDOR)",
    description: "Direct use of user-supplied IDs to access database records without authorization checks.",
    example_code: `db.find({ id: req.params.id })  // no ownership check`,
    fix_suggestion: "Always verify the authenticated user owns/can access the requested resource.",
    severity: "high",
  },
  {
    category: "security",
    language: "python",
    pattern_name: "Pickle Deserialization",
    description: "Deserializing untrusted data with pickle allows arbitrary code execution.",
    example_code: `pickle.loads(user_data)`,
    fix_suggestion: "Never deserialize untrusted data with pickle. Use JSON or other safe formats.",
    severity: "critical",
  },
  // ── Bugs ──
  {
    category: "bugs",
    language: "javascript",
    pattern_name: "Async/Await Missing Error Handling",
    description: "Async functions without try/catch can result in unhandled promise rejections that crash the process.",
    example_code: `async function fetchData() { const data = await api.get('/data'); }`,
    fix_suggestion: "Wrap await calls in try/catch or add .catch() to the promise.",
    severity: "high",
  },
  {
    category: "bugs",
    language: "any",
    pattern_name: "Off-by-One Error",
    description: "Loop bounds use < vs <= incorrectly, causing the first or last element to be skipped or causing out-of-bounds access.",
    example_code: `for (let i = 0; i <= arr.length; i++)  // should be i < arr.length`,
    fix_suggestion: "Verify loop bounds carefully. Array indices go from 0 to length-1.",
    severity: "medium",
  },
  {
    category: "bugs",
    language: "javascript",
    pattern_name: "Null/Undefined Dereference",
    description: "Accessing properties of potentially null or undefined values without null checks.",
    example_code: `const name = user.profile.name  // crashes if profile is null`,
    fix_suggestion: "Use optional chaining: user?.profile?.name, or add explicit null checks.",
    severity: "high",
  },
  {
    category: "bugs",
    language: "any",
    pattern_name: "Race Condition",
    description: "Multiple async operations access shared state without proper synchronization, leading to non-deterministic behavior.",
    example_code: `if (cache[key]) return cache[key]; /* ... */ cache[key] = await fetch()`,
    fix_suggestion: "Use mutexes, locks, or atomic operations. For caches, use a pending promise pattern.",
    severity: "high",
  },
  {
    category: "bugs",
    language: "python",
    pattern_name: "Mutable Default Argument",
    description: "Using mutable objects (lists, dicts) as default function arguments shares the same object across all calls.",
    example_code: `def append_item(item, lst=[]):  # lst is shared!`,
    fix_suggestion: "Use None as default and create the mutable object inside the function.",
    severity: "medium",
  },
  {
    category: "bugs",
    language: "javascript",
    pattern_name: "Type Coercion Bugs",
    description: "Using == instead of === allows unexpected type coercion (e.g., '' == false, 0 == null).",
    example_code: `if (value == null)  // matches both null and undefined, but can be confusing`,
    fix_suggestion: "Use === for strict equality. The only safe use of == is for null checking (value == null).",
    severity: "low",
  },
  // ── Performance ──
  {
    category: "performance",
    language: "any",
    pattern_name: "N+1 Query Problem",
    description: "Executing a database query inside a loop, resulting in N+1 total queries instead of 1.",
    example_code: `for (const user of users) { const posts = await db.posts.findMany({ where: { userId: user.id } }) }`,
    fix_suggestion: "Use a JOIN or batch query to fetch all related records in a single query.",
    severity: "high",
  },
  {
    category: "performance",
    language: "javascript",
    pattern_name: "Unnecessary Re-renders (React)",
    description: "Creating new objects or arrays inline in JSX props causes child components to re-render on every parent render.",
    example_code: `<Component style={{ color: 'red' }} />  // new object every render`,
    fix_suggestion: "Move static objects/arrays outside the component, or use useMemo/useCallback.",
    severity: "medium",
  },
  {
    category: "performance",
    language: "any",
    pattern_name: "Synchronous Blocking I/O",
    description: "Using synchronous I/O operations blocks the event loop, preventing other requests from being handled.",
    example_code: `const data = fs.readFileSync('large-file.json')`,
    fix_suggestion: "Use async I/O: await fs.promises.readFile('large-file.json')",
    severity: "high",
  },
  {
    category: "performance",
    language: "any",
    pattern_name: "Inefficient String Concatenation in Loops",
    description: "Concatenating strings in a loop creates many intermediate string objects, O(n²) total memory.",
    example_code: `let result = ''; for (const item of items) { result += item; }`,
    fix_suggestion: "Use an array and join at the end: items.join('')",
    severity: "medium",
  },
  {
    category: "performance",
    language: "python",
    pattern_name: "Nested List Comprehension Performance",
    description: "Deeply nested list comprehensions with large data can cause excessive memory usage.",
    example_code: `result = [transform(x) for sublist in nested for x in sublist]`,
    fix_suggestion: "Consider using generators and itertools.chain for large datasets.",
    severity: "low",
  },
  // ── Style ──
  {
    category: "style",
    language: "any",
    pattern_name: "Magic Numbers",
    description: "Unexplained numeric literals in code make logic hard to understand and maintain.",
    example_code: `if (status === 403)  // What does 403 mean here?`,
    fix_suggestion: "Extract to named constants: const HTTP_FORBIDDEN = 403;",
    severity: "low",
  },
  {
    category: "style",
    language: "any",
    pattern_name: "Dead Code",
    description: "Commented-out code, unreachable code blocks, or unused variables cluttering the codebase.",
    example_code: `// const oldFunction = () => { ... }  // never called`,
    fix_suggestion: "Remove dead code. Use version control history to recover if needed.",
    severity: "low",
  },
  {
    category: "style",
    language: "javascript",
    pattern_name: "Deeply Nested Callbacks",
    description: "Multiple levels of nested callbacks (callback hell) make code hard to read and debug.",
    example_code: `getData(function(a) { getMore(a, function(b) { process(b, function(c) { ... }) }) })`,
    fix_suggestion: "Refactor to async/await or Promise chains.",
    severity: "medium",
  },
  {
    category: "style",
    language: "any",
    pattern_name: "Function Too Long",
    description: "Functions exceeding ~50 lines typically indicate multiple responsibilities and should be decomposed.",
    example_code: `function doEverything() { /* 200 lines */ }`,
    fix_suggestion: "Extract sub-functions. Each function should do one thing and fit on one screen.",
    severity: "low",
  },
  {
    category: "style",
    language: "any",
    pattern_name: "Missing Error Boundaries",
    description: "Operations that can fail (network calls, file I/O, parsing) with no error handling path.",
    example_code: `const parsed = JSON.parse(input)  // throws if input is invalid JSON`,
    fix_suggestion: "Wrap in try/catch and handle the error case explicitly.",
    severity: "medium",
  },
];

// ─── Seeder API Route ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();

  try {
    let seeded = 0;
    let skipped = 0;

    for (const pattern of VULNERABILITY_PATTERNS) {
      // Check if already seeded
      const { data: existing } = await supabase
        .from("vulnerability_patterns")
        .select("id")
        .eq("pattern_name", pattern.pattern_name)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Generate embedding for the pattern
      const textToEmbed = `${pattern.pattern_name}: ${pattern.description}. Fix: ${pattern.fix_suggestion}`;
      
      let embedding: number[] | null = null;
      try {
        const result = await embed({
          model: openrouter.embedding(MODELS.embedding),
          value: textToEmbed,
        });
        embedding = result.embedding;
      } catch (embedErr) {
        console.warn(`[Seed] Could not embed "${pattern.pattern_name}":`, embedErr);
      }

      const { error } = await supabase.from("vulnerability_patterns").insert({
        ...pattern,
        embedding,
      });

      if (error) {
        console.error(`[Seed] Failed to insert "${pattern.pattern_name}":`, error.message);
      } else {
        seeded++;
      }
    }

    return Response.json({
      success: true,
      message: `Seeded ${seeded} patterns, skipped ${skipped} existing.`,
      total: VULNERABILITY_PATTERNS.length,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
