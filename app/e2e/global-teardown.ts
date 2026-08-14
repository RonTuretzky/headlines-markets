import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown() {
  const pidFile = join(__dirname, ".anvil-pid");
  try {
    const pid = Number(readFileSync(pidFile, "utf8"));
    process.kill(pid);
    rmSync(pidFile);
  } catch {
    /* already gone */
  }
}
