const API_BASE_URL = window.API_BASE_URL || "http://127.0.0.1:9000";
const REFRESH_INTERVAL_MS = 3000;
const WS_RECONNECT_DELAY_MS = 3000;
const IMU_STALE_AFTER_MS = 3000;
const IMU_OFFLINE_AFTER_MS = 10000;
const WS_STATUS_URL = window.WS_STATUS_URL || buildWebSocketUrl(API_BASE_URL, "/ws/status");

const DATA_FILES = {
  tasks: `${API_BASE_URL}/api/tasks`,
  wmsTasks: `${API_BASE_URL}/api/wms/tasks`,
  devices: `${API_BASE_URL}/api/device-status`,
  alerts: `${API_BASE_URL}/api/alerts`,
  robotStatus: `${API_BASE_URL}/api/robot/status`,
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
  devicesMeta: document.querySelector("#devicesMeta"),
  alertsMeta: document.querySelector("#alertsMeta"),
  tasksTable: document.querySelector("#tasksTable"),
  deviceGrid: document.querySelector("#deviceGrid"),
  imuMeta: document.querySelector("#imuMeta"),
  imuStatusPanel: document.querySelector("#imuStatusPanel"),
  alertsList: document.querySelector("#alertsList"),
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
const websocketState = {
  socket: null,
  reconnectTimer: null,
  connected: false,
  lastMessageAt: null,
};

setupWmsTaskControls();
renderImuStatus(null, { loading: true });
init();
loadWmsTasks();
connectStatusWebSocket();
window.setInterval(init, REFRESH_INTERVAL_MS);
window.setInterval(refreshImuDisplay, 1000);

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
      syncSection("tasks", tasksResult, renderTasks, rootNodes.tasksMeta, rootNodes.tasksTable, "任务"),
      syncSection(
        "devices",
        devicesResult,
        renderDevices,
        rootNodes.devicesMeta,
        rootNodes.deviceGrid,
        "设备状态"
      ),
      syncSection("alerts", alertsResult, renderAlerts, rootNodes.alertsMeta, rootNodes.alertsList, "告警"),
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

function syncSection(key, result, renderFn, metaNode, containerNode, label) {
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

  metaNode.textContent = "unavailable";
  containerNode.innerHTML = buildErrorState(`${label} 数据不可用：${errorMessage}`);
  return `${label}: ${errorMessage}`;
}

function syncRobotStatus(result) {
  if (result.status === "fulfilled") {
    cachedPayloads.robotStatus = result.value;
    updateImuSnapshot(extractImuSnapshotFromRobotStatus(result.value), {
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
    return;
  }

  updateImuSnapshot(null, {
    sourceMode: "http",
    errorMessage,
  });
}

function updateImuSnapshot(snapshot, options = {}) {
  latestImuSnapshot = snapshot;
  latestImuRenderOptions = options;
  renderImuStatus(snapshot, options);
}

function refreshImuDisplay() {
  if (!rootNodes.imuStatusPanel || !latestImuSnapshot) {
    return;
  }

  renderImuStatus(latestImuSnapshot, latestImuRenderOptions);
}

function extractImuSnapshotFromRobotStatus(payload) {
  const topicMessage = payload?.topics?.["robot/imu"] || null;
  const imuPayload = payload?.robot?.imu ?? topicMessage?.payload ?? null;

  return {
    topic: "robot/imu",
    source: payload?.source || "http:/api/robot/status",
    generated_at: payload?.generated_at || null,
    connection: payload?.connection || null,
    message: topicMessage,
    payload: imuPayload,
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(imuPayload),
  };
}

function extractImuSnapshotFromStatusMessage(payload) {
  const mqttStatus = payload?.robot?.mqtt || null;
  const topicMessage = mqttStatus?.topics?.["robot/imu"] || null;
  const imuPayload = payload?.imu ?? mqttStatus?.robot?.imu ?? topicMessage?.payload ?? null;

  return {
    topic: "robot/imu",
    source: mqttStatus?.source || "websocket:/ws/status",
    generated_at: mqttStatus?.generated_at || payload?.timestamp || null,
    connection: mqttStatus?.connection || null,
    message: topicMessage,
    payload: imuPayload,
    last_seen: topicMessage?.received_at || pickTimestampFromPayload(imuPayload),
  };
}

function renderImuStatus(snapshot, options = {}) {
  if (!rootNodes.imuMeta || !rootNodes.imuStatusPanel) {
    return;
  }

  if (options.loading) {
    rootNodes.imuMeta.textContent = "waiting for /api/robot/status or /ws/status";
    rootNodes.imuMeta.dataset.state = "ok";
    rootNodes.imuStatusPanel.innerHTML = buildEmptyState("正在等待 MQTT robot/imu 状态。");
    return;
  }

  const view = buildImuViewModel(snapshot);
  const metaSegments = [
    "topic: robot/imu",
    `source: ${snapshot?.source || "-"}`,
    `status: ${view.linkStatus}`,
  ];

  if (options.sourceMode === "http-cache") {
    metaSegments.push("cached HTTP snapshot");
  } else if (options.realtime) {
    metaSegments.push("status stream");
  } else if (options.sourceMode === "http") {
    metaSegments.push("HTTP polling");
  }

  if (options.errorMessage) {
    metaSegments.push(`error: ${truncateText(options.errorMessage, 96)}`);
  }

  rootNodes.imuMeta.textContent = metaSegments.join(" · ");
  rootNodes.imuMeta.dataset.state = options.errorMessage || view.linkStatus === "offline" ? "error" : "ok";

  const rows = [
    buildImuMetricRow("online/offline", buildBadge(view.linkStatus, view.linkLabel), true),
    buildImuMetricRow("last_seen", escapeHtml(view.lastSeen)),
    buildImuMetricRow("accel x", escapeHtml(formatSensorValue(view.accel.x))),
    buildImuMetricRow("accel y", escapeHtml(formatSensorValue(view.accel.y))),
    buildImuMetricRow("accel z", escapeHtml(formatSensorValue(view.accel.z))),
    buildImuMetricRow("gyro x", escapeHtml(formatSensorValue(view.gyro.x))),
    buildImuMetricRow("gyro y", escapeHtml(formatSensorValue(view.gyro.y))),
    buildImuMetricRow("gyro z", escapeHtml(formatSensorValue(view.gyro.z))),
    buildImuMetricRow("temperature", escapeHtml(formatSensorValue(view.temperature, " C"))),
    buildImuMetricRow("state", escapeHtml(view.state)),
  ].join("");

  const errorNote = options.errorMessage
    ? `<p class="imu-note error-text">${escapeHtml(truncateText(options.errorMessage, 160))}</p>`
    : "";

  rootNodes.imuStatusPanel.innerHTML = `
    <article class="imu-card">
      <div class="device-header">
        <div>
          <h3>MQTT robot/imu</h3>
          <p class="subnote">MPU6050 latest cached telemetry</p>
        </div>
        <div class="badge-row">
          ${buildBadge("mqtt", "MQTT")}
          ${buildBadge(view.linkStatus, view.linkLabel)}
        </div>
      </div>
      <div class="imu-metrics">${rows}</div>
      ${errorNote}
    </article>
  `;
}

function buildImuViewModel(snapshot) {
  const payload = snapshot?.payload || null;
  const lastSeenDate = parseDateTime(snapshot?.last_seen);
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

  return {
    linkStatus,
    linkLabel: linkStatus === "online" ? "Online" : linkStatus === "stale" ? "Stale" : "Offline",
    lastSeen: formatLastSeen(snapshot?.last_seen, lastSeenDate),
    accel,
    gyro,
    temperature: pickFirstValue(payload, ["temperature", "temperature_c", "temp_c", "temp", "imu_temperature"]),
    state: linkStatus === "online" ? payloadState || "online" : linkStatus,
  };
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
    renderWmsTaskMessage(`Task create failed: ${normalizeError(error)}`, true);
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
      renderWmsTaskMessage(`WMS task list stale: ${errorMessage}`, true);
    } else {
      rootNodes.wmsTasksTable.innerHTML = buildErrorState(`WMS 任务数据不可用：${errorMessage}`);
      renderWmsTaskMessage(`WMS task list unavailable: ${errorMessage}`, true);
    }
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
    renderWmsTaskMessage(`WMS task list stale: ${truncateText(options.errorMessage || "-", 140)}`, true);
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

  rootNodes.wmsTaskMessage.textContent = message;
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

  if (cachedPayloads.alerts) {
    renderSummary(cachedPayloads.tasks, cachedPayloads.devices, cachedPayloads.alerts);
  }

  if (robot.status === "disconnected") {
    renderWebSocketStatus(false, `Status stream reports disconnected: ${truncateText(robot.error || "-", 140)}`);
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
  const openAlerts = alerts.filter((alert) => alert.status === "open").length;

  const cards = [
    {
      label: "Active Tasks",
      value: runningTasks,
      note: `${tasks.length} total tasks in dashboard feed`,
    },
    {
      label: "Blocked Tasks",
      value: blockedTasks,
      note: "需要优先排查的 AMR 任务",
    },
    {
      label: "Online Devices",
      value: onlineDevices,
      note: `${devices.length} device status snapshots`,
    },
    {
      label: "Open Alerts",
      value: openAlerts,
      note: `${alerts.length} total alerts in current view`,
    },
  ];

  rootNodes.summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <span class="section-kicker">${escapeHtml(card.label)}</span>
          <strong>${card.value}</strong>
          <p>${escapeHtml(card.note)}</p>
        </article>
      `
    )
    .join("");

  const generatedSegments = [
    `Tasks: ${formatDate(tasksPayload.generated_at)}`,
    `Devices: ${formatDate(devicesPayload.generated_at)}`,
    `Alerts: ${formatDate(alertsPayload.generated_at)}`,
  ];

  if (failures.length) {
    generatedSegments.push(`Refresh warning: ${truncateText(failures.join(" | "), 140)}`);
  }

  rootNodes.generatedAt.textContent = generatedSegments.join("  |  ");
}

function renderSummaryUnavailable(failures) {
  rootNodes.generatedAt.textContent = failures.length
    ? `Dashboard backend unavailable: ${truncateText(failures.join(" | "), 180)}`
    : "正在等待 Dashboard backend 返回数据...";
  rootNodes.summaryGrid.innerHTML = buildErrorState(
    failures.length
      ? `无法从 Dashboard backend 加载完整概览：${failures.join("；")}`
      : "正在等待 Dashboard backend 返回首批数据。"
  );
}

function renderTasks(tasksPayload, options = {}) {
  const tasks = Array.isArray(tasksPayload?.data) ? tasksPayload.data : [];
  rootNodes.tasksMeta.textContent = buildSectionMeta(tasks.length, tasksPayload?.source, options);

  if (!tasks.length) {
    rootNodes.tasksTable.innerHTML = buildEmptyState("当前没有可展示的任务数据。");
    return;
  }

  rootNodes.tasksTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>Robot</th>
          <th>Type</th>
          <th>Route</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Progress</th>
          <th>Timeline</th>
          <th>Latest Event</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `
              <tr>
                <td>
                  <strong>${escapeHtml(task.task_id)}</strong>
                  <div class="subnote mono">${escapeHtml(task.order_id)}</div>
                </td>
                <td>
                  <strong>${escapeHtml(task.robot_id || "-")}</strong>
                </td>
                <td>${escapeHtml(task.task_type)}</td>
                <td>
                  <strong>${escapeHtml(task.pickup_station || "-")}</strong>
                  <div class="route">${escapeHtml(task.dropoff_station || "-")}</div>
                </td>
                <td>
                  <div class="badge-row">
                    ${buildBadge(task.status, taskStatusLabel[task.status] || task.status)}
                    ${buildBadge("source-status", `raw: ${task.source_status}`)}
                  </div>
                </td>
                <td>${buildBadge(task.priority, task.priority)}</td>
                <td>
                  <div class="progress">
                    <strong>${task.progress}%</strong>
                    <div class="progress-track">
                      <div class="progress-fill" style="width: ${Math.max(
                        0,
                        Math.min(100, task.progress)
                      )}%"></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="subnote">created: ${formatDate(task.created_at)}</div>
                  <div class="subnote">started: ${formatDate(task.started_at)}</div>
                  <div class="subnote">due: ${formatDate(task.due_at)}</div>
                </td>
                <td>
                  <strong>${escapeHtml(task.last_event || "-")}</strong>
                  <div class="route">
                    ${task.blocked_reason ? `blocked: ${escapeHtml(task.blocked_reason)}` : "no blocking reason"}
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderDevices(devicesPayload, options = {}) {
  const devices = Array.isArray(devicesPayload?.data) ? devicesPayload.data : [];
  rootNodes.devicesMeta.textContent = buildSectionMeta(devices.length, devicesPayload?.source, options);

  if (!devices.length) {
    rootNodes.deviceGrid.innerHTML = buildEmptyState("当前没有可展示的设备状态数据。");
    return;
  }

  rootNodes.deviceGrid.innerHTML = devices
    .map((device) => {
      const metrics = Object.entries(device.metrics || {})
        .map(
          ([key, value]) => `
            <div class="metric-row">
              <span>${escapeHtml(key)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </div>
          `
        )
        .join("");

      const alarms = Array.isArray(device.alarms) && device.alarms.length
        ? device.alarms.map((alarm) => buildPill(alarm)).join("")
        : '<span class="muted">No active subsystem alarms</span>';

      return `
        <article class="device-card">
          <div class="device-header">
            <div>
              <h3>${escapeHtml(device.device_id)}</h3>
              <p class="subnote">${escapeHtml(device.robot_id || "-")} · ${escapeHtml(
                device.subsystem
              )}</p>
            </div>
            <div class="badge-row">
              ${buildBadge(device.transport, device.transport)}
              ${buildBadge(device.comm_status, commStatusLabel[device.comm_status] || device.comm_status)}
              ${buildBadge(
                device.health_status,
                healthStatusLabel[device.health_status] || device.health_status
              )}
            </div>
          </div>
          <div class="subnote">firmware: ${escapeHtml(device.firmware_version || "-")}</div>
          <div class="subnote">last seen: ${formatDate(device.last_seen_at)}</div>
          <div class="metrics-list">${metrics}</div>
          <div class="pill-row">${alarms}</div>
        </article>
      `;
    })
    .join("");
}

function renderAlerts(alertsPayload, options = {}) {
  const alerts = Array.isArray(alertsPayload?.data) ? alertsPayload.data : [];
  rootNodes.alertsMeta.textContent = buildSectionMeta(alerts.length, alertsPayload?.source, options);

  if (!alerts.length) {
    rootNodes.alertsList.innerHTML = buildEmptyState("当前没有可展示的告警数据。");
    return;
  }

  rootNodes.alertsList.innerHTML = alerts
    .map((alert) => {
      const evidence = Array.isArray(alert.evidence) && alert.evidence.length
        ? alert.evidence
            .map(
              (item) => `
                <div class="evidence-item">
                  <span>evidence</span>
                  <strong class="mono">${escapeHtml(item)}</strong>
                </div>
              `
            )
            .join("")
        : '<div class="muted">No evidence</div>';

      return `
        <article class="alert-card">
          <div class="alert-header">
            <div>
              <h3>${escapeHtml(alert.title)}</h3>
              <p class="subnote">${escapeHtml(alert.description)}</p>
            </div>
            <div class="badge-row">
              ${buildBadge(alert.level, alertLevelLabel[alert.level] || alert.level)}
              ${buildBadge(alert.status, alert.status)}
              ${buildBadge("category", alert.category)}
            </div>
          </div>
          <div class="subnote">source: ${escapeHtml(alert.source_type)} · ref: ${escapeHtml(alert.source_ref || "-")}</div>
          <div class="subnote">robot: ${escapeHtml(alert.related_robot_id || "-")} · task: ${escapeHtml(
            alert.related_task_id || "-"
          )}</div>
          <div class="subnote">triggered: ${formatDate(alert.triggered_at)}</div>
          <div class="subnote">updated: ${formatDate(alert.updated_at)}</div>
          <div class="metrics-list">${evidence}</div>
          <div class="evidence-item">
            <span>action</span>
            <strong>${escapeHtml(alert.suggested_action || "-")}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderConnectionStatus(isOnline, message) {
  if (rootNodes.dataMode) {
    rootNodes.dataMode.textContent = isOnline
      ? "Live HTTP + MQTT / Mock WMS"
      : "Disconnected";
    rootNodes.dataMode.dataset.state = isOnline ? "online" : "offline";
  }

  if (rootNodes.connectionMessage) {
    rootNodes.connectionMessage.textContent = message;
  }
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

  if (options.errorMessage) {
    segments.push(`refresh error: ${truncateText(options.errorMessage, 96)}`);
  }

  return segments.join(" · ");
}

function renderWebSocketStatus(isOnline, message) {
  if (rootNodes.wsStatus) {
    rootNodes.wsStatus.textContent = isOnline ? "Connected" : "Disconnected";
    rootNodes.wsStatus.dataset.state = isOnline ? "online" : "offline";
  }

  if (rootNodes.wsMessage) {
    rootNodes.wsMessage.textContent = message;
  }
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

function normalizeError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
