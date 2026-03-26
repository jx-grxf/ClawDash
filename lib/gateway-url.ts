export interface GatewayEndpointSummary {
  localUrl: string;
  publicUrl?: string;
  healthUrl: string;
  host?: string;
  port: number;
  source: "local_bind" | "remote_url" | "host_override" | "fallback";
}

function normalizeBase(base: string): string {
  return base.replace(/\/$/, "");
}

export function buildGatewayUrl(
  port: number,
  path: string,
  params?: Record<string, string>,
  hostOverride?: string,
): string {
  const base = hostOverride?.trim() || "";
  let url: URL;
  if (base.includes("://")) {
    // Full URL base (e.g. "https://openclaw.local") — use scheme as-is, no port
    const origin = base.replace(/\/$/, "");
    url = new URL(`${origin}${path}`);
  } else {
    const host = base || (typeof window !== "undefined" ? window.location.hostname : "localhost");
    url = new URL(`http://${host}:${port}${path}`);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export function resolveGatewayEndpoints(input: {
  port?: number;
  host?: string;
  bind?: string;
  remoteUrl?: string;
  webUrl?: string;
  healthHost?: string;
}): GatewayEndpointSummary {
  const port = input.port || 18789;
  const explicitHost = input.host?.trim() || "";
  const bind = input.bind?.trim() || "";
  const remoteUrl = input.remoteUrl?.trim() || input.webUrl?.trim() || "";
  const healthHost = input.healthHost?.trim() || "";
  const localHost = healthHost || explicitHost || bind || "127.0.0.1";

  let source: GatewayEndpointSummary["source"] = "fallback";
  if (remoteUrl) source = "remote_url";
  else if (explicitHost) source = "host_override";
  else if (bind) source = "local_bind";

  const localUrl = buildGatewayUrl(port, "", undefined, localHost).replace(/\/$/, "");
  const publicUrl = remoteUrl
    ? normalizeBase(remoteUrl.includes("://") ? remoteUrl : `https://${remoteUrl}`)
    : undefined;
  const healthUrl = publicUrl || localUrl;

  return {
    localUrl,
    publicUrl,
    healthUrl,
    host: explicitHost || bind || undefined,
    port,
    source,
  };
}
