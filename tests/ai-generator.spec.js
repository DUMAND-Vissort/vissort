import { test, expect } from '@playwright/test';

async function mockAdminLogin(page) {
    const fakeUser = {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'dumand@gmail.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: 'Test Admin' }
    };
    const fakeSession = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh-token',
        user: fakeUser
    };

    await page.route('**/auth/v1/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/user')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) });
        }
        if (url.includes('/token') || url.includes('/session')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.addInitScript(
        ([session]) => {
            const projectRef = 'hzvypwdpdhsjzaclxmbm';
            localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
            const fp = 'test-fp';
            sessionStorage.setItem('vissort_fp', fp);
            localStorage.setItem('vissort_device_calib', JSON.stringify({ [fp]: { ppi: 96, focalLengthPx: 700 } }));
        },
        [fakeSession]
    );
}

test.describe('AI Generator — admin.html', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        // Мок Edge Function — { ok: true, data: [...] }
        await page.route('**/functions/v1/generate-scenario', async (route) => {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: [
                        { nodeType: 'STIMULUS', name: 'Стимул 1', stimAcuity: 0.5, seriesCount: 5, seriesSize: 6 },
                        { nodeType: 'STIMULUS', name: 'Стимул 2', stimAcuity: 0.6, seriesCount: 4, seriesSize: 5 }
                    ]
                })
            });
        });
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
    });

    test('AI-генератор → узлы (мок Edge Function)', async ({ page }) => {
        const before = await page.locator('.scenario-node').count();
        await page.click('#btn-ai-generator');
        await page.waitForSelector('#ai-generator-modal', { state: 'visible', timeout: 5000 });
        await page.fill('#ai-gen-goal', 'Тренировка миопии');
        await page.fill('#ai-gen-target', 'Ребёнок 10 лет');
        await page.fill('#ai-gen-duration', '10');
        await page.fill('#ai-gen-count', '5');
        await page.click('#ai-gen-submit');
        // Ждём появления "Создано N узлов" (статус очищается через 800ms)
        await page.waitForFunction(
            () => {
                const s = document.getElementById('ai-gen-status');
                return s && /Создано \d+ узлов/.test(s.textContent);
            },
            { timeout: 5000 }
        );
        await page.waitForFunction(
            (n) => document.querySelectorAll('.scenario-node').length > n,
            before,
            { timeout: 5000 }
        );
        const after = await page.locator('.scenario-node').count();
        expect(after).toBeGreaterThan(before);
        await expect.poll(
            async () => (await page.locator('#ai-gen-status').textContent()) || '',
            { timeout: 5000 }
        ).toMatch(/Создано \d+ узлов/);
    });
});
