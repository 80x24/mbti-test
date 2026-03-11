// mbti.mjs — 16personalities.com MBTI test automation via Playwright CDP
// Usage:
//   node mbti.mjs start [--headed] [--port PORT]  → Launch browser
//   node mbti.mjs extract                          → Extract all 60 questions (answer with neutral to advance)
//   node mbti.mjs answer ANSWERS_JSON              → Answer all questions with provided mapping
//   node mbti.mjs result                           → Extract result from current page
//   node mbti.mjs stop                             → Close browser

import { chromium } from "@playwright/test";
import * as fs from "node:fs";
import { spawn } from "node:child_process";

const CDP_PORT = parseInt(process.env.MBTI_CDP_PORT || "9333");
const CDP_URL = `http://localhost:${CDP_PORT}`;
const PID_FILE = "/tmp/mbti-session.pid";
const TEST_URL = "https://www.16personalities.com/free-personality-test";

const cmd = process.argv[2];
const args = process.argv.slice(3);

switch (cmd) {
  case "start":   await cmdStart(args.includes("--headed")); break;
  case "extract": await cmdExtract(); break;
  case "answer":  await cmdAnswer(args[0]); break;
  case "result":  await cmdResult(); break;
  case "stop":    await cmdStop(); break;
  default:
    console.log(`mbti.mjs — 16personalities MBTI test automation
  start [--headed]     Launch browser and navigate to test
  extract              Extract all 60 questions (advances with neutral answers)
  answer <json_file>   Answer all questions with mapping from JSON file
  result               Extract MBTI result from current page
  stop                 Close browser`);
}

// ─── Start ───

async function cmdStart(headed = false) {
  await ensureStopped();

  const chromePath = process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome";

  const chromeArgs = [
    `--remote-debugging-port=${CDP_PORT}`,
    "--user-data-dir=/tmp/mbti-chrome-profile",
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (!headed) chromeArgs.push("--headless=new");
  else chromeArgs.push("--window-size=800,900");

  const chrome = spawn(chromePath, chromeArgs, { detached: true, stdio: "ignore" });
  chrome.unref();
  fs.writeFileSync(PID_FILE, String(chrome.pid));

  for (let i = 0; i < 30; i++) {
    if (await isRunning()) {
      console.log(`Browser started (pid: ${chrome.pid}, port: ${CDP_PORT})`);
      const { page, browser } = await connect();
      try {
        // Clear previous session
        await page.context().clearCookies();
        await page.goto(TEST_URL, { waitUntil: "domcontentloaded" });
        await sleep(3000);

        // Verify test page loaded
        const hasQuestions = await page.evaluate(() =>
          document.querySelectorAll("fieldset").length > 0
        );
        console.log(hasQuestions ? "Test page ready" : "Warning: no questions found");
        console.log(`URL: ${page.url()}`);
      } finally {
        browser.close();
      }
      return;
    }
    await sleep(500);
  }
  console.error("Failed to start browser");
  process.exit(1);
}

// ─── Extract all 60 questions ───

async function cmdExtract() {
  const { page, browser } = await connect();
  try {
    // Navigate fresh
    await page.context().clearCookies();
    await page.goto(TEST_URL, { waitUntil: "domcontentloaded" });
    await sleep(3000);

    const allQuestions = [];

    for (let p = 0; p < 12; p++) {
      await sleep(1500);

      const qs = await page.evaluate(() => {
        const results = [];
        for (const fs of document.querySelectorAll("fieldset")) {
          const textEl = fs.querySelector(".statement, p, label");
          if (!textEl) continue;
          const text = textEl.textContent?.trim();
          if (!text || text.length < 10 || text.includes("avatar")) continue;
          results.push(text);
        }
        return results;
      });

      allQuestions.push(...qs);

      // Answer neutral to advance
      await page.evaluate(() => {
        for (const fs of document.querySelectorAll("fieldset")) {
          const neutral = fs.querySelector('input[type="radio"][value="0"]');
          if (neutral && !fs.querySelector("input:checked")) neutral.click();
        }
      });
      await sleep(300);

      const clicked = await page.evaluate(() => {
        for (const b of document.querySelectorAll("button")) {
          if (b.textContent?.trim() === "Next") { b.click(); return true; }
        }
        return false;
      });
      if (!clicked) break;
      await sleep(1500);
    }

    // Output as JSON
    const output = allQuestions.map((q, i) => ({ number: i + 1, question: q }));
    console.log(JSON.stringify(output, null, 2));
    console.error(`\nExtracted ${allQuestions.length} questions`);
  } finally {
    browser.close();
  }
}

// ─── Answer all questions ───

async function cmdAnswer(jsonPath) {
  if (!jsonPath) { console.error("Usage: answer <json_file>"); process.exit(1); }

  const answers = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  // answers: { "question text": number(-3 to 3), ... }

  const { page, browser } = await connect();
  try {
    // Navigate fresh
    await page.context().clearCookies();
    await page.goto(TEST_URL, { waitUntil: "domcontentloaded" });
    await sleep(3000);

    let totalAnswered = 0;
    let missed = 0;

    for (let p = 0; p < 12; p++) {
      await sleep(1500);

      const questions = await page.evaluate(() => {
        const results = [];
        for (const fs of document.querySelectorAll("fieldset")) {
          const textEl = fs.querySelector(".statement, p, label");
          if (!textEl) continue;
          const text = textEl.textContent?.trim();
          if (!text || text.length < 10 || text.includes("avatar")) continue;
          const checked = fs.querySelector("input[type='radio']:checked");
          if (checked) continue;
          const name = fs.querySelector("input[type='radio']")?.name;
          if (!name) continue;
          results.push({ text, name });
        }
        return results;
      });

      if (questions.length === 0) {
        const url = page.url();
        if (url.includes("/profile")) break;
        const btn = await page.evaluate(() => {
          for (const b of document.querySelectorAll("button")) {
            const t = b.textContent?.trim();
            if (t === "Next" || t === "See results") { b.click(); return t; }
          }
          return null;
        });
        if (btn) { await sleep(2000); continue; }
        break;
      }

      for (const q of questions) {
        const value = answers[q.text];
        const answer = value !== undefined ? value : 0;
        if (value === undefined) {
          console.error(`[MISS] ${q.text.slice(0, 60)}`);
          missed++;
        }

        await page.evaluate(({ name, value }) => {
          document.querySelector(`input[name="${name}"][value="${value}"]`)?.click();
        }, { name: q.name, value: String(answer) });

        totalAnswered++;
        await sleep(150);
      }

      await sleep(400);
      await page.evaluate(() => {
        for (const b of document.querySelectorAll("button")) {
          if (b.textContent?.trim() === "Next") { b.click(); return; }
        }
      });
      await sleep(1500);
    }

    // Select gender and submit
    await sleep(1000);
    const gender = answers.__gender || "Other";
    await page.evaluate((g) => {
      const radio = document.querySelector(`input[name="gender"][value="${g}"]`);
      if (radio) radio.click();
    }, gender);
    await sleep(500);

    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent?.trim() === "See results") { b.click(); return; }
      }
    });

    console.error(`Answered: ${totalAnswered}, Missed: ${missed}`);
    console.error("Waiting for results...");
    await sleep(10000);

    // Output result
    await outputResult(page);
  } finally {
    browser.close();
  }
}

// ─── Result ───

async function cmdResult() {
  const { page, browser } = await connect();
  try {
    await outputResult(page);
  } finally {
    browser.close();
  }
}

async function outputResult(page) {
  const url = page.url();
  const title = await page.title();

  const traits = await page.evaluate(() => {
    const lines = document.body.innerText.split("\n");
    const result = {};
    for (const line of lines) {
      const m = line.match(/(Energy|Mind|Nature|Tactics|Identity):\s*(\d+)%\s*(\w+)/);
      if (m) result[m[1]] = { percentage: parseInt(m[2]), trait: m[3] };
    }
    return result;
  });

  const typeMatch = title.match(/^(\w{4})\s/);
  const type = typeMatch ? typeMatch[1] : "unknown";

  const description = await page.evaluate(() => {
    const ps = document.querySelectorAll("p");
    for (const p of ps) {
      if (p.textContent?.includes("As an ")) return p.textContent.trim();
    }
    return "";
  });

  const result = { url, type, title: title.replace(" | 16Personalities", ""), traits, description };
  console.log(JSON.stringify(result, null, 2));

  // Screenshot
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/tmp/mbti-result.png", Buffer.from(data, "base64"));
  console.error("Screenshot: /tmp/mbti-result.png");
}

// ─── Stop ───

async function cmdStop() {
  const stopped = await ensureStopped();
  if (!stopped) console.log("Not running");
}

async function ensureStopped() {
  let stopped = false;
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, "utf-8").trim();
    try { process.kill(Number(pid), "SIGTERM"); stopped = true; console.log(`Stopped (pid: ${pid})`); } catch {}
    fs.unlinkSync(PID_FILE);
  }
  try {
    const { execSync } = await import("node:child_process");
    const pids = execSync(`lsof -ti:${CDP_PORT} 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (pids) {
      execSync(`kill ${pids.split("\n").join(" ")} 2>/dev/null`);
      if (!stopped) { console.log("Stopped (orphan)"); stopped = true; }
    }
  } catch {}
  if (stopped) await sleep(500);
  return stopped;
}

// ─── Helpers ───

async function isRunning() {
  try { return (await fetch(`${CDP_URL}/json/version`)).ok; } catch { return false; }
}

async function connect() {
  if (!(await isRunning())) { console.error("Browser not running. Run 'start' first."); process.exit(1); }
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) { console.error("No page found"); process.exit(1); }
  return { browser, page };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
