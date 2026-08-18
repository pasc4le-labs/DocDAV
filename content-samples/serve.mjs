// Stands up a throwaway WebDAV server over `content-samples/` using rclone,
// so the POC can be validated locally against the real WebDAV protocol without
// touching a remote drive. Serves on http://127.0.0.1:8090 (user: demo / pass: secret).
//
// Usage:  node content-samples/serve.mjs [dir] [port]
// Ctrl-C to stop.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default to the self-contained sample dir this script lives in (repo root /content-samples).
const dir = path.resolve(process.argv[2] ?? __dirname);
const port = process.argv[3] ?? "8090";
const user = process.env.WEBDAV_USER || "demo";
const pass = process.env.WEBDAV_PASS || "secret";

const rclone = process.env.RCLONE_BIN || "rclone";
const useRemoteConfig = process.env.RCLONE_REMOTE_NAME; // optional: serve a named remote

const serveArg = useRemoteConfig ? `${useRemoteConfig}:` : dir;
const extraEnv = useRemoteConfig
  ? {
      RCLONE_CONFIG_SAMPLE_TYPE: "local",
      RCLONE_CONFIG_SAMPLE_DIR: dir,
    }
  : {};

const child = spawn(
  rclone,
  [
    "serve",
    "webdav",
    serveArg,
    `--addr=:${port}`,
    `--user=${user}`,
    `--pass=${pass}`,
    // Keep dir listings fresh so the local harness behaves like a live drive
    // (rclone caches listings ~5min by default, which would mask new files).
    "--dir-cache-time=2s",
    "--verbose",
  ],
  {
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "inherit", "inherit"],
  }
);

console.log(`[webdav-sample] serving ${dir} -> http://127.0.0.1:${port} (${user}/${pass})`);

const cleanup = () => child.kill("SIGINT");
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
child.on("exit", (code) => {
  console.log(`[webdav-sample] rclone exited (${code})`);
  process.exit(code ?? 0);
});
