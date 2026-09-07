type UnknownRecord = Record<string, unknown>;

export interface TelemetrySnapshot {
  topic: string;
  source: string;
  generated_at: unknown;
  connection: unknown;
  message: unknown;
  payload: unknown;
  last_seen: unknown;
  robot_state?: {
    topic: string;
    message: unknown;
    payload: unknown;
    last_seen: unknown;
  };
}

function record(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : {};
}

function timestampFromPayload(value: unknown): unknown {
  const payload = record(value);
  return payload.timestamp ?? payload.observed_at ?? payload.received_at ?? payload.last_seen ?? null;
}

export function extractImuSnapshotFromRobotStatus(input: unknown): TelemetrySnapshot {
  const root = record(input);
  const topics = record(root.topics);
  const robot = record(root.robot);
  const topicMessage = record(topics['robot/imu']);
  const robotStateMessage = record(topics['robot/state']);
  const imuPayload = robot.imu ?? topicMessage.payload ?? null;
  const robotStatePayload = robot.state ?? robotStateMessage.payload ?? null;
  return {
    topic: 'robot/imu',
    source: typeof root.source === 'string' ? root.source : 'http:/api/robot/status',
    generated_at: root.generated_at ?? null,
    connection: root.connection ?? null,
    message: Object.keys(topicMessage).length > 0 ? topicMessage : null,
    payload: imuPayload,
    robot_state: {
      topic: 'robot/state',
      message: Object.keys(robotStateMessage).length > 0 ? robotStateMessage : null,
      payload: robotStatePayload,
      last_seen: robotStateMessage.received_at ?? timestampFromPayload(robotStatePayload),
    },
    last_seen: topicMessage.received_at ?? timestampFromPayload(imuPayload),
  };
}

export function extractImuSnapshotFromStatusMessage(input: unknown): TelemetrySnapshot {
  const root = record(input);
  const robotEnvelope = record(root.robot);
  const mqtt = record(robotEnvelope.mqtt);
  const topics = record(mqtt.topics);
  const mqttRobot = record(mqtt.robot);
  const topicMessage = record(topics['robot/imu']);
  const robotStateMessage = record(topics['robot/state']);
  const imuPayload = root.imu ?? mqttRobot.imu ?? topicMessage.payload ?? null;
  const robotStatePayload = mqttRobot.state ?? robotStateMessage.payload ?? null;
  return {
    topic: 'robot/imu',
    source: typeof mqtt.source === 'string' ? mqtt.source : 'websocket:/ws/status',
    generated_at: mqtt.generated_at ?? root.timestamp ?? null,
    connection: mqtt.connection ?? null,
    message: Object.keys(topicMessage).length > 0 ? topicMessage : null,
    payload: imuPayload,
    robot_state: {
      topic: 'robot/state',
      message: Object.keys(robotStateMessage).length > 0 ? robotStateMessage : null,
      payload: robotStatePayload,
      last_seen: robotStateMessage.received_at ?? timestampFromPayload(robotStatePayload),
    },
    last_seen: topicMessage.received_at ?? timestampFromPayload(imuPayload),
  };
}

export function extractMotorSnapshotFromRobotStatus(input: unknown): TelemetrySnapshot {
  const root = record(input);
  const topics = record(root.topics);
  const robot = record(root.robot);
  const topicMessage = record(topics['robot/motor/status']);
  const motorPayload = robot.motor_status ?? topicMessage.payload ?? null;
  return {
    topic: 'robot/motor/status',
    source: typeof root.source === 'string' ? root.source : 'http:/api/robot/status',
    generated_at: root.generated_at ?? null,
    connection: root.connection ?? null,
    message: Object.keys(topicMessage).length > 0 ? topicMessage : null,
    payload: motorPayload,
    last_seen: topicMessage.received_at ?? timestampFromPayload(motorPayload),
  };
}

export function extractMotorSnapshotFromStatusMessage(input: unknown): TelemetrySnapshot {
  const root = record(input);
  const robotEnvelope = record(root.robot);
  const mqtt = record(robotEnvelope.mqtt);
  const topics = record(mqtt.topics);
  const mqttRobot = record(mqtt.robot);
  const topicMessage = record(topics['robot/motor/status']);
  const motorPayload = root.motor ?? mqttRobot.motor_status ?? topicMessage.payload ?? null;
  return {
    topic: 'robot/motor/status',
    source: typeof mqtt.source === 'string' ? mqtt.source : 'websocket:/ws/status',
    generated_at: mqtt.generated_at ?? root.timestamp ?? null,
    connection: mqtt.connection ?? null,
    message: Object.keys(topicMessage).length > 0 ? topicMessage : null,
    payload: motorPayload,
    last_seen: topicMessage.received_at ?? timestampFromPayload(motorPayload),
  };
}
