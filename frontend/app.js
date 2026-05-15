const DATA_FILES = {
  tasks: "../mock/sample_amr_tasks.json",
  devices: "../mock/sample_device_status.json",
  alerts: "../mock/sample_alerts.json",
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
};

init();

async function init() {
  try {
    const [tasksPayload, devicesPayload, alertsPayload] = await Promise.all([
      fetchJson(DATA_FILES.tasks),
      fetchJson(DATA_FILES.devices),
      fetchJson(DATA_FILES.alerts),
    ]);

    renderSummary(tasksPayload, devicesPayload, alertsPayload);
    renderTasks(tasksPayload);
    renderDevices(devicesPayload);
    renderAlerts(alertsPayload);
  } catch (error) {
    renderError(error);
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

function renderSummary(tasksPayload, devicesPayload, alertsPayload) {
  const tasks = tasksPayload.data;
  const devices = devicesPayload.data;
  const alerts = alertsPayload.data;

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
      note: `${tasks.length} total tasks in mock feed`,
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

  rootNodes.generatedAt.textContent = [
    `Tasks: ${formatDate(tasksPayload.generated_at)}`,
    `Devices: ${formatDate(devicesPayload.generated_at)}`,
    `Alerts: ${formatDate(alertsPayload.generated_at)}`,
  ].join("  |  ");
}

function renderTasks(tasksPayload) {
  const { data: tasks, source } = tasksPayload;
  rootNodes.tasksMeta.textContent = `${tasks.length} items · source: ${source}`;

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

function renderDevices(devicesPayload) {
  const { data: devices, source } = devicesPayload;
  rootNodes.devicesMeta.textContent = `${devices.length} items · source: ${source}`;

  if (!devices.length) {
    rootNodes.deviceGrid.innerHTML = buildEmptyState("当前没有可展示的设备状态数据。");
    return;
  }

  rootNodes.deviceGrid.innerHTML = devices
    .map((device) => {
      const metrics = Object.entries(device.metrics)
        .map(
          ([key, value]) => `
            <div class="metric-row">
              <span>${escapeHtml(key)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </div>
          `
        )
        .join("");

      const alarms = device.alarms.length
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

function renderAlerts(alertsPayload) {
  const { data: alerts, source } = alertsPayload;
  rootNodes.alertsMeta.textContent = `${alerts.length} items · source: ${source}`;

  if (!alerts.length) {
    rootNodes.alertsList.innerHTML = buildEmptyState("当前没有可展示的告警数据。");
    return;
  }

  rootNodes.alertsList.innerHTML = alerts
    .map((alert) => {
      const evidence = alert.evidence.length
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

function renderError(error) {
  const message = `
    <div class="error-state">
      数据加载失败：${escapeHtml(error.message)}。<br />
      请从仓库根目录启动静态服务后再访问 ` +
    `<span class="mono">/frontend/</span>，例如：` +
    `<span class="mono">python3 -m http.server 8000</span>。
    </div>
  `;

  rootNodes.generatedAt.textContent = "加载失败";
  rootNodes.summaryGrid.innerHTML = message;
  rootNodes.tasksTable.innerHTML = message;
  rootNodes.deviceGrid.innerHTML = message;
  rootNodes.alertsList.innerHTML = message;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
