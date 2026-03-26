import { exec, execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

function quoteShellArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

export async function execOpenclaw(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, FORCE_COLOR: "0" };

  if (process.platform !== "win32") {
    return execFileAsync("openclaw", args, {
      maxBuffer: 10 * 1024 * 1024,
      env,
    });
  }

  const command = `openclaw ${args.map(quoteShellArg).join(" ")}`;
  return execAsync(command, {
    maxBuffer: 10 * 1024 * 1024,
    env,
    shell: "cmd.exe",
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
