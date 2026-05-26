const API_BASE_URL = window.API_BASE_URL || "http://127.0.0.1:9000";
const REFRESH_INTERVAL_MS = 3000;
const WS_RECONNECT_DELAY_MS = 3000;
const IMU_STALE_AFTER_MS = 2000;
const IMU_OFFLINE_AFTER_MS = 5000;
const IMU_HISTORY_LIMIT = 30;
const MOTOR_HISTORY_LIMIT = 60;
const MOTOR_WHEEL_DIAMETER_M = 0.065;
const MOTOR_WHEEL_CIRCUMFERENCE_M = Math.PI * MOTOR_WHEEL_DIAMETER_M;
const MOTOR_BENCH_MAX_RPM = 80;
const MOTOR_SPEED_SLIDER_MAX_MPS = 0.25;
const MOTOR_DEFAULT_MAX_PWM = 0.25;
const WS_STATUS_URL = window.WS_STATUS_URL || buildWebSocketUrl(API_BASE_URL, "/ws/status");

const DATA_FILES = {
  tasks: `${API_BASE_URL}/api/tasks`,
  wmsTasks: `${API_BASE_URL}/api/wms/tasks`,
  devices: `${API_BASE_URL}/api/device-status`,
  alerts: `${API_BASE_URL}/api/alerts`,
  robotStatus: `${API_BASE_URL}/api/robot/status`,
  motorCommand: `${API_BASE_URL}/api/robot/motor/cmd`,
};

const WMS_TASK_POINTS = ["station_a", "station_b", "dock_a", "start_zone"];

const taskStatusLabel = {
  queued: "Queued",
  dispatching: "Dispatching",
  running: "Running",
  blocked: "Blocked",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const alertLevelLabel = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

const commStatusLabel = {
  online: "Online",
  intermittent: "Intermittent",
  offline: "Offline",
};

const healthStatusLabel = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Unknown",
};

const rootNodes = {
  generatedAt: document.querySelector("#generatedAt"),
  summaryGrid: document.querySelector("#summaryGrid"),
  tasksMeta: document.querySelector("#tasksMeta"),
  systemMeta: document.querySelector("#systemMeta"),
  systemStatusLabel: document.querySelector("#systemStatusLabel"),
  systemStatusDot: document.querySelector("#systemStatusDot"),
  systemSource: document.querySelector("#systemSource"),
  systemTotalDevices: document.querySelector("#systemTotalDevices"),
  systemOnlineDevices: document.querySelector("#systemOnlineDevices"),
  systemWarningDevices: document.querySelector("#systemWarningDevices"),
  systemCriticalDevices: document.querySelector("#systemCriticalDevices"),
  systemLastUpdate: document.querySelector("#systemLastUpdate"),
  headerRosStatus: document.querySelector("#headerRosStatus"),
  headerMicroRosStatus: document.querySelector("#headerMicroRosStatus"),
  headerMqttStatus: document.querySelector("#headerMqttStatus"),
  previewMode: document.querySelector("#previewMode"),
  linkBackendStatus: document.querySelector("#linkBackendStatus"),
  linkStreamStatus: document.querySelector("#linkStreamStatus"),
  linkImuStatus: document.querySelector("#linkImuStatus"),
  linkImuLatency: document.querySelector("#linkImuLatency"),
  linkMicroRosStatus: document.querySelector("#linkMicroRosStatus"),
  linkMqttStatus: document.querySelector("#linkMqttStatus"),
  linkMotorStatus: document.querySelector("#linkMotorStatus"),
  linkMotorLatency: document.querySelector("#linkMotorLatency"),
  linkBatteryStatus: document.querySelector("#linkBatteryStatus"),
  taskActiveCount: document.querySelector("#taskActiveCount"),
  taskBlockedCount: document.querySelector("#taskBlockedCount"),
  taskCompletedCount: document.querySelector("#taskCompletedCount"),
  taskTotalCount: document.querySelector("#taskTotalCount"),
  taskCurrentId: document.querySelector("#taskCurrentId"),
  taskCurrentStatus: document.querySelector("#taskCurrentStatus"),
  taskCurrentRoute: document.querySelector("#taskCurrentRoute"),
  taskCurrentRobot: document.querySelector("#taskCurrentRobot"),
  taskCurrentSource: document.querySelector("#taskCurrentSource"),
  taskCurrentBlockReason: document.querySelector("#taskCurrentBlockReason"),
  taskProgressValue: document.querySelector("#taskProgressValue"),
  taskProgressFill: document.querySelector("#taskProgressFill"),
  taskCardProgress: document.querySelector("#taskCardProgress"),
  taskCardProgressFill: document.querySelector("#taskCardProgressFill"),
  taskStageValue: document.querySelector("#taskStageValue"),
  taskStepValue: document.querySelector("#taskStepValue"),
  imuMeta: document.querySelector("#imuMeta"),
  imuStatusPanel: document.querySelector("#imuStatusPanel"),
  imuFreshness: document.querySelector("#imuFreshness"),
  imuStatusDot: document.querySelector("#imuStatusDot"),
  imuStatusLabel: document.querySelector("#imuStatusLabel"),
  imuLastUpdateAgo: document.querySelector("#imuLastUpdateAgo"),
  sensorLedNormal: document.querySelector("#sensorLedNormal"),
  sensorLedWarning: document.querySelector("#sensorLedWarning"),
  sensorLedAlarm: document.querySelector("#sensorLedAlarm"),
  sensorLedCurrent: document.querySelector("#sensorLedCurrent"),
  sensorLedLastUpdate: document.querySelector("#sensorLedLastUpdate"),
  imuSource: document.querySelector("#imuSource"),
  imuRosTopic: document.querySelector("#imuRosTopic"),
  imuMqttTopic: document.querySelector("#imuMqttTopic"),
  imuLastMessageAt: document.querySelector("#imuLastMessageAt"),
  imuAttitudeCube: document.querySelector("#imuAttitudeCube"),
  imuEmptyHint: document.querySelector("#imuEmptyHint"),
  imuAttitudeSource: document.querySelector("#imuAttitudeSource"),
  imuRollValue: document.querySelector("#imuRollValue"),
  imuPitchValue: document.querySelector("#imuPitchValue"),
  imuYawValue: document.querySelector("#imuYawValue"),
  imuRollMarker: document.querySelector("#imuRollMarker"),
  imuPitchMarker: document.querySelector("#imuPitchMarker"),
  imuYawMarker: document.querySelector("#imuYawMarker"),
  imuTrendSampleCount: document.querySelector("#imuTrendSampleCount"),
  imuAccelValue: document.querySelector("#imuAccelValue"),
  imuGyroValue: document.querySelector("#imuGyroValue"),
  imuTemperatureValue: document.querySelector("#imuTemperatureValue"),
  imuStateValue: document.querySelector("#imuStateValue"),
  imuErrorNote: document.querySelector("#imuErrorNote"),
  motorMeta: document.querySelector("#motorMeta"),
  motorStatusLabel: document.querySelector("#motorStatusLabel"),
  motorStatusDot: document.querySelector("#motorStatusDot"),
  motorSource: document.querySelector("#motorSource"),
  motorMqttTopic: document.querySelector("#motorMqttTopic"),
  motorLastMessageAt: document.querySelector("#motorLastMessageAt"),
  motorTrendSampleCount: document.querySelector("#motorTrendSampleCount"),
  motorTrendPlaceholder: document.querySelector("#motorTrendPlaceholder"),
  cmdCard: document.querySelector(".cmd-card"),
  motorCommandForm: document.querySelector("#motorCommandForm"),
  motorEnableSwitch: document.querySelector("#motorEnableSwitch"),
  motorTargetRpmInput: document.querySelector("#motorTargetRpmInput"),
  motorMaxPwmInput: document.querySelector("#motorMaxPwmInput"),
  motorTargetSpeedSlider: document.querySelector("#motorTargetSpeedSlider"),
  motorTargetSpeedInputValue: document.querySelector("#motorTargetSpeedInputValue"),
  motorTargetRpmInputValue: document.querySelector("#motorTargetRpmInputValue"),
  motorDirectionInputValue: document.querySelector("#motorDirectionInputValue"),
  motorTimeoutInput: document.querySelector("#motorTimeoutInput"),
  motorApplyButton: document.querySelector("#motorApplyButton"),
  motorStopButton: document.querySelector("#motorStopButton"),
  motorCommandMessage: document.querySelector("#motorCommandMessage"),
  motorTargetWheelSpeed: document.querySelector("#motorTargetWheelSpeed"),
  motorActualWheelSpeed: document.querySelector("#motorActualWheelSpeed"),
  motorMeasuredRpm: document.querySelector("#motorMeasuredRpm"),
  motorTargetRpm: document.querySelector("#motorTargetRpm"),
  motorErrorRpm: document.querySelector("#motorErrorRpm"),
  motorPwmValue: document.querySelector("#motorPwmValue"),
  motorDirectionValue: document.querySelector("#motorDirectionValue"),
  motorWheelStatusValue: document.querySelector("#motorWheelStatusValue"),
  motorBenchLimitValue: document.querySelector("#motorBenchLimitValue"),
  motorEnabledValue: document.querySelector("#motorEnabledValue"),
  motorClosedLoopValue: document.querySelector("#motorClosedLoopValue"),
  motorFaultValue: document.querySelector("#motorFaultValue"),
  motorCommandSource: document.querySelector("#motorCommandSource"),
  motorMaxPwmValue: document.querySelector("#motorMaxPwmValue"),
  motorTimeoutMsValue: document.querySelector("#motorTimeoutMsValue"),
  motorSafetyFlags: document.querySelector("#motorSafetyFlags"),
  motorLoop: document.querySelector("#motorLoop"),
  motorStateJsonValue: document.querySelector("#motorStateJsonValue"),
  motorBenchEnabled: document.querySelector("#motorBenchEnabled"),
  motorSafetyMode: document.querySelector("#motorSafetyMode"),
  motorTargetTicks: document.querySelector("#motorTargetTicks"),
  motorMeasuredTicks: document.querySelector("#motorMeasuredTicks"),
  motorEncoderCount: document.querySelector("#motorEncoderCount"),
  motorInvalidTransitions: document.querySelector("#motorInvalidTransitions"),
  motorStateValue: document.querySelector("#motorStateValue"),
  robotInfoId: document.querySelector("#robotInfoId"),
  robotInfoFirmware: document.querySelector("#robotInfoFirmware"),
  robotInfoRuntime: document.querySelector("#robotInfoRuntime"),
  robotInfoIp: document.querySelector("#robotInfoIp"),
  robotInfoMqttTopic: document.querySelector("#robotInfoMqttTopic"),
  pipelineEsp32: document.querySelector("#pipelineEsp32"),
  pipelineMicroRos: document.querySelector("#pipelineMicroRos"),
  pipelineRos: document.querySelector("#pipelineRos"),
  pipelineMqtt: document.querySelector("#pipelineMqtt"),
  pipelineBackend: document.querySelector("#pipelineBackend"),
  pipelineFrontend: document.querySelector("#pipelineFrontend"),
  safetyStatusValue: document.querySelector("#safetyStatusValue"),
  eventStreamMeta: document.querySelector("#eventStreamMeta"),
  eventStreamList: document.querySelector("#eventStreamList"),
  dataMode: document.querySelector("#dataMode"),
  connectionMessage: document.querySelector("#connectionMessage"),
  wsStatus: document.querySelector("#wsStatus"),
  wsMessage: document.querySelector("#wsMessage"),
  wmsTaskForm: document.querySelector("#wmsTaskForm"),
  wmsTaskType: document.querySelector("#wmsTaskType"),
  wmsPickup: document.querySelector("#wmsPickup"),
  wmsDropoff: document.querySelector("#wmsDropoff"),
  wmsSubmitButton: document.querySelector("#wmsSubmitButton"),
  wmsRefreshButton: document.querySelector("#wmsRefreshButton"),
  wmsTaskMessage: document.querySelector("#wmsTaskMessage"),
  wmsTasksTable: document.querySelector("#wmsTasksTable"),
};

const cachedPayloads = {
  tasks: null,
  wmsTasks: null,
  devices: null,
  alerts: null,
  robotStatus: null,
};

let refreshInFlight = false;
let latestImuSnapshot = null;
let latestImuRenderOptions = {};
let latestMotorSnapshot = null;
let latestMotorRenderOptions = {};
const imuHistory = [];
const motorHistory = [];
const eventStreamKeys = new Set();
const websocketState = {
  socket: null,
  reconnectTimer: null,
  connected: false,
  lastMessageAt: null,
};
const transportState = {
  backendConnected: false,
  streamConnected: false,
};
let motorControlsBusy = false;

setupWmsTaskControls();
setupMotorCommandControls();
renderImuStatus(null, { loading: true });
renderMotorStatus(null, { loading: true });
appendEventStreamEntry({
  key: "dashboard-start",
  status: "info",
  title: "Dashboard frontend loaded",
  detail: "Waiting for dashboard data",
});
init();
loadWmsTasks();
connectStatusWebSocket();
window.setInterval(init, REFRESH_INTERVAL_MS);
window.setInterval(refreshImuDisplay, 1000);
window.setInterval(refreshMotorDisplay, 1000);

async function init() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;

  try {
    const [tasksResult, devicesResult, alertsResult, robotStatusResult] = await Promise.allSettled([
      fetchJson(DATA_FILES.tasks),
      fetchJson(DATA_FILES.devices),
      fetchJson(DATA_FILES.alerts),
      fetchJson(DATA_FILES.robotStatus),
    ]);

    const failures = [
      syncSection("tasks", tasksResult, renderTasks, rootNodes.tasksMeta, "任务"),
      syncSection("devices", devicesResult, renderDevices, rootNodes.systemMeta, "设备状态"),
      syncSection("alerts", alertsResult, renderAlerts, rootNodes.eventStreamMeta, "告警"),
    ].filter(Boolean);

    syncRobotStatus(robotStatusResult);

    if (cachedPayloads.tasks && cachedPayloads.devices && cachedPayloads.alerts) {
      renderSummary(cachedPayloads.tasks, cachedPayloads.devices, cachedPayloads.alerts, failures);
    } else {
      renderSummaryUnavailable(failures);
    }

    renderConnectionStatus(
      failures.length === 0,
      failures.length === 0
        ? `Dashboard backend connected: ${API_BASE_URL} · tasks source: ${
            cachedPayloads.tasks?.source || "-"
          }`
        : `Dashboard backend unavailable: ${truncateText(failures.join(" | "), 180)}`
    );
  } finally {
    refreshInFlight = false;
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await buildHttpError(response, path));
  }
  return response.json();
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildHttpError(response, path));
  }

  return response.json();
}

async function buildHttpError(response, path) {
  let detail = "";
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      detail =
        payload?.detail?.detail ||
        payload?.detail?.error_type ||
        payload?.detail ||
        payload?.message ||
        "";
    } catch (_error) {
      detail = "";
    }
  } else {
    try {
      detail = (await response.text()).trim();
    } catch (_error) {
      detail = "";
    }
  }

  return detail ? `Failed to fetch ${path}: ${response.status} ${detail}` : `Failed to fetch ${path}: ${response.status}`;
}

function syncSection(key, result, renderFn, metaNode, label) {
  if (result.status === "fulfilled") {
    cachedPayloads[key] = result.value;
    renderFn(result.value);
    return "";
  }

  const errorMessage = normalizeError(result.reason);

  if (cachedPayloads[key]) {
    renderFn(cachedPayloads[key], {
      stale: true,
      errorMessage,
    });
    return `${label}: ${errorMessage}`;
  }

  if (metaNode) {
    metaNode.textContent = "unavailable";
    metaNode.dataset.state = "error";
  }
  renderFn(null, {
    errorMessage,
    unavailable: true,
  });
  appendEventStreamEntry({
    key: `${key}-unavailable-${errorMessage}`,
    status: "error",
    title: `${label} disconnected`,
    detail: summarizeErrorForDisplay(errorMessage),
  });
  return `${label}: ${errorMessage}`;
}

function syncRobotStatus(result) {
  if (result.status === "fulfilled") {
    cachedPayloads.robotStatus = result.value;
    updateImuSnapshot(extractImuSnapshotFromRobotStatus(result.value), {
      sourceMode: "http",
    });
    updateMotorSnapshot(extractMotorSnapshotFromRobotStatus(result.value), {
      sourceMode: "http",
    });
    return;
  }

  const errorMessage = normalizeError(result.reason);
  if (cachedPayloads.robotStatus) {
    updateImuSnapshot(extractImuSnapshotFromRobotStatus(cachedPayloads.robotStatus), {
      sourceMode: "http-cache",
      errorMessage,
    });
    updateMotorSnapshot(extractMotorSnapshotFromRobotStatus(cachedPayloads.robotStatus), {
      sourceMode: "http-cache",
      errorMessage,
    });
    return;
  }

  updateImuSnapshot(null, {
    sourceMode: "http",
    errorMessage,
  });
  updateMotorSnapshot(null, {
    sourceMode: "http",
    errorMessage,
  });
}

function updateImuSnapshot(snapshot, options = {}) {
  latestImuSnapshot = snapshot;
  latestImuRenderOptions = options;
  recordImuHistorySample(snapshot);
  renderImuStatus(snapshot, options);
}

function updateMotorSnapshot(snapshot, options = {}) {
  latestMotorSnapshot = snapshot;
  latestMotorRenderOptions = options;
  recordMotorHistorySample(snapshot);
  renderMotorStatus(snapshot, options);
}

function refreshImuDisplay() {
  if (!rootNodes.imuStatusPanel) {
    return;
  }

  renderImuStatus(latestImuSnapshot, latestImuRenderOptions);
}

function refreshMotorDisplay() {
  if (!rootNodes.motorMeta) {
    return;
  }

  renderMotorStatus(latestMotorSnapshot, latestMotorRenderOptions);
}

function extractImuSnapshotFromRobotStatus(payload) {
  const topicMessage = payload?.topics?.["robot/imu"] || null;
  const robotStateMessage = payload?.topics?.["robot/state"] || null;
  const imuPayload = payload?.robot?.imu ?? topicMessage?.payload ?? null;
  const robotStatePayload = payload?.robot?.state ?? robotStateMessage?.payload ?? null;

  return {
    topic: "robot/imu",
    source: payload?.source || "http:/api/robot/status",
    generated_at: payload?.generated_at || null,
    connection: payload?.connection || null,
    message: topicMessage,
    payload: imuPayload,
    robot_state: {
      topic: "robot/state",
      message: robotStateMessage,
      payload: robotStatePayload,
      last_seen: robotStateMessage?.received_at || pickTimestampFromPayload(robotStatePayload),
    },
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(imuPayload),
  };
}

function extractImuSnapshotFromStatusMessage(payload) {
  const mqttStatus = payload?.robot?.mqtt || null;
  const topicMessage = mqttStatus?.topics?.["robot/imu"] || null;
  const robotStateMessage = mqttStatus?.topics?.["robot/state"] || null;
  const imuPayload = payload?.imu ?? mqttStatus?.robot?.imu ?? topicMessage?.payload ?? null;
  const robotStatePayload = mqttStatus?.robot?.state ?? robotStateMessage?.payload ?? null;

  return {
    topic: "robot/imu",
    source: mqttStatus?.source || "websocket:/ws/status",
    generated_at: mqttStatus?.generated_at || payload?.timestamp || null,
    connection: mqttStatus?.connection || null,
    message: topicMessage,
    payload: imuPayload,
    robot_state: {
      topic: "robot/state",
      message: robotStateMessage,
      payload: robotStatePayload,
      last_seen: robotStateMessage?.received_at || pickTimestampFromPayload(robotStatePayload),
    },
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(imuPayload),
  };
}

function extractMotorSnapshotFromRobotStatus(payload) {
  const topicMessage = payload?.topics?.["robot/motor/status"] || null;
  const motorPayload = payload?.robot?.motor_status ?? topicMessage?.payload ?? null;

  return {
    topic: "robot/motor/status",
    source: payload?.source || "http:/api/robot/status",
    generated_at: payload?.generated_at || null,
    connection: payload?.connection || null,
    message: topicMessage,
    payload: motorPayload,
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(motorPayload),
  };
}

function extractMotorSnapshotFromStatusMessage(payload) {
  const mqttStatus = payload?.robot?.mqtt || null;
  const topicMessage = mqttStatus?.topics?.["robot/motor/status"] || null;
  const motorPayload = payload?.motor ?? mqttStatus?.robot?.motor_status ?? topicMessage?.payload ?? null;

  return {
    topic: "robot/motor/status",
    source: mqttStatus?.source || "websocket:/ws/status",
    generated_at: mqttStatus?.generated_at || payload?.timestamp || null,
    connection: mqttStatus?.connection || null,
    message: topicMessage,
    payload: motorPayload,
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(motorPayload),
  };
}

function renderImuStatus(snapshot, options = {}) {
  if (!rootNodes.imuMeta || !rootNodes.imuStatusPanel) {
    return;
  }

  if (options.loading) {
    rootNodes.imuMeta.textContent = "waiting for /api/robot/status or /ws/status";
    rootNodes.imuMeta.dataset.state = "ok";
  }

  const view = buildImuViewModel(snapshot);
  const metaSegments = [`IMU ${view.linkLabel}`, `ROS ${view.rosTopic}`, `MQTT ${view.mqttTopic}`];

  if (options.sourceMode === "http-cache") {
    metaSegments.push("cached HTTP snapshot");
  } else if (options.realtime) {
    metaSegments.push("status stream");
  } else if (options.sourceMode === "http") {
    metaSegments.push("HTTP polling");
  }

  rootNodes.imuMeta.textContent = metaSegments.join(" · ");
  rootNodes.imuMeta.dataset.state = options.errorMessage || view.linkStatus === "offline" ? "error" : "ok";

  setText(rootNodes.imuStatusLabel, view.linkLabel);
  setStateClass(rootNodes.imuFreshness, "imu-freshness", view.linkStatus);
  setStateClass(rootNodes.imuStatusDot, "status-dot", view.linkStatus);
  setText(rootNodes.imuLastUpdateAgo, view.lastUpdateAgo);
  renderSensorStatusLeds(view.sensorStatus);
  setText(rootNodes.imuSource, view.source);
  setText(rootNodes.imuRosTopic, view.rosTopic);
  setText(rootNodes.imuMqttTopic, view.mqttTopic);
  setText(rootNodes.imuLastMessageAt, view.lastMessageAt);
  setText(rootNodes.imuAttitudeSource, view.attitude.sourceLabel);
  setAngleRow(rootNodes.imuRollValue, rootNodes.imuRollMarker, view.attitude.roll);
  setAngleRow(rootNodes.imuPitchValue, rootNodes.imuPitchMarker, view.attitude.pitch);
  setAngleRow(rootNodes.imuYawValue, rootNodes.imuYawMarker, view.attitude.yaw);
  setText(rootNodes.imuTrendSampleCount, `${imuHistory.length}/${IMU_HISTORY_LIMIT} samples`);
  setText(rootNodes.imuAccelValue, formatVectorTriplet(view.accel));
  setText(rootNodes.imuGyroValue, formatVectorTriplet(view.gyro));
  setText(rootNodes.imuTemperatureValue, formatSensorValue(view.temperature, " C"));
  setText(rootNodes.imuStateValue, view.state);
  setText(rootNodes.imuErrorNote, options.errorMessage ? "Telemetry unavailable; see Event Log" : "");
  if (rootNodes.imuEmptyHint) {
    rootNodes.imuEmptyHint.classList.toggle("visible", !view.hasPayload);
  }

  if (rootNodes.imuAttitudeCube) {
    const roll = view.attitude.roll.value || 0;
    const pitch = view.attitude.pitch.value || 0;
    const yaw = view.attitude.yaw.value || 0;
    rootNodes.imuAttitudeCube.style.transform = `rotateZ(${yaw}deg) rotateX(${pitch}deg) rotateY(${roll}deg)`;
  }

  window.requestAnimationFrame(() => {
    renderImuTrendCanvas();
  });

  refreshLinkBoard();
  refreshRobotInfo();
}

function renderMotorStatus(snapshot, options = {}) {
  if (!rootNodes.motorMeta) {
    return;
  }

  if (options.loading) {
    rootNodes.motorMeta.textContent = "waiting for /api/robot/status or /ws/status";
    rootNodes.motorMeta.dataset.state = "ok";
  }

  const view = buildMotorViewModel(snapshot);
  const metaSegments = [`Motor ${view.linkLabel}`, `MQTT ${view.mqttTopic}`];

  if (options.sourceMode === "http-cache") {
    metaSegments.push("cached HTTP snapshot");
  } else if (options.realtime) {
    metaSegments.push("status stream");
  } else if (options.sourceMode === "http") {
    metaSegments.push("HTTP polling");
  }

  rootNodes.motorMeta.textContent = metaSegments.join(" · ");
  rootNodes.motorMeta.dataset.state = options.errorMessage || view.linkStatus === "offline" ? "error" : "ok";

  setText(rootNodes.motorStatusLabel, view.linkLabel);
  setStateClass(rootNodes.motorStatusDot, "status-dot", view.linkStatus);
  setText(rootNodes.motorSource, `source: ${view.source}`);
  setText(rootNodes.motorMqttTopic, view.mqttTopic);
  setText(rootNodes.motorLastMessageAt, view.lastMessageAt);
  setText(rootNodes.motorTrendSampleCount, `${motorHistory.length}/${MOTOR_HISTORY_LIMIT} samples`);
  setText(rootNodes.motorTargetWheelSpeed, view.targetWheelSpeed);
  setText(rootNodes.motorActualWheelSpeed, view.actualWheelSpeed);
  setText(rootNodes.motorMeasuredRpm, view.measuredRpm);
  setText(rootNodes.motorTargetRpm, view.targetRpm);
  setText(rootNodes.motorErrorRpm, view.errorRpm);
  setText(rootNodes.motorPwmValue, view.pwm);
  setText(rootNodes.motorDirectionValue, view.direction);
  setText(rootNodes.motorWheelStatusValue, view.wheelStatus);
  setText(rootNodes.motorBenchLimitValue, view.benchLimit);
  setText(rootNodes.motorEnabledValue, view.enabled);
  setText(rootNodes.motorClosedLoopValue, view.closedLoop);
  setText(rootNodes.motorFaultValue, view.fault);
  setText(rootNodes.motorCommandSource, view.commandSource);
  setText(rootNodes.motorMaxPwmValue, view.maxPwm);
  setText(rootNodes.motorTimeoutMsValue, view.timeoutMs);
  setText(rootNodes.motorSafetyFlags, view.safetyFlags);
  setText(rootNodes.motorLoop, view.loop);
  setText(rootNodes.motorStateJsonValue, view.motorStateRaw);
  setText(rootNodes.motorBenchEnabled, view.benchEnabled);
  setText(rootNodes.motorSafetyMode, view.safetyMode);
  setText(rootNodes.motorTargetTicks, view.targetTicksPerSec);
  setText(rootNodes.motorMeasuredTicks, view.measuredTicksPerSec);
  setText(rootNodes.motorEncoderCount, view.encoderCount);
  setText(rootNodes.motorInvalidTransitions, view.invalidTransitions);
  setText(rootNodes.motorStateValue, view.state);

  window.requestAnimationFrame(() => {
    renderMotorTrendCanvas();
  });

  refreshLinkBoard();
  refreshRobotInfo();
  refreshMotorControlAvailability();
}

function buildMotorViewModel(snapshot) {
  const payload = snapshot?.payload || null;
  const motorState = extractMotorStatePayload(payload);
  const motorStateView = Object.keys(motorState).length ? motorState : payload || {};
  const lastSeenDate = parseDateTime(snapshot?.last_seen);
  const linkStatus = computeImuLinkStatus(snapshot, lastSeenDate);
  const payloadState = extractImuPayloadState(payload);
  const motorStatus = pickFirstString(payload, ["status"]);
  const freshness = isObjectRecord(payload?.freshness) ? payload.freshness : {};
  const motorStateFreshness = isObjectRecord(freshness.motor_state) ? freshness.motor_state : {};
  const actualRpmFreshness = isObjectRecord(freshness.actual_rpm) ? freshness.actual_rpm : {};
  const lastMessageAt =
    motorStateFreshness.last_received_time ||
    actualRpmFreshness.last_received_time ||
    payload?.last_update_time ||
    snapshot?.connection?.last_message_at ||
    snapshot?.last_seen;
  const displayStatus = buildMotorDisplayStatus(linkStatus, motorStatus);
  const actualRpmRaw =
    pickFirstValue(payload, ["measured_rpm", "actual_rpm", "actualRpm"]) ??
    pickFirstValue(motorState, ["measured_rpm", "actual_rpm", "actualRpm"]);
  const targetRpmRaw =
    pickFirstValue(motorState, ["target_rpm", "targetRpm"]) ??
    pickFirstValue(payload, ["target_rpm", "targetRpm"]);
  const targetSpeedRaw =
    pickFirstValue(payload, ["target_speed_mps", "targetSpeedMps"]) ??
    pickFirstValue(motorState, ["target_speed_mps", "targetSpeedMps"]) ??
    rpmToWheelSpeed(targetRpmRaw);
  const actualSpeedRaw =
    pickFirstValue(payload, ["actual_speed_mps", "actualSpeedMps", "measured_speed_mps", "measuredSpeedMps"]) ??
    pickFirstValue(motorState, ["actual_speed_mps", "actualSpeedMps", "measured_speed_mps", "measuredSpeedMps"]) ??
    rpmToWheelSpeed(actualRpmRaw);

  return {
    hasPayload: Boolean(payload),
    linkStatus: displayStatus.dotState,
    linkLabel: displayStatus.label,
    source: snapshot?.source || "-",
    mqttTopic: snapshot?.topic || "robot/motor/status",
    lastMessageAt: formatDate(lastMessageAt),
    targetWheelSpeed: formatSpeedMps(targetSpeedRaw),
    actualWheelSpeed: formatSpeedMps(actualSpeedRaw),
    measuredRpm: formatRpm(actualRpmRaw),
    targetRpm: formatRpm(targetRpmRaw),
    errorRpm: formatMotorNumber(pickFirstValue(motorState, ["error_rpm", "errorRpm"]) ?? pickFirstValue(payload, ["error_rpm", "errorRpm"])),
    pwm: formatMotorNumber(
      pickFirstValue(payload, ["pwm", "pwm_duty", "pwmDuty"]) ??
        pickFirstValue(motorState, ["pwm", "pwm_duty", "pwmDuty"])
    ),
    direction: formatMotorDirection(
      pickFirstValue(payload, ["direction", "motor_direction", "motorDirection"]) ??
        pickFirstValue(motorState, ["direction", "motor_direction", "motorDirection"]) ??
        targetRpmRaw
    ),
    wheelStatus: buildWheelBenchStatus({
      hasPayload: Boolean(payload),
      linkStatus,
      targetRpm: targetRpmRaw,
      actualRpm: actualRpmRaw,
      motorState: motorStateView,
      motorStatus,
    }),
    benchLimit: `max ${MOTOR_BENCH_MAX_RPM} rpm`,
    enabled: formatBooleanLike(
      pickFirstValue(payload, ["enabled", "control_enabled", "controlEnabled"]) ??
        pickFirstValue(motorState, ["enabled", "control_enabled", "controlEnabled"])
    ),
    closedLoop: formatBooleanLike(
      pickFirstValue(payload, ["closed_loop", "closedLoop"]) ??
        pickFirstValue(motorState, ["closed_loop", "closedLoop"])
    ),
    fault: formatBooleanLike(
      pickFirstValue(payload, ["fault", "fault_active", "faultActive"]) ??
        pickFirstValue(motorState, ["fault", "fault_active", "faultActive"])
    ),
    commandSource:
      pickFirstString(motorStateView, ["source", "active_source", "activeSource"]) || "-",
    maxPwm: formatMotorNumber(
      pickFirstValue(payload, ["max_pwm", "maxPwm"]) ??
        pickFirstValue(motorState, ["max_pwm", "maxPwm"])
    ),
    timeoutMs: formatMotorNumber(
      pickFirstValue(payload, ["command_timeout_ms", "timeout_ms"]) ??
        pickFirstValue(motorState, ["command_timeout_ms", "timeout_ms"])
    ),
    safetyFlags: formatMotorSafetyFlags(motorStateView),
    loop: formatMotorNumber(pickFirstValue(motorStateView, ["loop", "loop_count", "loopCount"])),
    motorStateRaw: truncateText(formatMotorStateRaw(payload?.motor_state), 120),
    benchEnabled: formatBooleanLike(pickFirstValue(payload, ["bench_enabled", "benchEnabled"]) ?? pickFirstValue(motorState, ["bench_enabled", "benchEnabled"])),
    targetTicksPerSec: formatMotorNumber(pickFirstValue(payload, ["target_ticks_per_sec", "targetTicksPerSec"]) ?? pickFirstValue(motorState, ["target_ticks_per_sec", "targetTicksPerSec"])),
    measuredTicksPerSec: formatMotorNumber(pickFirstValue(payload, ["measured_ticks_per_sec", "measuredTicksPerSec"]) ?? pickFirstValue(motorState, ["measured_ticks_per_sec", "measuredTicksPerSec"])),
    encoderCount: formatMotorNumber(pickFirstValue(payload, ["encoder_count", "encoderCount"]) ?? pickFirstValue(motorState, ["encoder_count", "encoderCount"])),
    invalidTransitions: formatMotorNumber(pickFirstValue(payload, ["invalid_transitions", "invalidTransitions"]) ?? pickFirstValue(motorState, ["invalid_transitions", "invalidTransitions"])),
    safetyMode: pickFirstString(payload, ["safety_mode", "safetyMode"]) || pickFirstString(motorState, ["safety_mode", "safetyMode"]) || "-",
    state: displayStatus.stateText || (linkStatus === "online" ? payloadState || "online" : linkStatus),
  };
}

function buildMotorDisplayStatus(linkStatus, motorStatus) {
  if (linkStatus === "offline") {
    return { label: "Offline", dotState: "offline", stateText: "offline" };
  }

  const status = String(motorStatus || "").toLowerCase();
  if (status === "reserved") {
    return { label: "Reserved", dotState: "stale", stateText: "reserved" };
  }
  if (status === "missing") {
    return { label: "Missing", dotState: "stale", stateText: "missing" };
  }
  if (status === "stale") {
    return { label: "Stale", dotState: "stale", stateText: "stale" };
  }
  if (status === "stopped" || status === "stop") {
    return { label: "Stopped", dotState: "stale", stateText: "stopped" };
  }
  if (status === "fault" || status === "error") {
    return { label: "Fault", dotState: "offline", stateText: status };
  }
  if (status === "ok" || status === "online") {
    return { label: "Online", dotState: "online", stateText: status };
  }

  return {
    label: linkStatus === "online" ? "Online" : "Stale",
    dotState: linkStatus,
    stateText: status || linkStatus,
  };
}

function extractMotorStatePayload(payload) {
  if (!isObjectRecord(payload)) {
    return {};
  }

  const motorState = payload.motor_state ?? payload.motorState;
  if (isObjectRecord(motorState)) {
    return motorState;
  }

  if (typeof motorState === "string") {
    const parsed = parseJsonObjectString(motorState);
    return parsed || {};
  }

  return {};
}

function parseJsonObjectString(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isObjectRecord(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function formatMotorStateRaw(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (isObjectRecord(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatMotorSafetyFlags(motorState) {
  if (!isObjectRecord(motorState)) {
    return "- / - / -";
  }

  return [
    formatBooleanLike(pickFirstValue(motorState, ["timeout", "timeout_active", "timeoutActive"])),
    formatBooleanLike(pickFirstValue(motorState, ["stop", "estop", "estop_active", "estopActive"])),
    formatBooleanLike(pickFirstValue(motorState, ["fault", "fault_active", "faultActive"])),
  ].join(" / ");
}

function buildWheelBenchStatus({ hasPayload, linkStatus, targetRpm, actualRpm, motorState, motorStatus }) {
  if (!hasPayload || linkStatus === "offline") {
    return "no data";
  }

  if (isTruthyFlag(pickFirstValue(motorState, ["timeout", "timeout_active", "timeoutActive"]))) {
    return "timeout";
  }

  if (isTruthyFlag(pickFirstValue(motorState, ["saturated", "saturation", "is_saturated", "isSaturated"]))) {
    return "saturated";
  }

  const status = String(motorStatus || "").toLowerCase();
  if (status === "timeout") {
    return "timeout";
  }
  if (status === "saturated") {
    return "saturated";
  }
  if (status === "stopped" || status === "stop") {
    return "stopped";
  }

  const target = Math.abs(toFiniteNumber(targetRpm) || 0);
  const actual = Math.abs(toFiniteNumber(actualRpm) || 0);
  if (target < 0.5 && actual < 0.5) {
    return "stopped";
  }

  return "tracking";
}

function formatMotorDirection(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue !== undefined) {
    if (numericValue > 0) {
      return "forward";
    }
    if (numericValue < 0) {
      return "reverse";
    }
    return "stop";
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (["forward", "fwd", "cw", "1"].includes(normalized)) {
    return "forward";
  }
  if (["reverse", "rev", "ccw", "-1"].includes(normalized)) {
    return "reverse";
  }
  if (["stop", "stopped", "0"].includes(normalized)) {
    return "stop";
  }

  return "-";
}

function isTruthyFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

function buildImuViewModel(snapshot) {
  const payload = snapshot?.payload || null;
  const lastSeenDate = parseDateTime(snapshot?.last_seen);
  const lastMessageDate = parseDateTime(snapshot?.connection?.last_message_at) || lastSeenDate;
  const linkStatus = computeImuLinkStatus(snapshot, lastSeenDate);
  const payloadState = extractImuPayloadState(payload);
  const accel = extractVector(payload, {
    groupKeys: ["accel", "acceleration", "accelerometer", "linear_acceleration"],
    flatPrefixes: ["accel", "acceleration", "accelerometer", "linear_acceleration"],
    shortPrefix: "a",
  });
  const gyro = extractVector(payload, {
    groupKeys: ["gyro", "gyroscope", "angular_velocity"],
    flatPrefixes: ["gyro", "gyroscope", "angular_velocity"],
    shortPrefix: "g",
  });
  const attitude = extractAttitude(payload);
  const rosTopic = pickFirstString(payload, ["ros_topic", "topic", "source_topic"]) || "-";
  const payloadSource = pickFirstString(payload, ["source", "source_type"]) || snapshot?.source || "-";
  const sensorStatus = buildSensorStatusView(snapshot?.robot_state);

  return {
    hasPayload: Boolean(payload),
    linkStatus,
    linkLabel: linkStatus === "online" ? "Online" : linkStatus === "stale" ? "Stale" : "Offline",
    source: payloadSource,
    rosTopic,
    mqttTopic: snapshot?.topic || "robot/imu",
    lastMessageAt: formatDate(snapshot?.connection?.last_message_at || snapshot?.last_seen),
    lastUpdateAgo: lastSeenDate ? formatElapsedFixed(lastSeenDate) : "--.-s",
    lastSeen: formatLastSeen(snapshot?.last_seen, lastSeenDate),
    lastSeenDate,
    lastMessageDate,
    accel,
    gyro,
    attitude,
    temperature: pickFirstValue(payload, ["temperature", "temperature_c", "temp_c", "temp", "imu_temperature"]),
    state: linkStatus === "online" ? payloadState || "online" : linkStatus,
    sensorStatus,
  };
}

function renderSensorStatusLeds(sensorStatus) {
  const status = sensorStatus || buildSensorStatusView(null);
  const activeState = status.state;

  setSensorLedBadge(rootNodes.sensorLedNormal, "normal", activeState === "normal");
  setSensorLedBadge(rootNodes.sensorLedWarning, "warning", activeState === "warning");
  setSensorLedBadge(rootNodes.sensorLedAlarm, status.alarmBadgeState, ["alarm", "critical"].includes(activeState));
  setText(rootNodes.sensorLedCurrent, `Current: ${status.label}`);
  setText(rootNodes.sensorLedLastUpdate, `Last update: ${status.lastUpdateLabel}`);
}

function setSensorLedBadge(node, state, isActive) {
  if (!node) {
    return;
  }

  node.className = `sensor-led-badge ${state}${isActive ? " active" : ""}`;
}

function buildSensorStatusView(robotState) {
  const payload = robotState?.payload;
  const lastSeenDate = parseDateTime(robotState?.last_seen);

  if (payload === undefined || payload === null || payload === "" || !lastSeenDate) {
    return {
      state: "no-data",
      label: "No Data",
      alarmBadgeState: "no-data",
      lastUpdateLabel: "--:--:--",
    };
  }

  if (Date.now() - lastSeenDate.getTime() > IMU_OFFLINE_AFTER_MS) {
    return {
      state: "no-data",
      label: "No Data",
      alarmBadgeState: "no-data",
      lastUpdateLabel: formatClockTime(lastSeenDate),
    };
  }

  const mapped = mapRobotStateToSensorStatus(extractRobotStateValue(payload));
  return {
    ...mapped,
    lastUpdateLabel: formatClockTime(lastSeenDate),
  };
}

function extractRobotStateValue(payload) {
  if (!isObjectRecord(payload)) {
    return payload;
  }

  return pickFirstValue(payload, [
    "state",
    "State",
    "status",
    "Status",
    "robot_state",
    "robotState",
    "sensor_state",
    "sensorState",
    "health_status",
    "healthStatus",
    "severity",
    "level",
  ]);
}

function mapRobotStateToSensorStatus(value) {
  if (value === undefined || value === null || value === "") {
    return { state: "no-data", label: "No Data", alarmBadgeState: "no-data" };
  }

  const normalized = String(value).trim().toLowerCase();
  const stateNumber = toFiniteNumber(normalized) ?? extractStateNumber(normalized);

  if (stateNumber === 0 || normalized === "normal" || normalized === "ok" || normalized === "online") {
    return { state: "normal", label: "Normal", alarmBadgeState: "alarm" };
  }
  if (stateNumber === 1 || normalized === "warning" || normalized === "warn") {
    return { state: "warning", label: "Warning", alarmBadgeState: "alarm" };
  }
  if (stateNumber === 2 || normalized === "alarm") {
    return { state: "alarm", label: "Alarm", alarmBadgeState: "alarm" };
  }
  if (stateNumber === 3 || ["severe", "critical", "crit"].includes(normalized)) {
    return { state: "critical", label: "Critical", alarmBadgeState: "critical" };
  }

  if (["missing", "timeout", "timed_out", "no_data", "unknown", "offline"].includes(normalized)) {
    return { state: "no-data", label: "No Data", alarmBadgeState: "no-data" };
  }

  return { state: "no-data", label: "No Data", alarmBadgeState: "no-data" };
}

function extractStateNumber(value) {
  const match = String(value).match(/state\s*:\s*([0-3])/i);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function extractAttitude(payload) {
  const rpy = extractRpyAngles(payload);
  if (rpy) {
    return buildAttitudeView(rpy, "rpy");
  }

  const quaternion = extractQuaternion(payload);
  if (quaternion) {
    return buildAttitudeView(quaternionToEulerDegrees(quaternion), "quaternion");
  }

  return buildAttitudeView({ roll: undefined, pitch: undefined, yaw: undefined }, "waiting");
}

function buildAttitudeView(values, sourceLabel) {
  return {
    sourceLabel,
    roll: buildAngleView(values.roll, 180),
    pitch: buildAngleView(values.pitch, 90),
    yaw: buildAngleView(values.yaw, 180),
  };
}

function buildAngleView(value, range) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return { value: undefined, label: "--.-°", percent: 50 };
  }

  const clamped = Math.max(-range, Math.min(range, numericValue));
  return {
    value: numericValue,
    label: formatSignedFixed(numericValue, 3, 1, "°"),
    percent: ((clamped + range) / (range * 2)) * 100,
  };
}

function extractRpyAngles(payload) {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const roll = pickFirstValue(payload, ["roll", "roll_deg", "rpy_roll", "rpy_roll_deg"]);
  const pitch = pickFirstValue(payload, ["pitch", "pitch_deg", "rpy_pitch", "rpy_pitch_deg"]);
  const yaw = pickFirstValue(payload, ["yaw", "yaw_deg", "heading", "heading_deg", "rpy_yaw", "rpy_yaw_deg"]);

  if ([roll, pitch, yaw].some((value) => toFiniteNumber(value) !== undefined)) {
    return {
      roll: normalizeAngleInput(roll),
      pitch: normalizeAngleInput(pitch),
      yaw: normalizeAngleInput(yaw),
    };
  }

  const group = payload.rpy || payload.euler || payload.attitude;
  if (!isObjectRecord(group)) {
    return null;
  }

  const groupRoll = pickFirstValue(group, ["roll", "x"]);
  const groupPitch = pickFirstValue(group, ["pitch", "y"]);
  const groupYaw = pickFirstValue(group, ["yaw", "z"]);

  if ([groupRoll, groupPitch, groupYaw].some((value) => toFiniteNumber(value) !== undefined)) {
    return {
      roll: normalizeAngleInput(groupRoll),
      pitch: normalizeAngleInput(groupPitch),
      yaw: normalizeAngleInput(groupYaw),
    };
  }

  return null;
}

function extractQuaternion(payload) {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const group = payload.orientation || payload.quaternion || payload.q;
  const x = isObjectRecord(group) ? pickFirstValue(group, ["x", "qx"]) : pickFirstValue(payload, ["orientation_x", "qx", "quat_x"]);
  const y = isObjectRecord(group) ? pickFirstValue(group, ["y", "qy"]) : pickFirstValue(payload, ["orientation_y", "qy", "quat_y"]);
  const z = isObjectRecord(group) ? pickFirstValue(group, ["z", "qz"]) : pickFirstValue(payload, ["orientation_z", "qz", "quat_z"]);
  const w = isObjectRecord(group) ? pickFirstValue(group, ["w", "qw"]) : pickFirstValue(payload, ["orientation_w", "qw", "quat_w"]);

  const quaternion = {
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z),
    w: toFiniteNumber(w),
  };

  if ([quaternion.x, quaternion.y, quaternion.z, quaternion.w].every((value) => value !== undefined)) {
    return quaternion;
  }

  return null;
}

function quaternionToEulerDegrees(quaternion) {
  const x = quaternion.x;
  const y = quaternion.y;
  const z = quaternion.z;
  const w = quaternion.w;

  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return {
    roll: radiansToDegrees(roll),
    pitch: radiansToDegrees(pitch),
    yaw: radiansToDegrees(yaw),
  };
}

function normalizeAngleInput(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return undefined;
  }

  return Math.abs(numericValue) <= Math.PI * 2 ? radiansToDegrees(numericValue) : numericValue;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function recordImuHistorySample(snapshot) {
  const payload = snapshot?.payload;
  const lastSeen = snapshot?.last_seen;
  if (!payload || !lastSeen) {
    return;
  }

  const latest = imuHistory[imuHistory.length - 1];
  if (latest?.key === lastSeen) {
    return;
  }

  const attitude = extractAttitude(payload);
  if ([attitude.roll.value, attitude.pitch.value, attitude.yaw.value].every((value) => value === undefined)) {
    return;
  }

  imuHistory.push({
    key: lastSeen,
    timestamp: lastSeen,
    roll: attitude.roll.value,
    pitch: attitude.pitch.value,
    yaw: attitude.yaw.value,
  });

  if (imuHistory.length > IMU_HISTORY_LIMIT) {
    imuHistory.splice(0, imuHistory.length - IMU_HISTORY_LIMIT);
  }
}

function recordMotorHistorySample(snapshot) {
  const payload = snapshot?.payload;
  if (!isObjectRecord(payload)) {
    return;
  }

  const motorState = extractMotorStatePayload(payload);
  const timestamp =
    snapshot?.last_seen ||
    payload.last_update_time ||
    pickTimestampFromPayload(payload) ||
    snapshot?.generated_at;
  if (!timestamp) {
    return;
  }

  const latest = motorHistory[motorHistory.length - 1];
  if (latest?.key === timestamp) {
    return;
  }

  const targetRpm = toFiniteNumber(
    pickFirstValue(motorState, ["target_rpm", "targetRpm"]) ??
      pickFirstValue(payload, ["target_rpm", "targetRpm"])
  );
  const actualRpm = toFiniteNumber(
    pickFirstValue(payload, ["measured_rpm", "actual_rpm", "actualRpm"]) ??
      pickFirstValue(motorState, ["measured_rpm", "actual_rpm", "actualRpm"])
  );
  const errorRpm =
    toFiniteNumber(
      pickFirstValue(motorState, ["error_rpm", "errorRpm"]) ??
        pickFirstValue(payload, ["error_rpm", "errorRpm"])
    ) ?? (targetRpm !== undefined && actualRpm !== undefined ? targetRpm - actualRpm : undefined);
  const pwm = toFiniteNumber(
    pickFirstValue(payload, ["pwm", "pwm_duty", "pwmDuty"]) ??
      pickFirstValue(motorState, ["pwm", "pwm_duty", "pwmDuty"])
  );
  const maxPwm = toFiniteNumber(
    pickFirstValue(payload, ["max_pwm", "maxPwm"]) ??
      pickFirstValue(motorState, ["max_pwm", "maxPwm"])
  );

  if ([targetRpm, actualRpm, errorRpm, pwm].every((value) => value === undefined)) {
    return;
  }

  motorHistory.push({
    key: timestamp,
    timestamp,
    targetRpm,
    actualRpm,
    errorRpm,
    pwm,
    maxPwm,
    status: pickFirstString(payload, ["status"]) || pickFirstString(motorState, ["status"]),
    enabled:
      pickFirstValue(payload, ["enabled", "control_enabled", "controlEnabled"]) ??
      pickFirstValue(motorState, ["enabled", "control_enabled", "controlEnabled"]),
    closedLoop:
      pickFirstValue(payload, ["closed_loop", "closedLoop"]) ??
      pickFirstValue(motorState, ["closed_loop", "closedLoop"]),
    fault:
      pickFirstValue(payload, ["fault", "fault_active", "faultActive"]) ??
      pickFirstValue(motorState, ["fault", "fault_active", "faultActive"]),
  });

  if (motorHistory.length > MOTOR_HISTORY_LIMIT) {
    motorHistory.shift();
  }
}

function buildImuInfoTile(label, value) {
  return `
    <div class="imu-info-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function buildAttitudeAxisRow(axis, angle) {
  return `
    <div class="attitude-axis">
      <div class="attitude-axis-label">
        <span>${escapeHtml(axis.toUpperCase())}</span>
        <strong>${escapeHtml(angle.label)}</strong>
      </div>
      <div class="attitude-bar">
        <span class="attitude-zero"></span>
        <span class="attitude-marker" style="left:${Math.max(0, Math.min(100, angle.percent))}%"></span>
      </div>
    </div>
  `;
}

function renderImuTrendCanvas() {
  const canvas = document.querySelector("#imuTrendCanvas");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff9f1";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(31, 36, 33, 0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();

  const series = [
    { key: "roll", color: "#205c4f" },
    { key: "pitch", color: "#b87519" },
    { key: "yaw", color: "#32485f" },
  ];

  for (const item of series) {
    drawTrendLine(context, item.key, item.color, width, height);
  }
}

function renderMotorTrendCanvas() {
  const canvas = document.querySelector("#motorTrendCanvas");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff9f1";
  context.fillRect(0, 0, width, height);
  drawMotorTrendGrid(context, width, height);

  if (rootNodes.motorTrendPlaceholder) {
    rootNodes.motorTrendPlaceholder.classList.toggle("visible", motorHistory.length < 2);
  }

  if (motorHistory.length < 2) {
    context.fillStyle = "rgba(31, 36, 33, 0.2)";
    context.font = "16px sans-serif";
    context.textAlign = "center";
    context.fillText("等待电机数据", width / 2, height / 2);
    return;
  }

  const series = [
    { key: "targetRpm", color: "#205c4f", mode: "rpm" },
    { key: "actualRpm", color: "#32485f", mode: "rpm" },
    { key: "pwm", color: "#b87519", mode: "pwm" },
    { key: "errorRpm", color: "#b23a48", mode: "error" },
  ];

  for (const item of series) {
    drawMotorTrendLine(context, item, width, height);
  }
}

function drawMotorTrendGrid(context, width, height) {
  context.strokeStyle = "rgba(31, 36, 33, 0.12)";
  context.lineWidth = 1;

  for (const y of [height * 0.25, height * 0.5, height * 0.75]) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(31, 36, 33, 0.2)";
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
}

function drawMotorTrendLine(context, series, width, height) {
  const values = motorHistory.map((sample) => normalizeMotorTrendValue(sample, series)).filter((value) => value !== undefined);
  if (values.length < 2) {
    return;
  }

  const xStep = width / Math.max(1, MOTOR_HISTORY_LIMIT - 1);
  context.strokeStyle = series.color;
  context.lineWidth = 2;
  context.beginPath();

  let hasPoint = false;
  motorHistory.forEach((sample, index) => {
    const normalized = normalizeMotorTrendValue(sample, series);
    if (normalized === undefined) {
      return;
    }

    const x = index * xStep;
    const y = height - normalized * height;
    if (!hasPoint) {
      context.moveTo(x, y);
      hasPoint = true;
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function normalizeMotorTrendValue(sample, series) {
  const value = toFiniteNumber(sample[series.key]);
  if (value === undefined) {
    return undefined;
  }

  if (series.mode === "pwm") {
    const maxPwm = Math.abs(toFiniteNumber(sample.maxPwm) || 1);
    return Math.max(0, Math.min(1, value / maxPwm));
  }

  const range = MOTOR_BENCH_MAX_RPM;
  const clamped = Math.max(-range, Math.min(range, value));
  return (clamped + range) / (range * 2);
}

function drawTrendLine(context, key, color, width, height) {
  const values = imuHistory.map((sample) => toFiniteNumber(sample[key])).filter((value) => value !== undefined);
  if (values.length < 2) {
    return;
  }

  const range = key === "pitch" ? 90 : 180;
  const xStep = width / Math.max(1, IMU_HISTORY_LIMIT - 1);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();

  let hasPoint = false;
  imuHistory.forEach((sample, index) => {
    const value = toFiniteNumber(sample[key]);
    if (value === undefined) {
      return;
    }
    const clamped = Math.max(-range, Math.min(range, value));
    const x = index * xStep;
    const y = height - ((clamped + range) / (range * 2)) * height;
    if (!hasPoint) {
      context.moveTo(x, y);
      hasPoint = true;
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function computeImuLinkStatus(snapshot, lastSeenDate) {
  if (!snapshot?.payload || !lastSeenDate) {
    return "offline";
  }

  const ageMs = Date.now() - lastSeenDate.getTime();
  if (ageMs > IMU_OFFLINE_AFTER_MS) {
    return "offline";
  }
  if (ageMs > IMU_STALE_AFTER_MS) {
    return "stale";
  }
  return "online";
}

function buildImuMetricRow(label, value, valueIsHtml = false) {
  const valueHtml = valueIsHtml ? value : `<strong>${value}</strong>`;
  return `
    <div class="imu-metric-row">
      <span>${escapeHtml(label)}</span>
      ${valueHtml}
    </div>
  `;
}

function extractImuPayloadState(payload) {
  if (!isObjectRecord(payload)) {
    return payload ? String(payload) : "";
  }

  const value = pickFirstValue(payload, ["state", "status", "imu_state", "health_status"]);
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function pickTimestampFromPayload(payload) {
  return pickFirstValue(payload, ["last_seen", "last_seen_at", "received_at", "timestamp", "ts"]);
}

function extractVector(payload, config) {
  const result = { x: undefined, y: undefined, z: undefined };

  if (!isObjectRecord(payload)) {
    return result;
  }

  for (const groupKey of config.groupKeys) {
    const group = payload[groupKey];
    if (Array.isArray(group)) {
      assignIfMissing(result, "x", group[0]);
      assignIfMissing(result, "y", group[1]);
      assignIfMissing(result, "z", group[2]);
    } else if (isObjectRecord(group)) {
      assignIfMissing(result, "x", pickAxisValue(group, "x"));
      assignIfMissing(result, "y", pickAxisValue(group, "y"));
      assignIfMissing(result, "z", pickAxisValue(group, "z"));
    }
  }

  for (const axis of ["x", "y", "z"]) {
    assignIfMissing(result, axis, pickFirstValue(payload, buildFlatAxisKeys(config.flatPrefixes, axis, config.shortPrefix)));
  }

  return result;
}

function assignIfMissing(target, key, value) {
  if ((target[key] === undefined || target[key] === null) && value !== undefined && value !== null) {
    target[key] = value;
  }
}

function pickAxisValue(group, axis) {
  return pickFirstValue(group, [axis, axis.toUpperCase()]);
}

function buildFlatAxisKeys(prefixes, axis, shortPrefix) {
  const upperAxis = axis.toUpperCase();
  const keys = [];

  for (const prefix of prefixes) {
    keys.push(`${prefix}_${axis}`, `${prefix}_${upperAxis}`, `${prefix}${upperAxis}`);
  }

  if (shortPrefix) {
    keys.push(`${shortPrefix}${axis}`, `${shortPrefix}${upperAxis}`);
  }

  return keys;
}

function pickFirstValue(source, keys) {
  if (!isObjectRecord(source)) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

function pickFirstString(source, keys) {
  const value = pickFirstValue(source, keys);
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function isObjectRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function setupWmsTaskControls() {
  if (rootNodes.wmsTaskForm) {
    rootNodes.wmsTaskForm.addEventListener("submit", handleWmsTaskSubmit);
  }

  if (rootNodes.wmsRefreshButton) {
    rootNodes.wmsRefreshButton.addEventListener("click", () => {
      loadWmsTasks();
    });
  }
}

function setupMotorCommandControls() {
  if (rootNodes.motorCommandForm) {
    rootNodes.motorCommandForm.addEventListener("submit", handleMotorCommandSubmit);
  }

  if (rootNodes.motorTargetSpeedSlider) {
    rootNodes.motorTargetSpeedSlider.addEventListener("input", renderMotorCommandReadout);
  }

  if (rootNodes.motorStopButton) {
    rootNodes.motorStopButton.addEventListener("click", handleMotorStopClick);
  }

  renderMotorCommandReadout();
}

function readMotorCommandFormPayload(options = {}) {
  const targetSpeedMps = options.stop ? 0 : readMotorTargetSpeedMps();
  const targetRpm = clampMotorTargetRpm(wheelSpeedToRpm(targetSpeedMps));

  return {
    target_rpm: options.stop ? 0 : targetRpm,
    target_speed_mps: options.stop ? 0 : targetSpeedMps,
    direction: "forward",
    enabled: !options.stop,
    closed_loop: true,
    max_pwm: MOTOR_DEFAULT_MAX_PWM,
    timeout_ms: Math.round(toFiniteNumber(rootNodes.motorTimeoutInput?.value) || 800),
    stop: Boolean(options.stop),
  };
}

async function handleMotorCommandSubmit(event) {
  event.preventDefault();

  const payload = readMotorCommandFormPayload();
  motorControlsBusy = true;
  setMotorControlsDisabled(true);
  renderMotorCommandMessage(
    `Publishing wheel speed cmd: ${payload.target_speed_mps.toFixed(2)} m/s -> ${payload.target_rpm.toFixed(1)} rpm, timeout ${payload.timeout_ms} ms`
  );

  try {
    const response = await postJson(DATA_FILES.motorCommand, payload);
    const publishedPayload = response?.payload || payload;
    renderMotorCommandMessage(
      `Motor cmd published: ${formatSpeedMps(publishedPayload.target_speed_mps)} -> ${formatRpm(publishedPayload.target_rpm)}, timeout ${publishedPayload.timeout_ms} ms`
    );
    appendEventStreamEntry({
      key: response?.payload?.command_id || `motor-cmd-${Date.now()}`,
      status: "online",
      title: "Motor command published",
      detail: `target_speed: ${formatSpeedMps(publishedPayload.target_speed_mps)} · target_rpm: ${formatRpm(publishedPayload.target_rpm)} · stop: ${publishedPayload.stop ? "yes" : "no"}`,
      timestamp: response?.published_at,
    });
  } catch (error) {
    renderMotorCommandMessage("命令发送失败，详情见日志", true);
    appendEventStreamEntry({
      key: `motor-cmd-error-${Date.now()}`,
      status: "error",
      title: "Motor command failed",
      detail: summarizeErrorForDisplay(normalizeError(error)),
    });
  } finally {
    motorControlsBusy = false;
    refreshMotorControlAvailability();
  }
}

async function handleMotorStopClick() {
  const payload = readMotorCommandFormPayload({ stop: true });
  motorControlsBusy = true;
  setMotorControlsDisabled(true);
  renderMotorCommandMessage("Publishing stop command...");

  try {
    const response = await postJson(DATA_FILES.motorCommand, payload);
    if (rootNodes.motorEnableSwitch) {
      rootNodes.motorEnableSwitch.checked = false;
    }
    if (rootNodes.motorTargetRpmInput) {
      rootNodes.motorTargetRpmInput.value = "0";
    }
    if (rootNodes.motorTargetSpeedSlider) {
      rootNodes.motorTargetSpeedSlider.value = "0";
      renderMotorCommandReadout();
    }
    renderMotorCommandMessage("Stop command published.");
    appendEventStreamEntry({
      key: response?.payload?.command_id || `motor-stop-${Date.now()}`,
      status: "stale",
      title: "Motor stop published",
      detail: "target_speed_mps=0 · target_rpm=0 · stop=true",
      timestamp: response?.published_at,
    });
  } catch (error) {
    renderMotorCommandMessage("STOP 发送失败，详情见日志", true);
    appendEventStreamEntry({
      key: `motor-stop-error-${Date.now()}`,
      status: "error",
      title: "Motor STOP failed",
      detail: summarizeErrorForDisplay(normalizeError(error)),
    });
  } finally {
    motorControlsBusy = false;
    refreshMotorControlAvailability();
  }
}

function setMotorControlsDisabled(disabled) {
  if (rootNodes.motorApplyButton) {
    rootNodes.motorApplyButton.disabled = disabled;
  }
  if (rootNodes.motorStopButton) {
    rootNodes.motorStopButton.disabled = disabled;
  }
  if (rootNodes.motorEnableSwitch) {
    rootNodes.motorEnableSwitch.disabled = disabled;
  }
  if (rootNodes.motorTargetRpmInput) {
    rootNodes.motorTargetRpmInput.disabled = disabled;
  }
  if (rootNodes.motorMaxPwmInput) {
    rootNodes.motorMaxPwmInput.disabled = disabled;
  }
  if (rootNodes.motorTargetSpeedSlider) {
    rootNodes.motorTargetSpeedSlider.disabled = disabled;
  }
  if (rootNodes.motorTimeoutInput) {
    rootNodes.motorTimeoutInput.disabled = disabled;
  }
}

function renderMotorCommandReadout() {
  const targetSpeedMps = readMotorTargetSpeedMps();
  const targetRpm = clampMotorTargetRpm(wheelSpeedToRpm(targetSpeedMps));

  setText(rootNodes.motorTargetSpeedInputValue, formatSpeedMps(targetSpeedMps));
  setText(rootNodes.motorTargetRpmInputValue, formatRpm(targetRpm));
  setText(rootNodes.motorDirectionInputValue, "forward");
}

function readMotorTargetSpeedMps() {
  return clampNumber(
    toFiniteNumber(rootNodes.motorTargetSpeedSlider?.value) || 0,
    0,
    MOTOR_SPEED_SLIDER_MAX_MPS
  );
}

function wheelSpeedToRpm(speedMps) {
  const numericValue = toFiniteNumber(speedMps);
  if (numericValue === undefined || MOTOR_WHEEL_CIRCUMFERENCE_M <= 0) {
    return 0;
  }

  return numericValue * 60 / MOTOR_WHEEL_CIRCUMFERENCE_M;
}

function rpmToWheelSpeed(rpm) {
  const numericValue = toFiniteNumber(rpm);
  if (numericValue === undefined) {
    return undefined;
  }

  return numericValue * MOTOR_WHEEL_CIRCUMFERENCE_M / 60;
}

function clampMotorTargetRpm(rpm) {
  return clampNumber(toFiniteNumber(rpm) || 0, 0, MOTOR_BENCH_MAX_RPM);
}

function clampNumber(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function renderMotorCommandMessage(message, isError = false) {
  if (!rootNodes.motorCommandMessage) {
    return;
  }

  rootNodes.motorCommandMessage.textContent = isError ? truncateText(message, 42) : truncateText(message, 54);
  rootNodes.motorCommandMessage.dataset.state = isError ? "error" : "ok";
}

async function handleWmsTaskSubmit(event) {
  event.preventDefault();

  const payload = {
    task_type: rootNodes.wmsTaskType?.value?.trim() || "transport",
    pickup: rootNodes.wmsPickup?.value || "start_zone",
    dropoff: rootNodes.wmsDropoff?.value || "station_a",
  };

  setWmsControlsDisabled(true);
  renderWmsTaskMessage(`Creating task: ${payload.pickup} -> ${payload.dropoff}`);

  try {
    const createdTask = await postJson(DATA_FILES.wmsTasks, payload);
    const taskId = createdTask?.id || createdTask?.task_id || createdTask?.task_name || "created";
    renderWmsTaskMessage(`Task created: ${taskId}`);
    await loadWmsTasks();
  } catch (error) {
    renderWmsTaskMessage("任务列表不可用，使用本地演示选项", true);
    appendEventStreamEntry({
      key: `wms-create-error-${Date.now()}`,
      status: "error",
      title: "Task dispatch failed",
      detail: summarizeErrorForDisplay(normalizeError(error)),
    });
  } finally {
    setWmsControlsDisabled(false);
  }
}

async function loadWmsTasks() {
  if (!rootNodes.wmsTasksTable) {
    return;
  }

  setWmsRefreshDisabled(true);

  try {
    const payload = await fetchJson(DATA_FILES.wmsTasks);
    cachedPayloads.wmsTasks = payload;
    renderWmsTasks(payload);
    renderWmsTaskMessage(`WMS task list refreshed: ${extractWmsTasks(payload).length} tasks`);
  } catch (error) {
    const errorMessage = normalizeError(error);
    if (cachedPayloads.wmsTasks) {
      renderWmsTasks(cachedPayloads.wmsTasks, { stale: true, errorMessage });
      renderWmsTaskMessage("任务列表不可用，使用本地演示选项", true);
    } else {
      rootNodes.wmsTasksTable.innerHTML = "";
      renderWmsTaskMessage("任务列表不可用，使用本地演示选项", true);
    }
    appendEventStreamEntry({
      key: `wms-list-error-${Date.now()}`,
      status: "error",
      title: "WMS task list unavailable",
      detail: summarizeErrorForDisplay(errorMessage),
    });
  } finally {
    setWmsRefreshDisabled(false);
  }
}

function renderWmsTasks(payload, options = {}) {
  const tasks = extractWmsTasks(payload).map(normalizeWmsTask);

  if (!tasks.length) {
    rootNodes.wmsTasksTable.innerHTML = buildEmptyState("当前没有 WMS 任务。");
    return;
  }

  rootNodes.wmsTasksTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Task ID</th>
          <th>Pickup</th>
          <th>Dropoff</th>
          <th>Status</th>
          <th>Created</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `
              <tr>
                <td>
                  <strong>${escapeHtml(task.id)}</strong>
                  <div class="subnote mono">${escapeHtml(task.name || "-")}</div>
                </td>
                <td>${escapeHtml(task.pickup)}</td>
                <td>${escapeHtml(task.dropoff)}</td>
                <td>${buildBadge(task.status, task.status)}</td>
                <td>${formatDate(task.created_at)}</td>
                <td>${formatDate(task.updated_at)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  if (options.stale) {
    renderWmsTaskMessage("任务列表不可用，使用本地演示选项", true);
  }
}

function extractWmsTasks(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.tasks)) {
    return payload.tasks;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function normalizeWmsTask(task) {
  const taskName = task.task_name || task.name || task.order_id || "";
  const taskMeta = parseDashboardTaskName(taskName);

  return {
    id: task.id || task.task_id || taskName || "-",
    name: taskName,
    pickup: task.pickup || task.pickup_station || taskMeta.pickup || "-",
    dropoff: task.dropoff || task.dropoff_station || taskMeta.dropoff || task.target_name || "-",
    status: task.status || task.source_status || "-",
    created_at: task.created_at || task.createdAt || null,
    updated_at: task.updated_at || task.updatedAt || null,
  };
}

function parseDashboardTaskName(taskName) {
  if (!taskName || !taskName.startsWith("dashboard_")) {
    return {};
  }

  const body = taskName.slice("dashboard_".length);
  for (const pickup of WMS_TASK_POINTS) {
    const marker = `_${pickup}_to_`;
    const markerIndex = body.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const rest = body.slice(markerIndex + marker.length);
    const dropoff = WMS_TASK_POINTS.find((point) => rest === point || rest.startsWith(`${point}_`));
    return {
      task_type: body.slice(0, markerIndex),
      pickup,
      dropoff: dropoff || "-",
    };
  }

  return {};
}

function setWmsControlsDisabled(disabled) {
  if (rootNodes.wmsSubmitButton) {
    rootNodes.wmsSubmitButton.disabled = disabled;
  }

  setWmsRefreshDisabled(disabled);
}

function setWmsRefreshDisabled(disabled) {
  if (rootNodes.wmsRefreshButton) {
    rootNodes.wmsRefreshButton.disabled = disabled;
  }
}

function renderWmsTaskMessage(message, isError = false) {
  if (!rootNodes.wmsTaskMessage) {
    return;
  }

  rootNodes.wmsTaskMessage.textContent = isError ? "任务列表不可用，使用本地演示选项" : truncateText(message, 48);
  rootNodes.wmsTaskMessage.dataset.state = isError ? "error" : "ok";
}

function connectStatusWebSocket() {
  if (!("WebSocket" in window)) {
    renderWebSocketStatus(false, "WebSocket unavailable; HTTP polling fallback is active.");
    return;
  }

  if (websocketState.reconnectTimer) {
    window.clearTimeout(websocketState.reconnectTimer);
    websocketState.reconnectTimer = null;
  }

  renderWebSocketStatus(false, `Connecting status stream: ${WS_STATUS_URL}`);

  const socket = new WebSocket(WS_STATUS_URL);
  websocketState.socket = socket;

  socket.addEventListener("open", () => {
    websocketState.connected = true;
    renderWebSocketStatus(true, `Connected to status stream: ${WS_STATUS_URL}`);
    appendEventStreamEntry({
      key: `ws-open-${Date.now()}`,
      status: "online",
      title: "Status stream connected",
      detail: WS_STATUS_URL,
    });
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleStatusMessage(payload);
    } catch (error) {
      renderWebSocketStatus(false, `Invalid status stream message: ${normalizeError(error)}`);
    }
  });

  socket.addEventListener("close", () => {
    if (websocketState.socket !== socket) {
      return;
    }

    websocketState.connected = false;
    renderWebSocketStatus(false, "Status stream disconnected; HTTP polling fallback is active.");
    appendEventStreamEntry({
      key: `ws-close-${Date.now()}`,
      status: "error",
      title: "Status stream disconnected",
      detail: "HTTP polling fallback is active.",
    });
    websocketState.reconnectTimer = window.setTimeout(connectStatusWebSocket, WS_RECONNECT_DELAY_MS);
  });

  socket.addEventListener("error", () => {
    if (websocketState.socket === socket) {
      renderWebSocketStatus(false, "Status stream error; HTTP polling fallback is active.");
    }
  });
}

function handleStatusMessage(payload) {
  if (!payload || payload.type !== "dashboard_status") {
    return;
  }

  websocketState.lastMessageAt = payload.timestamp || new Date().toISOString();

  const tasksPayload = {
    generated_at: payload.timestamp,
    source: "websocket:/ws/status",
    data: Array.isArray(payload.tasks) ? payload.tasks : [],
  };
  cachedPayloads.tasks = tasksPayload;
  renderTasks(tasksPayload, { realtime: true });

  const robot = payload.robot || {};
  const devicesPayload = {
    generated_at: robot.generated_at || payload.timestamp,
    source: robot.source || "websocket:/ws/status",
    data: Array.isArray(robot.devices) ? robot.devices : [],
  };
  cachedPayloads.devices = devicesPayload;
  renderDevices(devicesPayload, {
    realtime: true,
    robotStatus: robot.status,
    errorMessage: robot.error,
  });

  updateImuSnapshot(extractImuSnapshotFromStatusMessage(payload), {
    realtime: true,
    sourceMode: "websocket",
    errorMessage: robot.error,
  });
  updateMotorSnapshot(extractMotorSnapshotFromStatusMessage(payload), {
    realtime: true,
    sourceMode: "websocket",
    errorMessage: robot.error,
  });

  appendEventStreamEntry({
    key: `ws-${websocketState.lastMessageAt}`,
    status: robot.status === "disconnected" ? "error" : "online",
    title: "Status stream update",
    detail: `tasks: ${tasksPayload.data.length} · devices: ${devicesPayload.data.length}`,
    timestamp: websocketState.lastMessageAt,
  });

  if (cachedPayloads.alerts) {
    renderSummary(cachedPayloads.tasks, cachedPayloads.devices, cachedPayloads.alerts);
  }

  if (robot.status === "disconnected") {
    renderWebSocketStatus(false, "Status stream reports disconnected.");
    appendEventStreamEntry({
      key: `ws-robot-disconnected-${websocketState.lastMessageAt}`,
      status: "error",
      title: "Backend disconnected",
      detail: summarizeErrorForDisplay(robot.error || "Status stream disconnected"),
      timestamp: websocketState.lastMessageAt,
    });
  } else {
    renderWebSocketStatus(true, `Latest status stream update: ${formatDate(websocketState.lastMessageAt)}`);
  }
}

function renderSummary(tasksPayload, devicesPayload, alertsPayload, failures = []) {
  const tasks = Array.isArray(tasksPayload?.data) ? tasksPayload.data : [];
  const devices = Array.isArray(devicesPayload?.data) ? devicesPayload.data : [];
  const alerts = Array.isArray(alertsPayload?.data) ? alertsPayload.data : [];

  const runningTasks = tasks.filter((task) =>
    ["queued", "dispatching", "running", "blocked"].includes(task.status)
  ).length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const onlineDevices = devices.filter((device) => device.comm_status === "online").length;
  const criticalDevices = devices.filter((device) => device.health_status === "critical").length;
  const openAlerts = alerts.filter((alert) => alert.status === "open").length;
  const criticalAlerts = alerts.filter((alert) => alert.level === "critical" && alert.status === "open").length;
  const currentTask = tasks.find((task) => ["dispatching", "running", "blocked"].includes(task.status)) || tasks[0] || null;

  ensureSummaryCards();
  updateSummaryCard(
    "activeTasks",
    runningTasks,
    currentTask ? `当前：${currentTask.task_id || "-"} · ${taskStatusLabel[currentTask.status] || currentTask.status || "-"}` : "当前没有活动任务",
    runningTasks > 0 ? "online" : "stale"
  );
  updateSummaryCard(
    "blockedTasks",
    blockedTasks,
    blockedTasks > 0 ? "需要优先排查的 AMR 任务" : "没有阻塞任务",
    blockedTasks > 0 ? "critical" : "online"
  );
  updateSummaryCard(
    "onlineDevices",
    onlineDevices,
    `${devices.length} 个设备快照 · critical ${criticalDevices}`,
    criticalDevices > 0 ? "critical" : onlineDevices > 0 ? "online" : "offline"
  );
  updateSummaryCard(
    "openAlerts",
    openAlerts,
    criticalAlerts > 0 ? `${criticalAlerts} 个 critical 告警未关闭` : `${alerts.length} 条告警记录`,
    criticalAlerts > 0 ? "critical" : openAlerts > 0 ? "stale" : "online"
  );

  const syncTime = formatClockTime(
    pickLatestTimestamp([tasksPayload?.generated_at, devicesPayload?.generated_at, alertsPayload?.generated_at])
  );
  rootNodes.generatedAt.textContent = failures.length
    ? `SYNC ${syncTime} · DEGRADED`
    : `SYNC ${syncTime} · TASKS ${runningTasks} · ALERTS ${openAlerts}`;
}

function renderSummaryUnavailable(failures) {
  rootNodes.generatedAt.textContent = failures.length ? "SYNC --:--:-- · DISCONNECTED" : "SYNC --:--:-- · WAITING";
  ensureSummaryCards();
  updateSummaryCard("activeTasks", "--", "waiting for dashboard backend", "offline");
  updateSummaryCard("blockedTasks", "--", "waiting for dashboard backend", "offline");
  updateSummaryCard("onlineDevices", "--", "waiting for dashboard backend", "offline");
  updateSummaryCard(
    "openAlerts",
    "--",
    failures.length ? truncateText(failures.join(" | "), 120) : "waiting for dashboard backend",
    "offline"
  );
}

function ensureSummaryCards() {
  if (!rootNodes.summaryGrid || rootNodes.summaryGrid.dataset.ready === "true") {
    return;
  }

  const cards = [
    ["activeTasks", "Task Flow"],
    ["blockedTasks", "Blocked"],
    ["onlineDevices", "Device Link"],
    ["openAlerts", "Open Alerts"],
  ];

  rootNodes.summaryGrid.innerHTML = cards
    .map(
      ([key, label]) => `
        <article class="summary-card" data-summary-card="${key}" data-state="offline">
          <span class="section-kicker">${label}</span>
          <strong data-summary-value="${key}" class="numeric-fixed">--</strong>
          <p data-summary-note="${key}">waiting for dashboard backend</p>
        </article>
      `
    )
    .join("");
  rootNodes.summaryGrid.dataset.ready = "true";
}

function updateSummaryCard(key, value, note, state = "stale") {
  const card = document.querySelector(`[data-summary-card="${key}"]`);
  if (card) {
    card.dataset.state = state;
  }
  setText(document.querySelector(`[data-summary-value="${key}"]`), String(value));
  setText(document.querySelector(`[data-summary-note="${key}"]`), note);
}

function renderTasks(tasksPayload, options = {}) {
  const tasks = Array.isArray(tasksPayload?.data) ? tasksPayload.data : [];
  if (rootNodes.tasksMeta) {
    rootNodes.tasksMeta.textContent = `${tasks.length} tasks · ${options.realtime ? "stream" : "http"}`;
    rootNodes.tasksMeta.dataset.state = options.errorMessage ? "error" : "ok";
  }

  const activeTasks = tasks.filter((task) =>
    ["queued", "dispatching", "running", "blocked"].includes(task.status)
  );
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const currentTask = activeTasks[0] || tasks[0] || null;
  const progress = clampPercent(toFiniteNumber(currentTask?.progress) || 0);
  const taskStage = currentTask ? taskStatusLabel[currentTask.status] || currentTask.status || "-" : "-";
  const taskStep = currentTask
    ? currentTask.blocked_reason || currentTask.last_event || currentTask.source_status || currentTask.task_type || "-"
    : "-";

  setText(rootNodes.taskActiveCount, formatCount(activeTasks.length));
  setText(rootNodes.taskBlockedCount, formatCount(blockedTasks.length));
  setText(rootNodes.taskCompletedCount, formatCount(completedTasks.length));
  setText(rootNodes.taskTotalCount, formatCount(tasks.length));
  setText(rootNodes.taskCurrentId, currentTask?.task_id || "-");
  setText(rootNodes.taskCurrentStatus, taskStage);
  setText(
    rootNodes.taskCurrentRoute,
    currentTask ? `${currentTask.pickup_station || "-"} -> ${currentTask.dropoff_station || "-"}` : "-"
  );
  setText(rootNodes.taskCurrentRobot, currentTask?.robot_id || "-");
  setText(rootNodes.taskCurrentSource, currentTask?.source_status || currentTask?.task_type || "-");
  setText(rootNodes.taskCurrentBlockReason, currentTask?.blocked_reason || "-");
  setText(rootNodes.taskStageValue, taskStage);
  setText(rootNodes.taskStepValue, taskStep);
  setText(rootNodes.taskProgressValue, currentTask ? `${Math.round(progress)}%` : "--%");
  setWidthPercent(rootNodes.taskProgressFill, progress);
  setText(rootNodes.taskCardProgress, currentTask ? `${Math.round(progress)}%` : "--%");
  setWidthPercent(rootNodes.taskCardProgressFill, progress);

  refreshRobotInfo();
}

function renderDevices(devicesPayload, options = {}) {
  const devices = Array.isArray(devicesPayload?.data) ? devicesPayload.data : [];
  const onlineDevices = devices.filter((device) => device.comm_status === "online").length;
  const warningDevices = devices.filter((device) => device.health_status === "warning").length;
  const criticalDevices = devices.filter((device) => device.health_status === "critical").length;
  const worstStatus = criticalDevices > 0 ? "critical" : warningDevices > 0 ? "warning" : devices.length ? "online" : "offline";
  const label = worstStatus === "online" ? "Healthy" : worstStatus === "offline" ? "Offline" : healthStatusLabel[worstStatus] || "Unknown";
  const lastUpdate = pickLatestTimestamp(devices.map((device) => device.last_seen_at)) || devicesPayload?.generated_at;

  if (rootNodes.systemMeta) {
    rootNodes.systemMeta.textContent = `${devices.length} devices · ${options.realtime ? "stream" : "http"}`;
    rootNodes.systemMeta.dataset.state = options.errorMessage || worstStatus === "critical" ? "error" : "ok";
  }

  setText(rootNodes.systemStatusLabel, devices.length ? label : "Waiting");
  setStateClass(rootNodes.systemStatusDot, "status-dot", statusToDotState(worstStatus));
  setText(rootNodes.systemSource, `source: ${devicesPayload?.source || "-"}`);
  setText(rootNodes.systemTotalDevices, formatCount(devices.length));
  setText(rootNodes.systemOnlineDevices, formatCount(onlineDevices));
  setText(rootNodes.systemWarningDevices, formatCount(warningDevices));
  setText(rootNodes.systemCriticalDevices, formatCount(criticalDevices));
  setText(rootNodes.systemLastUpdate, lastUpdate ? `${formatElapsedFixed(parseDateTime(lastUpdate))} ago` : "--.-s ago");

  refreshLinkBoard();
  refreshRobotInfo();
}

function renderAlerts(alertsPayload, options = {}) {
  const alerts = Array.isArray(alertsPayload?.data) ? alertsPayload.data : [];
  if (rootNodes.eventStreamMeta) {
    rootNodes.eventStreamMeta.textContent = `${alerts.length} alerts · latest 5 status events`;
    rootNodes.eventStreamMeta.dataset.state = options.errorMessage ? "error" : "ok";
  }

  alerts.slice(0, 3).forEach((alert) => {
    appendEventStreamEntry({
      key: `alert-${alert.id || alert.title || alert.updated_at || alert.triggered_at}`,
      status: alert.level === "critical" ? "error" : alert.level === "warning" ? "stale" : "info",
      title: alert.title || "Alert",
      detail: summarizeErrorForDisplay(alert.description || alert.suggested_action || "-"),
      timestamp: alert.updated_at || alert.triggered_at,
    });
  });

  if (!alerts.length && options.unavailable) {
    appendEventStreamEntry({
      key: `alerts-unavailable-${options.errorMessage || "unknown"}`,
      status: "error",
      title: "Alerts unavailable",
      detail: summarizeErrorForDisplay(options.errorMessage || "Dashboard backend unavailable."),
    });
  }
}

function renderConnectionStatus(isOnline, message) {
  transportState.backendConnected = Boolean(isOnline);

  if (rootNodes.dataMode) {
    rootNodes.dataMode.textContent = isOnline ? "Connected" : "Disconnected";
    rootNodes.dataMode.dataset.state = isOnline ? "online" : "offline";
  }

  if (rootNodes.connectionMessage) {
    rootNodes.connectionMessage.textContent = message;
  }

  refreshLinkBoard();
  refreshMotorControlAvailability();
}

function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

function setStateClass(node, baseClass, state) {
  if (node) {
    node.className = `${baseClass} ${state}`;
  }
}

function setAngleRow(valueNode, markerNode, angle) {
  setText(valueNode, angle?.label || "--.-°");
  if (markerNode) {
    markerNode.style.left = `${Math.max(0, Math.min(100, angle?.percent ?? 50))}%`;
  }
}

function setWidthPercent(node, percent) {
  if (node) {
    node.style.width = `${clampPercent(percent)}%`;
  }
}

function appendEventStreamEntry(entry) {
  if (!rootNodes.eventStreamList) {
    return;
  }

  const key = entry.key || `${entry.title}-${entry.detail}-${entry.timestamp || ""}`;
  if (eventStreamKeys.has(key)) {
    return;
  }

  eventStreamKeys.add(key);

  const item = document.createElement("li");
  item.className = `event-stream-item ${entry.status || "info"}`;
  item.dataset.eventKey = key;

  const dot = document.createElement("span");
  dot.className = `status-dot ${statusToDotState(entry.status || "info")}`;

  const body = document.createElement("div");
  body.className = "event-stream-body";

  const title = document.createElement("strong");
  title.textContent = truncateText(entry.title || "Status update", 48);

  const detail = document.createElement("p");
  detail.textContent = summarizeErrorForDisplay(entry.detail || "-");

  const time = document.createElement("span");
  time.className = "mono stable-date";
  time.textContent = formatDate(entry.timestamp || new Date().toISOString());

  body.append(title, detail, time);
  item.append(dot, body);
  rootNodes.eventStreamList.prepend(item);

  while (rootNodes.eventStreamList.children.length > 5) {
    const removed = rootNodes.eventStreamList.lastElementChild;
    if (!removed) {
      break;
    }
    eventStreamKeys.delete(removed.dataset.eventKey);
    removed.remove();
  }
}

function formatCount(value) {
  return String(value).padStart(2, "0");
}

function clampPercent(value) {
  const numericValue = toFiniteNumber(value) || 0;
  return Math.max(0, Math.min(100, numericValue));
}

function statusToDotState(status) {
  if (["online", "healthy", "info", "completed"].includes(status)) {
    return "online";
  }
  if (["stale", "warning", "intermittent", "blocked"].includes(status)) {
    return "stale";
  }
  return "offline";
}

function pickLatestTimestamp(values) {
  return values
    .map((value) => ({ value, date: parseDateTime(value) }))
    .filter((item) => item.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.value;
}

function buildSectionMeta(count, source, options = {}) {
  const segments = [`${count} items`, `source: ${source || "-"}`];

  if (options.realtime) {
    segments.push("status stream");
  }

  if (options.robotStatus) {
    segments.push(`robot: ${options.robotStatus}`);
  }

  if (options.stale) {
    segments.push("stale snapshot");
  }

  return segments.join(" · ");
}

function renderWebSocketStatus(isOnline, message) {
  transportState.streamConnected = Boolean(isOnline);

  if (rootNodes.wsStatus) {
    rootNodes.wsStatus.textContent = isOnline ? "Connected" : "Disconnected";
    rootNodes.wsStatus.dataset.state = isOnline ? "online" : "offline";
  }

  if (rootNodes.wsMessage) {
    rootNodes.wsMessage.textContent = message;
  }

  refreshLinkBoard();
  refreshMotorControlAvailability();
}

function refreshLinkBoard() {
  const devices = Array.isArray(cachedPayloads.devices?.data) ? cachedPayloads.devices.data : [];
  const mqttConnection = String(cachedPayloads.robotStatus?.connection?.status || "").toLowerCase();
  const imuView = buildImuViewModel(latestImuSnapshot);
  const motorView = buildMotorViewModel(latestMotorSnapshot);
  const microRosSummary = summarizeDeviceGroup(devices, (device) =>
    String(device?.transport || "").toLowerCase() === "micro_ros" ||
    String(device?.transport || "").toLowerCase() === "microros"
  );
  const batterySummary = summarizeDeviceGroup(
    devices,
    (device) =>
      String(device?.subsystem || "").toLowerCase().includes("battery") ||
      String(device?.device_type || "").toLowerCase() === "bms"
  );

  setHealthNode(rootNodes.linkBackendStatus, transportState.backendConnected ? "Online" : "Offline", transportState.backendConnected ? "online" : "offline");
  setHealthNode(rootNodes.linkStreamStatus, transportState.streamConnected ? "Online" : "Offline", transportState.streamConnected ? "online" : "offline");
  setHealthNode(rootNodes.linkImuStatus, imuView.hasPayload ? imuView.linkLabel : "Waiting", statusToDataState(imuView.hasPayload ? imuView.linkStatus : "unknown"));
  setText(rootNodes.linkImuLatency, imuView.hasPayload ? imuView.lastUpdateAgo : "--");
  setHealthNode(rootNodes.linkMicroRosStatus, microRosSummary.label, microRosSummary.state);
  setHealthNode(
    rootNodes.linkMqttStatus,
    mqttConnection === "connected" ? "OK" : mqttConnection === "connecting" ? "Connecting" : "Waiting",
    mqttConnection === "connected" ? "online" : mqttConnection === "connecting" ? "stale" : "unknown"
  );
  setHealthNode(rootNodes.linkMotorStatus, motorView.hasPayload ? motorView.linkLabel : "Waiting", statusToDataState(motorView.hasPayload ? motorView.linkStatus : "unknown"));
  setText(rootNodes.linkMotorLatency, motorView.hasPayload ? formatElapsedFixed(parseDateTime(latestMotorSnapshot?.last_seen)) : "--");
  setHealthNode(rootNodes.linkBatteryStatus, batterySummary.label, batterySummary.state);
  setHealthNode(rootNodes.headerRosStatus, imuView.hasPayload ? "OK" : "Waiting", imuView.hasPayload ? "online" : "unknown");
  setHealthNode(rootNodes.headerMicroRosStatus, microRosSummary.label === "Online" ? "OK" : microRosSummary.label, microRosSummary.state);
  setHealthNode(
    rootNodes.headerMqttStatus,
    mqttConnection === "connected" ? "OK" : mqttConnection === "connecting" ? "Connecting" : "Waiting",
    mqttConnection === "connected" ? "online" : mqttConnection === "connecting" ? "stale" : "unknown"
  );
  setHealthNode(rootNodes.pipelineEsp32, motorView.hasPayload || imuView.hasPayload ? "ESP32" : "ESP32", motorView.hasPayload || imuView.hasPayload ? "online" : "unknown");
  setHealthNode(rootNodes.pipelineMicroRos, "micro-ROS", microRosSummary.state === "offline" && !imuView.hasPayload ? "unknown" : microRosSummary.state);
  setHealthNode(rootNodes.pipelineRos, "ROS 2", imuView.hasPayload ? "online" : "unknown");
  setHealthNode(rootNodes.pipelineMqtt, "MQTT", mqttConnection === "connected" ? "online" : mqttConnection === "connecting" ? "stale" : "unknown");
  setHealthNode(rootNodes.pipelineBackend, "Backend", transportState.backendConnected ? "online" : "offline");
  setHealthNode(rootNodes.pipelineFrontend, "Frontend", "online");

  if (rootNodes.previewMode) {
    const isOnline = transportState.backendConnected || transportState.streamConnected;
    rootNodes.previewMode.textContent = isOnline ? "Live Monitor" : "Offline Preview";
    rootNodes.previewMode.dataset.state = isOnline ? "online" : "stale";
  }
}

function refreshMotorControlAvailability() {
  const motorView = buildMotorViewModel(latestMotorSnapshot);
  const mqttConnection = cachedPayloads.robotStatus?.connection?.status || latestMotorSnapshot?.connection?.status;
  const backendReachable = Boolean(transportState.backendConnected || transportState.streamConnected || cachedPayloads.robotStatus);
  const available = Boolean(backendReachable && (!mqttConnection || mqttConnection === "connected"));
  const disabled = motorControlsBusy || !available;
  setMotorControlsDisabled(disabled);

  if (rootNodes.cmdCard) {
    rootNodes.cmdCard.dataset.disabled = disabled ? "true" : "false";
  }
  if (rootNodes.safetyStatusValue) {
    rootNodes.safetyStatusValue.textContent = available ? "Safety: command path ready" : "Safety: waiting for backend / MQTT";
  }
  if (!motorControlsBusy) {
    renderMotorCommandMessage(
      available
        ? motorView.hasPayload
          ? "控制链路已连接，等待显式台架命令"
          : "命令接口已连接，等待电机状态回传"
        : "控制链路未连接，等待 backend / MQTT",
      !available
    );
  }
}

function refreshRobotInfo() {
  const tasks = Array.isArray(cachedPayloads.tasks?.data) ? cachedPayloads.tasks.data : [];
  const devices = Array.isArray(cachedPayloads.devices?.data) ? cachedPayloads.devices.data : [];
  const currentTask = tasks.find((task) => ["queued", "dispatching", "running", "blocked"].includes(task.status)) || tasks[0] || null;
  const robotStatePayload =
    cachedPayloads.robotStatus?.robot?.state ||
    cachedPayloads.robotStatus?.topics?.["robot/state"]?.payload ||
    null;
  const robotId =
    currentTask?.robot_id ||
    pickFirstString(latestImuSnapshot?.payload, ["robot_id", "robot"]) ||
    pickFirstString(latestMotorSnapshot?.payload, ["robot_id", "robot"]) ||
    pickFirstString(robotStatePayload, ["robot_id", "robot"]) ||
    devices.find((device) => device?.robot_id)?.robot_id ||
    "-";
  const firmware =
    pickFirstString(robotStatePayload, ["firmware_version", "firmware"]) ||
    pickFirstString(latestImuSnapshot?.payload, ["firmware_version", "firmware"]) ||
    pickFirstString(latestMotorSnapshot?.payload, ["firmware_version", "firmware"]) ||
    devices.find((device) => device?.robot_id === robotId && device?.firmware_version)?.firmware_version ||
    devices.find((device) => device?.firmware_version)?.firmware_version ||
    "-";
  const runtime =
    formatRuntimeValue(
      pickFirstValue(robotStatePayload, ["runtime_s", "runtime_sec", "runtime_seconds", "uptime_s", "uptime_sec", "uptime_seconds", "runtime", "uptime"]) ??
        pickFirstValue(latestImuSnapshot?.payload, ["runtime_s", "runtime", "uptime_s", "uptime"]) ??
        pickFirstValue(latestMotorSnapshot?.payload, ["runtime_s", "runtime", "uptime_s", "uptime"])
    ) || "-";
  const ipAddress =
    pickFirstString(robotStatePayload, ["ip", "ip_address", "ipAddress", "host"]) ||
    pickFirstString(latestImuSnapshot?.payload, ["ip", "ip_address", "ipAddress", "host"]) ||
    pickFirstString(latestMotorSnapshot?.payload, ["ip", "ip_address", "ipAddress", "host"]) ||
    "-";
  const mqttTopic = [latestImuSnapshot?.topic || "robot/imu", latestMotorSnapshot?.topic || "robot/motor/status"].join(" | ");

  setText(rootNodes.robotInfoId, robotId);
  setText(rootNodes.robotInfoFirmware, firmware);
  setText(rootNodes.robotInfoRuntime, runtime);
  setText(rootNodes.robotInfoIp, ipAddress);
  setText(rootNodes.robotInfoMqttTopic, mqttTopic);
}

function summarizeDeviceGroup(devices, predicate) {
  const matches = devices.filter(predicate);
  if (!matches.length) {
    return { label: "Waiting", state: "unknown" };
  }

  const allOffline = matches.every((device) => device?.comm_status === "offline");
  const hasCritical = matches.some((device) => device?.health_status === "critical");
  const hasWarning = matches.some(
    (device) => device?.health_status === "warning" || device?.comm_status === "intermittent"
  );

  if (allOffline) {
    return { label: "Offline", state: "offline" };
  }
  if (hasCritical) {
    return { label: "Critical", state: "offline" };
  }
  if (hasWarning) {
    return { label: "Warning", state: "stale" };
  }
  return { label: "Online", state: "online" };
}

function setHealthNode(node, label, state) {
  if (!node) {
    return;
  }

  node.textContent = label;
  node.dataset.state = state;
}

function statusToDataState(status) {
  if (["online", "healthy", "info", "connected", "completed"].includes(status)) {
    return "online";
  }
  if (["stale", "warning", "intermittent", "blocked", "connecting"].includes(status)) {
    return "stale";
  }
  if (["unknown", "waiting", "no-data"].includes(status)) {
    return "unknown";
  }
  return "offline";
}

function formatRuntimeValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return String(value);
  }

  const totalSeconds = Math.max(0, Math.round(numericValue));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildWebSocketUrl(baseUrl, path) {
  const url = new URL(baseUrl, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildBadge(type, label) {
  return `<span class="badge ${escapeHtml(type)}">${escapeHtml(label)}</span>`;
}

function buildPill(label) {
  return `<span class="pill">${escapeHtml(label)}</span>`;
}

function buildEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function buildErrorState(message) {
  return `<div class="error-state">${escapeHtml(message)}</div>`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatClockTime(value) {
  const date = value instanceof Date ? value : parseDateTime(value);
  if (!date) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLastSeen(value, date = parseDateTime(value)) {
  if (!value) {
    return "-";
  }

  if (!date) {
    return String(value);
  }

  return `${formatDate(value)} (${formatElapsed(date)} ago)`;
}

function formatElapsed(date) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 1) {
    return "<1s";
  }
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  return `${Math.floor(elapsedMinutes / 60)}h`;
}

function formatElapsedPrecise(date) {
  const elapsedSeconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (elapsedSeconds < 10) {
    return `${elapsedSeconds.toFixed(1)}s`;
  }
  if (elapsedSeconds < 60) {
    return `${Math.floor(elapsedSeconds)}s`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return elapsedMinutes < 60 ? `${elapsedMinutes}m` : `${Math.floor(elapsedMinutes / 60)}h`;
}

function formatElapsedFixed(date) {
  if (!date) {
    return "--.-s";
  }

  const elapsedSeconds = Math.max(0, Math.min(999.9, (Date.now() - date.getTime()) / 1000));
  return `${elapsedSeconds.toFixed(1).padStart(5, "0")}s`;
}

function formatSignedFixed(value, integerDigits, fractionDigits, suffix = "") {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return `--.${"-".repeat(fractionDigits)}${suffix}`;
  }

  const sign = numericValue >= 0 ? "+" : "-";
  const absoluteValue = Math.abs(numericValue);
  const fixed = absoluteValue.toFixed(fractionDigits);
  const [integerPart, fractionPart] = fixed.split(".");
  return `${sign}${integerPart.padStart(integerDigits, "0")}.${fractionPart}${suffix}`;
}

function formatMotorNumber(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return "-----";
  }

  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }

  return numericValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatSpeedMps(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return "--.-- m/s";
  }

  return `${numericValue.toFixed(2)} m/s`;
}

function formatRpm(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === undefined) {
    return "----- rpm";
  }

  return `${formatMotorNumber(numericValue)} rpm`;
}

function formatBooleanLike(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function formatSensorValue(value, suffix = "") {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return `${formatted}${suffix}`;
  }

  if (Array.isArray(value) || isObjectRecord(value)) {
    return JSON.stringify(value);
  }

  return `${String(value)}${suffix && String(value).endsWith(suffix.trim()) ? "" : suffix}`;
}

function formatVectorTriplet(vector) {
  return ["x", "y", "z"].map((axis) => formatSensorValue(vector?.[axis])).join(" / ");
}

function normalizeError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function summarizeErrorForDisplay(error) {
  const message = String(error || "").trim();
  if (!message) {
    return "No detail";
  }

  if (/failed to fetch|networkerror|load failed|connection refused|couldn't connect|disconnected/i.test(message)) {
    return "Backend disconnected";
  }

  if (/websocket|status stream/i.test(message)) {
    return "Status stream disconnected";
  }

  if (/wms/i.test(message)) {
    return "WMS task list unavailable";
  }

  return truncateText(message.replace(/\s+/g, " "), 72);
}

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
