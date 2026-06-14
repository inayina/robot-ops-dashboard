#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
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
  motorDelayMs: Number(process.env.MOTOR_DEMO_DELAY_MS || 30000),
  wmsDemo: false,
  wmsDbPath: process.env.AMR_DB_PATH || "/tmp/robot_ops_full_link/mock_wms.db",
  wmsTarget: process.env.WMS_DEMO_TARGET || "station_a",
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
  --motor-delay-ms N     Motor demo 延迟，默认：${options.motorDelayMs}
  --wms-demo             录屏期间执行上游 AMR Mock WMS station task
  --wms-db PATH          WMS demo SQLite DB，默认：${options.wmsDbPath}
  --wms-target NAME      WMS demo 目标点，默认：${options.wmsTarget}
  -h, --help             显示帮助

默认不会触发任务创建或电机命令。需要录制完整联动时，先启动 backend/frontend，
再显式传入 --dispatch、--wms-demo 或 --motor-demo。`);
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
      case "--motor-delay-ms":
        options.motorDelayMs = Number(argv[++index]);
        break;
      case "--wms-demo":
        options.wmsDemo = true;
        break;
      case "--wms-db":
        options.wmsDbPath = argv[++index];
        break;
      case "--wms-target":
        options.wmsTarget = argv[++index];
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

function startWmsDemoProcess() {
  const scriptPath = path.join(rootDir, "scripts", "run_amr_dashboard_recording_demo.sh");
  const child = spawn(
    "bash",
    [
      scriptPath,
      "--skip-launch",
      "--db",
      options.wmsDbPath,
      options.wmsTarget,
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        AMR_API_PORT: "8010",
        AMR_API_BASE_URL: "http://127.0.0.1:8010",
        DASHBOARD_API_BASE_URL: "http://127.0.0.1:9000",
        AMR_DB_PATH: options.wmsDbPath,
      },
      stdio: "inherit",
    }
  );

  child.on("exit", (code) => {
    console.log(`wms-demo: exited with code ${code}`);
  });
  return child;
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

async function safeScrollIntoView(page, selector) {
  const node = page.locator(selector);
  if (await node.count()) {
    await page.evaluate((targetSelector) => {
      const target = document.querySelector(targetSelector);
      if (!target) {
        return;
      }
      const top = target.getBoundingClientRect().top + window.scrollY - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    }, selector);
    await page.waitForTimeout(800);
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

  await safeScrollIntoView(page, ".motor-flow-card");
  await page.waitForTimeout(1200);
  if (options.motorDemo) {
    const slider = page.locator("#motorTargetSpeedSlider");
    if (await slider.count()) {
      await slider.fill("0.08");
      const timeoutInput = page.locator("#motorTimeoutInput");
      if (await timeoutInput.count()) {
        await timeoutInput.fill("2500");
      }
      await page.waitForTimeout(1000);
      await safeClick(page, "#motorApplyButton");
      await page.waitForTimeout(1600);
    }
  }
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-motor-curve-1440x900.png"),
    fullPage: false,
  });
  if (options.motorDemo) {
    await safeClick(page, "#motorStopButton");
    await page.waitForTimeout(1200);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-recording-frame-1366x768.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await safeScrollIntoView(page, ".evaluation-layer");
  await page.screenshot({
    path: path.join(screenshotsDir, "dashboard-evaluation-platform-1440x900.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await safeScrollIntoView(page, ".portfolio-evaluation-grid");
  await page.locator(".portfolio-evaluation-grid").screenshot({
    path: path.join(screenshotsDir, "dashboard-failure-cases-crop.png"),
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

  if (options.wmsDemo) {
    await page.waitForTimeout(2500);
    startWmsDemoProcess();
  }

  await page.waitForTimeout(options.motorDemo ? options.motorDelayMs : 8000);

  if (options.motorDemo) {
    const slider = page.locator("#motorTargetSpeedSlider");
    if (await slider.count()) {
      await slider.fill("0.08");
      const timeoutInput = page.locator("#motorTimeoutInput");
      if (await timeoutInput.count()) {
        await timeoutInput.fill("2500");
      }
      await page.waitForTimeout(1000);
      await safeClick(page, "#motorApplyButton");
      await page.waitForTimeout(2200);
      await page.screenshot({
        path: path.join(options.artifactsDir, "screenshots", "dashboard-motor-curve-1440x900.png"),
        fullPage: false,
      });
      await page.waitForTimeout(2000);
      await safeClick(page, "#motorStopButton");
      await page.waitForTimeout(2500);
    }
  }

  const remainingMs = Math.max(0, options.recordMs - 12000);
  await page.waitForTimeout(Math.max(0, remainingMs - 6000));
  await safeScrollIntoView(page, ".evaluation-layer");
  await page.waitForTimeout(6000);
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
        const rawVideoPath = await video.path();
        if (rawVideoPath !== outputPath && fs.existsSync(rawVideoPath)) {
          fs.rmSync(rawVideoPath, { force: true });
        }
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
