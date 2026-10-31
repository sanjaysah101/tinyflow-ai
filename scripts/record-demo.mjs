#!/usr/bin/env node
/**
 * scripts/record-demo.mjs
 *
 * Automated 3m 15s MozFest 2026 demo video generator.
 *
 * Uses:
 *  - Playwright (with system Chrome/Edge) for 1920×1080 video recording
 *  - node-edge-tts (with python edge-tts file fallback) for neural narration
 *  - ffmpeg to merge video + audio into final MP4
 *
 * Usage:
 *   node scripts/record-demo.mjs [--base-url http://localhost:3000]
 *
 * Output: public/demo-mozfest-2026.mp4
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { EdgeTTS } from "node-edge-tts";
import { chromium } from "playwright";

// ─── Configuration ──────────────────────────────────────────────
const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const TEMP_DIR = join(PROJECT_ROOT, ".demo-tmp");
const OUTPUT_PATH = join(PROJECT_ROOT, "public", "demo-mozfest-2026.mp4");

const BASE_URL =
  process.argv.find((a) => a.startsWith("--base-url"))?.split("=")[1] ||
  process.argv[process.argv.indexOf("--base-url") + 1] ||
  "http://localhost:3000";

const TTS_VOICE = "en-US-AndrewMultilingualNeural";
const TTS_RATE = "+5%"; // Slightly faster for professional pacing
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;

// ─── Browser Resolution ─────────────────────────────────────────
function getBrowserExecutable() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    join(
      process.env.LOCALAPPDATA || "",
      "Google\\Chrome\\Application\\chrome.exe",
    ),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

// ─── Narration Scenes ───────────────────────────────────────────
const SCENES = [
  {
    id: "scene1",
    label: "Landing Page & Architecture",
    narration: `Hi Mozilla judges! This is TinyFlow AI, a multi-agent code review pipeline upgraded for the MozFest 2026 Hackathon using Mozilla's Otari AI Gateway. Originally, TinyFlow struggled with single-provider rate limits, hallucinated runtime bugs, and stale CVE cutoffs. By migrating our entire backend to Otari, we now orchestrate four distinct open-weight Qwen 3 models with automatic failovers, isolated code execution, live web search, guardrails, and per-user budget controls.`,
  },
  {
    id: "scene2",
    label: "Otari Gateway Controls & BYOK",
    narration: `Inside the analyzer workspace, our Otari Gateway Live Controls bar exposes all six rubric capabilities. We also built a three-tier Bring Your Own Key configuration modal so judges can test with their own Otari workspace key, our server key, or automatic failover to OpenRouter. Let me show you the BYOK modal now.`,
  },
  {
    id: "scene3",
    label: "Live Pipeline & Guardrail Redaction",
    narration: `When we run an analysis on a vulnerable JavaScript file, Otari's pre-flight Guardrails immediately intercept and redact the hardcoded production API key before dispatching code to downstream agents. Next, Qwen 3.5 9B routes the payload, Qwen 3 Embedding retrieves vector patterns, Qwen 3 32B runs parallel specialists, and Qwen 3.6 35B synthesizes the final report. Notice the red guardrail banner confirming the API key was redacted.`,
  },
  {
    id: "scene4",
    label: "CVE Web Search, Sandbox & Fallbacks",
    narration: `In the Security tab, the specialist uses Otari's web search tool to attach live MITRE and CWE advisories. In the Bugs tab, instead of guessing about loop boundaries, the specialist uses Otari's code execution sandbox to run an assertion test proving the off-by-one error at runtime. We can also trigger forced model fallback chains and test the HTTP 429 per-user budget lock. Let me demonstrate both now.`,
  },
  {
    id: "scene5",
    label: "History & Developer Feedback",
    narration: `Finally, our Audit History and Otari Overview tabs log every open-weight model used, sandbox run, and micro-dollar token cost. For our developer feedback to the Mozilla team: what worked best was the unified OpenAI-compatible routing across Qwen 3 open-weight models and multi-provider fallback between DeepInfra and Together AI. Where we wrote custom glue code was normalizing reasoning token outputs and handling schema retries when an open-weight model wrapped tool JSON in markdown blocks. Native JSON schema enforcement and per-end-user budget headers in Otari would eliminate that glue code completely. Thanks for watching!`,
  },
];

// ─── Helpers ────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      try {
        unlinkSync(join(dir, f));
      } catch {
        /* ignore */
      }
    }
  }
}

/** Generate a single narration MP3 via node-edge-tts (with fallback to python edge-tts --file) */
async function generateNarration(sceneId, text, outputPath) {
  console.log(`  🎙️  Generating narration for ${sceneId}...`);
  try {
    const tts = new EdgeTTS({
      voice: TTS_VOICE,
      rate: TTS_RATE,
      timeout: 120_000,
    });
    await tts.ttsPromise(text, outputPath);
    return outputPath;
  } catch (err) {
    console.warn(
      `    ⚠️ node-edge-tts error (${err.message}), falling back to python edge-tts via file...`,
    );
    const txtFile = outputPath.replace(/\.mp3$/, ".txt");
    await writeFile(txtFile, text, "utf8");
    execSync(
      `python -m edge_tts --voice "${TTS_VOICE}" --rate="${TTS_RATE}" --file "${txtFile}" --write-media "${outputPath}"`,
      { stdio: "pipe", timeout: 180_000 },
    );
    try {
      unlinkSync(txtFile);
    } catch {
      /* ignore */
    }
    return outputPath;
  }
}

/** Get audio duration in seconds via ffprobe */
function getAudioDuration(filePath) {
  const raw = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    { encoding: "utf8", timeout: 15_000 },
  );
  return Number.parseFloat(raw.trim());
}

/** Ensure target server is reachable, auto-launching dev server if needed */
async function ensureServerRunning(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.status >= 200 && res.status < 500) {
      console.log(`  ✅ Target server is online at ${url}`);
      return null;
    }
  } catch {
    // offline
  }

  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    console.log(`  🚀 Starting local server at ${url}...`);
    const serverProcess = spawn("pnpm", ["dev"], {
      cwd: PROJECT_ROOT,
      shell: true,
      stdio: "pipe",
    });

    for (let i = 0; i < 40; i++) {
      await sleep(1500);
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.status >= 200 && res.status < 500) {
          console.log(`  ✅ Local server is ready at ${url}`);
          return serverProcess;
        }
      } catch {
        // waiting...
      }
    }
    console.warn(
      `  ⚠️ Could not confirm server at ${url}, proceeding anyway...`,
    );
    return serverProcess;
  }
  return null;
}

/** Wait for a specific selector to appear on page */
async function waitFor(page, selector, timeoutMs = 15000) {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
  } catch {
    console.warn(
      `    ⏭️  Selector "${selector}" not found within ${timeoutMs}ms, continuing...`,
    );
  }
}

/** Smooth scroll to bottom of page */
async function smoothScroll(page, durationMs = 3000, steps = 30) {
  const stepDelay = durationMs / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((step) => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const target = (maxScroll / 30) * (step + 1);
      window.scrollTo({ top: Math.min(target, maxScroll), behavior: "smooth" });
    }, i);
    await sleep(stepDelay);
  }
}

/** Smooth scroll back to top */
async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(800);
}

// ─── Scene Choreography ─────────────────────────────────────────

async function runScene1(page, durationMs) {
  console.log("  🎬 Scene 1: Landing page...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);

  // Scroll through the architecture section and model registry
  await smoothScroll(page, Math.min(durationMs - 4000, 25000));
  await sleep(2000);
}

async function runScene2(page, durationMs) {
  console.log("  🎬 Scene 2: Gateway controls & BYOK...");
  await page.goto(`${BASE_URL}/app`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await sleep(2000);

  // Hover over the Otari Gateway Live Controls bar
  const controlsBar = page.locator("text=Otari Gateway Live Controls").first();
  if (await controlsBar.isVisible().catch(() => false)) {
    await controlsBar.hover();
    await sleep(1500);
  }

  // Click BYOK button to open the modal
  const byokBtn = page.locator('button:has-text("BYOK")').first();
  if (await byokBtn.isVisible().catch(() => false)) {
    await byokBtn.click();
    await sleep(4000); // Pause to show the modal

    // Close the modal
    const closeBtn = page
      .locator(
        '[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("×")',
      )
      .first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await sleep(1500);
  }

  const elapsed = 9000;
  if (durationMs > elapsed) await sleep(durationMs - elapsed);
}

async function runScene3(page, durationMs) {
  console.log("  🎬 Scene 3: Live pipeline & guardrails...");

  const url = page.url();
  if (!url.includes("/app")) {
    await page.goto(`${BASE_URL}/app`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await sleep(1000);
  }

  // Click Analyze Code button
  const analyzeBtn = page.locator('button:has-text("Analyze")').first();
  if (await analyzeBtn.isVisible().catch(() => false)) {
    await analyzeBtn.click();
    console.log("    ▶ Analysis started...");
  }

  // Wait for pipeline to progress
  await sleep(5000);

  // Scroll to see pipeline progress
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
  await sleep(3000);

  // Wait for analysis to finish (look for guardrail indicator)
  await waitFor(page, "text=GUARDRAIL", 25000);
  await sleep(2000);

  // Scroll down to show guardrail banner
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
  await sleep(2000);

  // Scroll to show results
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: "smooth" }));

  const elapsed = 37000;
  if (durationMs > elapsed) await sleep(Math.min(durationMs - elapsed, 10000));
}

async function runScene4(page, durationMs) {
  console.log("  🎬 Scene 4: CVE search, sandbox & fallbacks...");

  // Click Security tab
  const securityTab = page
    .locator('button:has-text("Security"), [role="tab"]:has-text("security")')
    .first();
  if (await securityTab.isVisible().catch(() => false)) {
    await securityTab.click();
    await sleep(2500);
  }

  // Hover over CVE / Web Search badges
  const webSearchBadge = page.locator("text=Web Search").first();
  if (await webSearchBadge.isVisible().catch(() => false)) {
    await webSearchBadge.hover();
    await sleep(2000);
  }

  // Scroll through security findings
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "smooth" }));
  await sleep(2000);

  // Click Bugs tab
  const bugsTab = page
    .locator('button:has-text("Bugs"), [role="tab"]:has-text("bugs")')
    .first();
  if (await bugsTab.isVisible().catch(() => false)) {
    await bugsTab.click();
    await sleep(2500);
  }

  // Hover over Sandbox Verified badge
  const sandboxBadge = page.locator("text=Sandbox Verified").first();
  if (await sandboxBadge.isVisible().catch(() => false)) {
    await sandboxBadge.hover();
    await sleep(2000);
  }

  // Expand first bug issue to show sandbox trace
  const bugIssue = page
    .locator('[class*="border"][class*="rounded"]')
    .filter({ hasText: "Sandbox" })
    .first();
  if (await bugIssue.isVisible().catch(() => false)) {
    await bugIssue.click();
    await sleep(3000);
  }

  // Scroll up to controls bar to show Force Fallback
  await scrollToTop(page);
  await sleep(1000);

  // Click Force Fallback toggle
  const fallbackBtn = page
    .locator(
      'button:has-text("Force Fallback"), button:has-text("Test Fallback")',
    )
    .first();
  if (await fallbackBtn.isVisible().catch(() => false)) {
    await fallbackBtn.click();
    await sleep(2000);
  }

  // Click Test 429 Lock
  const lockBtn = page.locator('button:has-text("Test 429")').first();
  if (await lockBtn.isVisible().catch(() => false)) {
    await lockBtn.click();
    await sleep(2500);
  }

  // Reset budget
  const resetBtn = page.locator('button:has-text("Reset")').first();
  if (await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click();
    await sleep(1000);
  }

  const elapsed = 21500;
  if (durationMs > elapsed) await sleep(Math.min(durationMs - elapsed, 20000));
}

async function runScene5(page, durationMs) {
  console.log("  🎬 Scene 5: History & developer feedback...");

  await page.goto(`${BASE_URL}/app/history`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await sleep(3000);

  // Scroll through history entries
  await smoothScroll(page, Math.min(durationMs - 6000, 30000));
  await sleep(3000);
}

const SCENE_RUNNERS = [runScene1, runScene2, runScene3, runScene4, runScene5];

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  TinyFlow AI — MozFest 2026 Demo Video Recorder  ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Output: ${OUTPUT_PATH}\n`);

  ensureDir(TEMP_DIR);
  cleanDir(TEMP_DIR);
  ensureDir(join(PROJECT_ROOT, "public"));

  // Check and ensure server is running
  const spawnedServer = await ensureServerRunning(BASE_URL);

  // ── Step 1: Generate all narration audio ──
  console.log("\n━━━ Step 1: Generating narration audio ━━━");
  const sceneData = [];
  for (const scene of SCENES) {
    const audioPath = join(TEMP_DIR, `${scene.id}.mp3`);
    await generateNarration(scene.id, scene.narration, audioPath);
    const duration = getAudioDuration(audioPath);
    sceneData.push({
      ...scene,
      audioPath,
      audioDurationSec: duration,
      audioDurationMs: Math.ceil(duration * 1000),
    });
    console.log(
      `    ✅ ${scene.id}: ${duration.toFixed(1)}s — "${scene.label}"`,
    );
  }

  const totalAudioDuration = sceneData.reduce(
    (s, d) => s + d.audioDurationSec,
    0,
  );
  console.log(`\n  Total narration: ${totalAudioDuration.toFixed(1)}s`);

  // ── Step 2: Concatenate all narration into one audio track ──
  console.log("\n━━━ Step 2: Concatenating narration audio ━━━");
  const concatListPath = join(TEMP_DIR, "concat-list.txt");
  const concatContent = sceneData
    .map((s) => `file '${s.audioPath.replace(/\\/g, "/")}'`)
    .join("\n");
  await writeFile(concatListPath, concatContent, "utf8");

  const fullAudioPath = join(TEMP_DIR, "full-narration.mp3");
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:a libmp3lame -q:a 2 "${fullAudioPath}"`,
    { stdio: "pipe", timeout: 60_000 },
  );
  const fullAudioDuration = getAudioDuration(fullAudioPath);
  console.log(`  ✅ Full narration: ${fullAudioDuration.toFixed(1)}s`);

  // ── Step 3: Record browser video with Playwright ──
  console.log("\n━━━ Step 3: Recording browser video ━━━");
  const videoDir = join(TEMP_DIR, "video");
  ensureDir(videoDir);

  const browserExecutable = getBrowserExecutable();
  console.log(
    `  🌐 Browser executable: ${browserExecutable || "Playwright bundled Chromium"}`,
  );

  const browser = await chromium.launch({
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
    headless: true,
    args: [
      `--window-size=${VIDEO_WIDTH},${VIDEO_HEIGHT}`,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    recordVideo: {
      dir: videoDir,
      size: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Run each scene with its exact audio duration as the timing constraint
  for (let i = 0; i < sceneData.length; i++) {
    const scene = sceneData[i];
    console.log(
      `\n  ── Scene ${i + 1}/${sceneData.length}: ${scene.label} (${scene.audioDurationSec.toFixed(1)}s) ──`,
    );

    const sceneStart = Date.now();
    await SCENE_RUNNERS[i](page, scene.audioDurationMs);
    const elapsed = Date.now() - sceneStart;

    const remaining = scene.audioDurationMs - elapsed;
    if (remaining > 0) {
      console.log(
        `    ⏳ Padding ${(remaining / 1000).toFixed(1)}s to sync with audio...`,
      );
      await sleep(remaining);
    }
    console.log(
      `    ✅ Scene ${i + 1} complete (${((Date.now() - sceneStart) / 1000).toFixed(1)}s)`,
    );
  }

  // Close page and context to finalize the video
  const videoPath = await page.video()?.path();
  await page.close();
  await context.close();
  await browser.close();

  if (!videoPath || !existsSync(videoPath)) {
    console.error("  ❌ Video recording not found! Aborting.");
    if (spawnedServer) spawnedServer.kill();
    process.exit(1);
  }

  console.log(`\n  ✅ Raw video recorded: ${videoPath}`);
  const rawDuration = getAudioDuration(videoPath);
  console.log(`  Raw video duration: ${rawDuration.toFixed(1)}s`);

  // ── Step 4: Merge video + audio with ffmpeg ──
  console.log("\n━━━ Step 4: Merging video + narration audio ━━━");

  execSync(
    [
      "ffmpeg -y",
      `-i "${videoPath}"`,
      `-i "${fullAudioPath}"`,
      "-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p",
      "-c:a aac -b:a 192k",
      "-map 0:v:0 -map 1:a:0",
      "-shortest",
      "-movflags +faststart",
      `"${OUTPUT_PATH}"`,
    ].join(" "),
    { stdio: "inherit", timeout: 300_000 },
  );

  // ── Step 5: Verify output ──
  if (!existsSync(OUTPUT_PATH)) {
    console.error("  ❌ Output file not created!");
    if (spawnedServer) spawnedServer.kill();
    process.exit(1);
  }

  const finalDuration = getAudioDuration(OUTPUT_PATH);
  const stat = await (await import("node:fs/promises")).stat(OUTPUT_PATH);
  const fileSizeMB = (stat.size / 1024 / 1024).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║              ✅ Demo Video Complete!              ║");
  console.log("╠═══════════════════════════════════════════════════╣");
  console.log(`║  Output:   ${OUTPUT_PATH}`);
  console.log(`║  Duration: ${finalDuration.toFixed(1)}s`);
  console.log(`║  Size:     ${fileSizeMB} MB`);
  console.log("╚═══════════════════════════════════════════════════╝");

  if (spawnedServer) spawnedServer.kill();

  // Cleanup temp files
  cleanDir(TEMP_DIR);
  try {
    (await import("node:fs")).rmdirSync(videoDir);
    (await import("node:fs")).rmdirSync(TEMP_DIR);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
