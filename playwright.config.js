import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:5500',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'npx serve -l 5500 .',
        url: 'http://localhost:5500/admin.html',
        reuseExistingServer: true,
        timeout: 60000,
        stdout: 'ignore',
        stderr: 'pipe'
    }
});
