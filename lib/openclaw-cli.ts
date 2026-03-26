import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface OpenClawRunResult {
  args: string[];
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs: number;
  timedOut: boolean;
}

function renderCommand(args: string[]): string {
  const quoted = args.map((arg) => {
    if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) return arg;
    return JSON.stringify(arg);
  });
  return ["openclaw", ...quoted].join(" ");
}

export async function execOpenclaw(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, FORCE_COLOR: "0" };
  return execFileAsync("openclaw", args, {
    maxBuffer: 10 * 1024 * 1024,
    env,
  });
}

export async function runOpenclaw(args: string[], timeoutMs = 20_000): Promise<OpenClawRunResult> {
  const env = { ...process.env, FORCE_COLOR: "0" };
  const startedAt = Date.now();
  const command = renderCommand(args);

  return new Promise((resolve) => {
    execFile(
      "openclaw",
      args,
      {
        env,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const maybeError = error as NodeJS.ErrnoException & {
          code?: string | number;
          signal?: NodeJS.Signals;
          killed?: boolean;
        };
        resolve({
          args,
          command,
          stdout,
          stderr,
          exitCode: typeof maybeError?.code === "number" ? maybeError.code : 0,
          runtimeMs: Date.now() - startedAt,
          timedOut: maybeError?.signal === "SIGTERM" || maybeError?.killed === true,
        });
      },
    );
  });
}

export function parseJsonFromMixedOutput(output: string): unknown {
  for (let i = 0; i < output.length; i++) {
    if (output[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < output.length; j++) {
      const ch = output[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = output.slice(i, j + 1).trim();
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
