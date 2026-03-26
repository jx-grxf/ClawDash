function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function readFlag(name: string, fallbackName: string | null, defaultValue: boolean): boolean {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  return parseBool(value, defaultValue);
}

export const FEATURE_FLAGS = {
  enableLayoutWrite: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_LAYOUT_WRITE", "CLAWDASH_ENABLE_LAYOUT_WRITE", false),
  enableExternalFetches: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_EXTERNAL_FETCHES", "CLAWDASH_ENABLE_EXTERNAL_FETCHES", false),
  enableActiveModelTests: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS", "CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS", false),
  enableActiveChecks: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_ACTIVE_CHECKS", "CLAWDASH_ENABLE_ACTIVE_CHECKS", false),
  enablePrivacyMode: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_PRIVACY_MODE", "CLAWDASH_ENABLE_PRIVACY_MODE", false),
  enableLocalOnlyAccess: readFlag("NEXT_PUBLIC_CLAWDASH_LOCAL_ONLY", "CLAWDASH_LOCAL_ONLY", false),
};
