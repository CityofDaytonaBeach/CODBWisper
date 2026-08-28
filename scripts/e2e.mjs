import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const APP_URL = "http://localhost:4173/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BUN = path.join(os.homedir(), ".bun", "bin", "bun.exe");

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(page, fn, timeoutMs, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await fn();
      if (last) return last;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function makeToneWav(dir) {
  const rate = 16000;
  const seconds = 5;
  const n = rate * seconds;
  const samples = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v =
      0.3 * Math.sin(2 * Math.PI * 220 * t) +
      0.2 * Math.cos(2 * Math.PI * 440 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * t));
    samples.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + n * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(n * 2, 40);
  const file = path.join(dir, "tone.wav");
  await writeFile(file, Buffer.concat([header, samples]));
  return file;
}

const browser = null;
const preview = spawn(BUN, ["run", "preview", "--port", "4173"], { cwd: process.cwd(), detached: true, stdio: "ignore" });
const tmp = await mkdtemp(path.join(os.tmpdir(), "codb-e2e-"));

try {
  await wait(2500);
  const wav = await makeToneWav(tmp);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
    userDataDir: path.join(tmp, "profile"),
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(APP_URL, { waitUntil: "networkidle0", timeout: 60000 });
  console.log("[1] page loaded");

  // Verify cross-origin isolation came from our headers
  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  console.log(`[2] crossOriginIsolated: ${isolated}`);

  // 3. Upload the generated wav
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 10000 }),
    page.click(".dropzone"),
  ]);
  await fileChooser.accept([wav]);
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes("Media decoded locally")), 30000, "media decode");
  console.log("[3] media decoded to 16k PCM");

  // 4. Load model
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load model");
    btn?.click();
  });
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes("Model ready.")), 600000, "model load");
  console.log("[4] model loaded (tiny.en)");

  const logs = await page.evaluate(() => document.querySelector(".logs pre")?.textContent ?? "");
  if (logs) console.log("[*] worker logs:", logs.slice(0, 400));

  // 5. Transcribe
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Transcribe"));
    btn?.click();
  });
  await waitFor(
    page,
    () => page.evaluate(() => (document.querySelectorAll(".seg-time").length > 0 ? true : false)),
    600000,
    "transcription result"
  );
  console.log("[5] transcript rendered");

  const result = await page.evaluate(() => {
    const segs = [...document.querySelectorAll(".segments li")].slice(0, 5).map((li) => li.textContent?.trim());
    return {
      count: document.querySelectorAll(".seg-time").length,
      preview: segs,
      text: document.querySelector(".tabs + pre.code")?.textContent ?? null,
      error: document.querySelector(".err")?.textContent ?? null,
      title: document.title,
    };
  });
  console.log("[6] segments:", result.count);
  console.log("[6] preview:", result.preview);
  console.log("[7] transcript text:", result.text?.slice(0, 300) ?? "(null)");
  console.log("[7] on-page error:", result.error);

  const problems = {
    consoleErrors,
    pageErrors,
    failedRequests: failedRequests.filter((u) => !u.includes("favicon")),
  };
  console.log("[8] problems:", JSON.stringify(problems, null, 2));

  if (pageErrors.length || consoleErrors.length || result.error || result.count === 0) {
    console.log("E2E RESULT: FAIL");
    process.exitCode = 1;
  } else {
    console.log("E2E RESULT: PASS");
  }

  await browser.close();
} finally {
  await rm(tmp, { recursive: true, force: true });
  try {
    process.kill(-preview.pid);
  } catch {}
  preview.kill();
}