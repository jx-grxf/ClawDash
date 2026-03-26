import os from "os";
import path from "path";

const home = os.homedir();

export const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(home, ".openclaw");
export const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");
export const OPENCLAW_AGENTS_DIR = path.join(OPENCLAW_HOME, "agents");
export const OPENCLAW_PIXEL_OFFICE_DIR = path.join(OPENCLAW_HOME, "pixel-office");
