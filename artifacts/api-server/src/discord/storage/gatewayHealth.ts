interface GatewayHealthStats {
  connectedAt: number | null;
  reconnectCount: number;
  disconnectCount: number;
  lastDisconnectReason: string | null;
  lastDisconnectAt: number | null;
  sessionResumes: number;
  invalidSessions: number;
  wsPings: number[];
}

const stats: GatewayHealthStats = {
  connectedAt: null,
  reconnectCount: 0,
  disconnectCount: 0,
  lastDisconnectReason: null,
  lastDisconnectAt: null,
  sessionResumes: 0,
  invalidSessions: 0,
  wsPings: [],
};

export function recordGatewayConnect(): void {
  stats.connectedAt = Date.now();
}

export function recordGatewayDisconnect(reason?: string): void {
  stats.disconnectCount++;
  stats.lastDisconnectAt = Date.now();
  stats.lastDisconnectReason = reason || "Gateway Connection Dropped";
}

export function recordGatewayReconnect(): void {
  stats.reconnectCount++;
}

export function recordInvalidSession(): void {
  stats.invalidSessions++;
}

export function recordSessionResume(): void {
  stats.sessionResumes++;
}

export function recordWsPing(pingMs: number): void {
  if (pingMs >= 0) {
    stats.wsPings.push(pingMs);
    if (stats.wsPings.length > 20) {
      stats.wsPings.shift();
    }
  }
}

export function getGatewayHealthReport() {
  const avgPing =
    stats.wsPings.length > 0
      ? Math.round(stats.wsPings.reduce((a, b) => a + b, 0) / stats.wsPings.length)
      : 0;

  // Conflict risk calculation
  // Frequent disconnects or invalid sessions indicate another process with same token is connecting
  let conflictRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let conflictReason = "Gateway connection is stable. No active token conflicts detected.";

  if (stats.invalidSessions > 0 || stats.disconnectCount >= 3) {
    conflictRisk = "HIGH";
    conflictReason =
      "CRITICAL: Multiple Gateway disconnects / invalid sessions detected! Another host (e.g. previous Replit/Render/VPS instance) is actively using this Discord Bot Token and stealing the connection.";
  } else if (stats.reconnectCount > 2) {
    conflictRisk = "MEDIUM";
    conflictReason =
      "WARNING: Elevated reconnection activity detected. Check if an old hosting server or local test instance is still running in the background.";
  }

  return {
    ...stats,
    avgPing,
    uptimeMs: stats.connectedAt ? Date.now() - stats.connectedAt : 0,
    conflictRisk,
    conflictReason,
  };
}
