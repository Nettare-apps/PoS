import { defineConfig, devices } from '@playwright/test';

/* In the Claude Code cloud container a matching Chromium is preinstalled;
 * point PW_CHROMIUM at it (e.g. /opt/pw-browsers/chromium) instead of
 * downloading browsers. CI installs browsers normally. */
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
