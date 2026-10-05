const { defineConfig, devices } = require("@playwright/test");

// 本番URLに対して流したいときは PW_BASE_URL を指定する。
// 例: PW_BASE_URL=https://logee-logic-tree.vercel.app npx playwright test
// その場合はローカルの静的サーバーを起動しない。
const baseURL = process.env.PW_BASE_URL || "http://localhost:4173";
const useLocalServer = !process.env.PW_BASE_URL;

module.exports = defineConfig({
  testDir: ".",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "off",
  },
  // PW_CHANNEL=chrome で実機の Chrome に切り替えられる（同梱Chromiumとの差を見るとき用）
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) },
    },
  ],
  webServer: useLocalServer
    ? {
        command: "node static-server.js",
        url: "http://localhost:4173",
        reuseExistingServer: true,
        timeout: 20_000,
      }
    : undefined,
});
