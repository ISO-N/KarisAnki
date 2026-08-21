import { defineConfig, devices } from "@playwright/test";

const frontendPort = Number(process.env.TEST_FRONTEND_PORT ?? 18082);
const backendPort = Number(process.env.TEST_BACKEND_PORT ?? 18081);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});

export { backendPort, frontendPort };
