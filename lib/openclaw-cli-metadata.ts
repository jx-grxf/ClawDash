import { execOpenclaw } from "@/lib/openclaw-cli";

export type CliRiskTier =
  | "read_only"
  | "active_local"
  | "state_mutating"
  | "external_side_effect"
  | "dangerous";

export interface CliOptionMeta {
  flags: string[];
  label: string;
  description: string;
  expectsValue: boolean;
  valueHint?: string;
}

export interface CliCommandNode {
  id: string;
  name: string;
  description: string;
  usage?: string;
  docsUrl?: string;
  options: CliOptionMeta[];
  examples: string[];
  subcommands: Array<{ name: string; description: string }>;
  riskTier: CliRiskTier;
  suggestedTimeoutMs: number;
  requiresConfirmation: boolean;
}

const metadataCache = new Map<string, CliCommandNode>();

function buildFallbackMetadata(args: string[], description = "No metadata available for this command yet."): CliCommandNode {
  const commandPath = args.filter((arg) => !arg.startsWith("--") && !arg.startsWith("-"));
  const riskTier = inferRiskTier(commandPath);

  return {
    id: commandPath.join(".") || "root",
    name: commandPath[commandPath.length - 1] || "openclaw",
    description,
    usage: commandPath.length > 0 ? `openclaw ${commandPath.join(" ")}` : "openclaw",
    docsUrl: undefined,
    options: [],
    examples: [],
    subcommands: [],
    riskTier,
    suggestedTimeoutMs: timeoutForRisk(riskTier),
    requiresConfirmation: riskTier === "state_mutating" || riskTier === "external_side_effect" || riskTier === "dangerous",
  };
}

function parseOptions(lines: string[]): CliOptionMeta[] {
  const options: CliOptionMeta[] = [];
  let current: CliOptionMeta | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (/^\s{2,}-/.test(line)) {
      const parts = line.trim().split(/\s{2,}/);
      const left = parts[0] || "";
      const description = parts.slice(1).join(" ").trim();
      const flags = left.split(",").map((part) => part.trim()).filter(Boolean);
      const expectsValue = flags.some((flag) => flag.includes("<") || flag.includes("["));
      const valueMatch = left.match(/<([^>]+)>|\[([^\]]+)\]/);
      current = {
        flags: flags.map((flag) => flag.replace(/\s*<[^>]+>/g, "").replace(/\s*\[[^\]]+\]/g, "")),
        label: left,
        description,
        expectsValue,
        valueHint: valueMatch?.[1] || valueMatch?.[2],
      };
      options.push(current);
      continue;
    }
    if (current) {
      current.description = `${current.description} ${line.trim()}`.trim();
    }
  }

  return options;
}

function parseCommandEntries(lines: string[]): Array<{ name: string; description: string }> {
  return lines
    .filter((line) => line.trim() && /^\s{2,}[A-Za-z0-9-]/.test(line))
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^([A-Za-z0-9-*.]+)\s{2,}(.*)$/);
      if (!match) return null;
      return {
        name: match[1].replace(/\*$/, ""),
        description: match[2].trim(),
      };
    })
    .filter((entry): entry is { name: string; description: string } => Boolean(entry));
}

function collectSection(lines: string[], header: string): string[] {
  const start = lines.findIndex((line) => line.trim() === `${header}:`);
  if (start < 0) return [];
  const section: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[A-Z][A-Za-z ]+:$/.test(line.trim())) break;
    section.push(line);
  }
  return section;
}

export function inferRiskTier(commandPath: string[]): CliRiskTier {
  const path = commandPath.join(" ");
  if (/(^| )(reset|uninstall)( |$)/.test(path)) return "dangerous";
  if (/(^| )(message send|message broadcast|cron add|cron edit|cron rm|cron run|gateway restart|gateway start|gateway stop|gateway install|gateway uninstall)( |$)/.test(path)) {
    return /(message send|message broadcast)/.test(path) ? "external_side_effect" : "state_mutating";
  }
  if (/(^| )(models status|doctor|gateway probe)( |$)/.test(path)) return "active_local";
  return "read_only";
}

export function inferRiskTierFromArgs(args: string[]): CliRiskTier {
  const commandPath = args.filter((arg) => !arg.startsWith("--") && !arg.startsWith("-"));
  return inferRiskTier(commandPath);
}

function timeoutForRisk(riskTier: CliRiskTier): number {
  if (riskTier === "read_only") return 10_000;
  if (riskTier === "active_local") return 20_000;
  if (riskTier === "state_mutating" || riskTier === "external_side_effect") return 25_000;
  return 15_000;
}

function parseHelpText(args: string[], output: string): CliCommandNode {
  const lines = output.replace(/\r/g, "").split("\n");
  const usage = lines.find((line) => line.trim().startsWith("Usage:"))?.trim();
  const docsUrl = lines.find((line) => line.trim().startsWith("Docs:"))?.trim().replace(/^Docs:\s*/, "");
  const options = parseOptions(collectSection(lines, "Options"));
  const subcommands = parseCommandEntries(collectSection(lines, "Commands"));
  const examples = collectSection(lines, "Examples").map((line) => line.trim()).filter(Boolean);
  const descriptionIndex = lines.findIndex((line) => line.trim().startsWith("Usage:"));
  const description = descriptionIndex >= 0
    ? (lines[descriptionIndex + 2]?.trim() || lines[descriptionIndex + 1]?.trim() || "")
    : "";
  const commandPath = args.filter((arg) => !arg.startsWith("--") && !arg.startsWith("-"));
  const riskTier = inferRiskTier(commandPath);

  return {
    id: commandPath.join(".") || "root",
    name: commandPath[commandPath.length - 1] || "openclaw",
    description,
    usage,
    docsUrl,
    options,
    examples,
    subcommands,
    riskTier,
    suggestedTimeoutMs: timeoutForRisk(riskTier),
    requiresConfirmation: riskTier === "state_mutating" || riskTier === "external_side_effect" || riskTier === "dangerous",
  };
}

export async function getCliMetadata(args: string[] = []): Promise<CliCommandNode> {
  const normalizedArgs = args[0] === "help" ? [] : args;
  const cacheKey = normalizedArgs.join(" ");
  const cached = metadataCache.get(cacheKey);
  if (cached) return cached;

  const parseAndCache = (output: string, fallbackMessage?: string) => {
    const parsed = output.trim()
      ? parseHelpText(normalizedArgs, output)
      : buildFallbackMetadata(normalizedArgs, fallbackMessage);
    metadataCache.set(cacheKey, parsed);
    return parsed;
  };

  try {
    const { stdout, stderr } = await execOpenclaw([...normalizedArgs, "--help"]);
    return parseAndCache(`${stdout}\n${stderr}`, "CLI metadata could not be loaded.");
  } catch (error: unknown) {
    const cliError = error as Error & { stdout?: string; stderr?: string };
    const output = `${cliError.stdout || ""}\n${cliError.stderr || ""}`.trim();
    if (output) {
      return parseAndCache(output, "CLI metadata could not be loaded.");
    }
    return parseAndCache("", cliError.message || "CLI metadata could not be loaded.");
  }
}

export function sanitizeCliArgs(args: unknown): string[] {
  if (!Array.isArray(args)) throw new Error("Args must be an array.");
  const sanitized = args.map((value) => {
    if (typeof value !== "string") throw new Error("Every arg must be a string.");
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Args must not be empty.");
    if (/[\0\r\n]/.test(trimmed)) throw new Error("Invalid control characters in args.");
    return trimmed;
  });
  if (sanitized.length > 48) throw new Error("Too many args.");
  return sanitized;
}
