import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;
const WEBDAV_PORT = 8090;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Launch BOTH the WebDAV server (rclone over ./sample) and the
  // built adapter-node app before the tests, and tear both down after.
  webServer: [
    {
      command: `rclone serve webdav ./sample --addr :${WEBDAV_PORT} --user demo --pass secret --dir-cache-time 2s`,
      url: `http://127.0.0.1:${WEBDAV_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `node build`,
      url: BASE,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOST: '127.0.0.1',
        WEBDAV_URL: `http://127.0.0.1:${WEBDAV_PORT}/`,
        WEBDAV_USER: 'demo',
        WEBDAV_PASS: 'secret',
        WEBDAV_TTL_MS: '5000',
      },
    },
  ],
});
