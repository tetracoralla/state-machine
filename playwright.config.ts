import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/ui",
  use: {
    baseURL: "http://127.0.0.1:4317",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:ui -- --host 127.0.0.1 --port 4317",
    port: 4317,
    reuseExistingServer: false,
  },
});

