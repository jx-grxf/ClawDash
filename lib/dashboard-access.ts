function trimEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function decodeBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = globalThis.atob ? globalThis.atob(header.slice(6)) : "";
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function getDashboardAccessConfig() {
  return {
    localOnly: parseBool(process.env.NEXT_PUBLIC_CLAWDASH_LOCAL_ONLY ?? process.env.CLAWDASH_LOCAL_ONLY, false),
    privacyMode: parseBool(process.env.NEXT_PUBLIC_CLAWDASH_ENABLE_PRIVACY_MODE ?? process.env.CLAWDASH_ENABLE_PRIVACY_MODE, false),
    accessToken: trimEnv("CLAWDASH_ACCESS_TOKEN"),
    basicAuthUser: trimEnv("CLAWDASH_BASIC_AUTH_USER"),
    basicAuthPassword: trimEnv("CLAWDASH_BASIC_AUTH_PASSWORD"),
  };
}

export function isLoopbackAddress(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized === "localhost"
  );
}

export function isAllowedDashboardRequest(request: Request): boolean {
  const config = getDashboardAccessConfig();
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";

  if (config.localOnly && clientIp && !isLoopbackAddress(clientIp)) {
    return false;
  }

  if (config.accessToken) {
    const fromHeader = request.headers.get("x-clawdash-token") || "";
    const authHeader = request.headers.get("authorization") || "";
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get("access_token") || "";
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
    if (fromHeader !== config.accessToken && fromQuery !== config.accessToken && bearer !== config.accessToken) {
      return false;
    }
  }

  if (config.basicAuthUser || config.basicAuthPassword) {
    const auth = decodeBasicAuth(request.headers.get("authorization"));
    if (!auth) return false;
    return auth.username === config.basicAuthUser && auth.password === config.basicAuthPassword;
  }

  return true;
}

export function shouldChallengeWithBasicAuth(): boolean {
  const config = getDashboardAccessConfig();
  return Boolean(config.basicAuthUser || config.basicAuthPassword);
}

export function maskSensitiveValue(value: string, visiblePrefix = 4, visibleSuffix = 3): string {
  const compact = value.trim();
  if (!compact) return "";
  if (compact.length <= visiblePrefix + visibleSuffix + 2) return `${compact.slice(0, Math.max(1, visiblePrefix))}...`;
  return `${compact.slice(0, visiblePrefix)}...${compact.slice(-visibleSuffix)}`;
}

export function redactSessionKey(sessionKey: string): string {
  const config = getDashboardAccessConfig();
  if (!config.privacyMode) return sessionKey;
  if (!sessionKey) return sessionKey;

  const parts = sessionKey.split(":");
  if (parts.length < 3) return maskSensitiveValue(sessionKey, 6, 4);

  const masked = [...parts];
  masked[masked.length - 1] = maskSensitiveValue(parts[parts.length - 1], 3, 2);
  return masked.join(":");
}

export function redactSessionItem<T extends { key: string; target: string; sessionId?: string }>(item: T): T {
  const config = getDashboardAccessConfig();
  if (!config.privacyMode) return item;
  return {
    ...item,
    key: redactSessionKey(item.key),
    target: item.target ? maskSensitiveValue(item.target, 3, 2) : item.target,
    sessionId: item.sessionId ? maskSensitiveValue(item.sessionId, 3, 2) : item.sessionId,
  };
}
