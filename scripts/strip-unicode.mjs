#!/usr/bin/env node
/**
 * One-off helper to strip Unicode punctuation from source files.
 * Prevents ByteString errors when strings are sent as HTTP headers.
 */
import fs from "node:fs";
import path from "node:path";

const FILES = [
  "src/lib/pipeline/specialist.ts",
  "src/lib/pipeline/router.ts",
  "src/lib/pipeline/synthesizer.ts",
  "src/lib/rag.ts",
  "src/lib/openrouter.ts",
];

const REPLACEMENTS = [
  [/\u2014/g, "-"],    // em dash
  [/\u2013/g, "-"],    // en dash
  [/\u2018/g, "'"],    // left single quote
  [/\u2019/g, "'"],    // right single quote
  [/\u201C/g, '"'],    // left double quote
  [/\u201D/g, '"'],    // right double quote
  [/\u2026/g, "..."],  // ellipsis
  [/\u00B2/g, "^2"],   // superscript 2
  [/\u2190/g, "<-"],   // left arrow
  [/\u2192/g, "->"],   // right arrow
  [/\u2022/g, "*"],    // bullet
  [/\u2264/g, "<="],   // less than or equal
  [/\u2265/g, ">="],   // greater than or equal
];

let totalReplaced = 0;
for (const rel of FILES) {
  const full = path.resolve(rel);
  if (!fs.existsSync(full)) continue;
  let content = fs.readFileSync(full, "utf8");
  const before = content.length;
  for (const [re, rep] of REPLACEMENTS) {
    content = content.replace(re, rep);
  }
  fs.writeFileSync(full, content, "utf8");
  const after = content.length;
  console.log(`  ${rel}: ${before - after} chars removed`);
  totalReplaced += before - after;
}
console.log(`Done. ${totalReplaced} total chars normalized.`);
