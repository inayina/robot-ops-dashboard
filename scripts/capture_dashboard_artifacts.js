#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const defaultUrl = process.env.FRONTEND_URL || "http://127.0.0.1:8001/frontend/";
const defaultArtifactsDir = process.env.ARTIFACTS_DIR || path.join(rootDir, "artifacts");

const options = {
  url: defaultUrl,
  artifactsDir: defaultArtifactsDir,
  screenshots: true,
  video: true,
  waitMs: Number(process.env.CAPTURE_WAIT_MS || 3000),
  recordMs: Number(process.env.RECORD_MS || 75000),
  dispatch: false,
  motorDemo: false,
};

function usage() {
  console.log(`用法：
  node scripts/capture_dashboard_artifacts.js [选项]

选项：
  --url URL              Dashboard frontend 地址，默认：${defaultUrl}
  --artifacts-dir PATH   输出目录，默认：${defaultArtifactsDir}
  --no-video             只截图，不录制视频
  --video                只录制视频，不重复截图
  --wait-ms N            页面加载后等待时间，默认：${options.waitMs}
  --record-ms N          录屏时长，默认：${options.recordMs}
  --dispatch             录屏期间点击 Task Dispatch，会创建 Mock WMS task
  --motor-demo           录屏期间调节 Motor slider 并点击 SEND CMD
  -h, --help             显示帮助

默认不会触发任务创建或电机命令。需要录制完整联动时，先启动 backend/frontend，
再显式传入 --dispatch 或 --motor-demo。`);
}

function parseArgs(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--url":
        options.url = argv[++index];
        break;
      case "--artifacts-dir":
        options.artifactsDir = path.resolve(argv[++index]);
        break;
      case "--no-video":
        options.video = false;
        options.screenshots = true;
        break;
      case "--video":
        options.video = true;
        options.screenshots = false;
        break;
      case "--wait-ms":
        options.waitMs = Number(argv[++index]);
        break;
      case "--record-ms":
        options.recordMs = Number(argv[++index]);
        break;
      case "--dispatch":
        options.dispatch = true;
        break;
      case "--motor-demo":
        options.motorDemo = true;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数：${arg}`);
    }
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function waitForDashboard(page) {
  await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#app", { timeout: 15000 });
  await page.waitForTimeout(options.waitMs);
}

async function safeClick(page, selector) {
  const node = page.locator(selector);
  if (await node.count()) {
    await node.first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
  }
}

async function captureScreenshots(page, screenshotsDir) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForDashboard(page);
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-overview-1440x900.png"),
    fullPage: false,
  });

  await safeClick(page, "#wmsRefreshButton");
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-task-dispatch-1440x900.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-recording-frame-1366x768.png"),
    fullPage: false,
  });
}

async function runRecordedWalkthrough(page) {
  await waitForDashboard(page);
  await safeClick(page, "#wmsRefreshButton");

  if (options.dispatch) {
    const dropoff = page.locator("#wmsDropoff");
    if (await dropoff.count()) {
      await dropoff.selectOption("station_a");
    }
    await safeClick(page, "#wmsSubmitButton");
  }

  await page.waitForTimeout(8000);

  if (options.motorDemo) {
    const slider = page.locator("#motorTargetSpeedSlider");
    if (await slider.count()) {
      await slider.fill("0.08");
      await page.waitForTimeout(1000);
      await safeClick(page, "#motorApplyButton");
    }
  }

  const remainingMs = Math.max(0, options.recordMs - 12000);
  await page.waitForTimeout(remainingMs);
}

async function main() {
  parseArgs(process.argv.slice(2));

  const screenshotsDir = path.join(options.artifactsDir, "screenshots");
  const videosDir = path.join(options.artifactsDir, "videos");
  ensureDir(screenshotsDir);
  ensureDir(videosDir);

  const browser = await chromium.launch({ headless: true });

  try {
    if (options.screenshots) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await captureScreenshots(page, screenshotsDir);
      await page.close();
      console.log(`screenshots: ${screenshotsDir}`);
    }

    if (options.video) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: {
          dir: videosDir,
          size: { width: 1440, height: 900 },
        },
      });
      const page = await context.newPage();
      await runRecordedWalkthrough(page);
      const video = page.video();
      await page.close();
      await context.close();

      if (video) {
        const outputPath = path.join(videosDir, "dashboard-demo-walkthrough.webm");
        await video.saveAs(outputPath);
        console.log(`video: ${outputPath}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[capture-dashboard-artifacts] ${error.message}`);
  process.exit(1);
});
