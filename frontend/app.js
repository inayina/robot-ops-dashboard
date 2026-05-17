const API_BASE_URL = window.API_BASE_URL || "http://127.0.0.1:9000";
const REFRESH_INTERVAL_MS = 3000;
const WS_RECONNECT_DELAY_MS = 3000;
const WS_STATUS_URL = window.WS_STATUS_URL || buildWebSocketUrl(API_BASE_URL, "/ws/status");

const DATA_FILES = {
  tasks: `${API_BASE_URL}/api/tasks`,
  devices: `${API_BASE_URL}/api/device-status`,
  alerts: `${API_BASE_URL}/api/alerts`,
};

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
  alertsList: document.querySelector("#alertsList"),
  dataMode: document.querySelector("#dataMode"),
  connectionMessage: document.querySelector("#connectionMessage"),
  wsStatus: document.querySelector("#wsStatus"),
  wsMessage: document.querySelector("#wsMessage"),
};

const cachedPayloads = {
  tasks: null,
  devices: null,
  alerts: null,
};

let refreshInFlight = false;
const websocketState = {
  socket: null,
  reconnectTimer: null,
  connected: false,
  lastMessageAt: null,
};

init();
connectStatusWebSocket();
window.setInterval(init, REFRESH_INTERVAL_MS);

async function init() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;

  try {
    const [tasksResult, devicesResult, alertsResult] = await Promise.allSettled([
      fetchJson(DATA_FILES.tasks),
      fetchJson(DATA_FILES.devices),
      fetchJson(DATA_FILES.alerts),
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
      ? "Live HTTP / Read-only Monitoring / AMR Mock WMS Integration"
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
