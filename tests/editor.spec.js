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

    await page.addInitScript(([session]) => {
        const projectRef = 'hzvypwdpdhsjzaclxmbm';
        localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
        // Отключаем онбординг: предзаполняем калибровку для "текущего устройства"
        const fp = 'test-fp';
        sessionStorage.setItem('vissort_fp', fp);
        localStorage.setItem('vissort_device_calib', JSON.stringify({
            [fp]: { ppi: 96, focalLengthPx: 700 }
        }));
    }, [fakeSession]);
}

test.describe('Editor — admin.html', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
    });

    test('редактор загружается и холст виден', async ({ page }) => {
        await expect(page.locator('#canvas')).toBeVisible();
        await expect(page.locator('#btn-add-stim')).toBeVisible();
        await expect(page.locator('#btn-save')).toBeVisible();
    });

    test('создать узел через кнопку ➕', async ({ page }) => {
        const beforeCount = await page.locator('.scenario-node').count();
        await page.click('#btn-add-stim');
        await page.waitForTimeout(300);
        const afterCount = await page.locator('.scenario-node').count();
        expect(afterCount).toBe(beforeCount + 1);
    });

    test('сохранить и загрузить сценарий из IndexedDB', async ({ page }) => {
        const savedId = await page.evaluate(async () => {
            const record = {
                id: 'test-scenario-' + Date.now(),
                name: 'Test scenario',
                training_type: 'single',
                params: {
                    graph: {
                        nodes: [
                            { id: 'n1', nodeType: 'STIMULUS', x: 100, y: 100, width: 200, height: 180, name: 'Test 1', isStart: true },
                            { id: 'n2', nodeType: 'STIMULUS', x: 400, y: 100, width: 200, height: 180, name: 'Test 2' }
                        ],
                        connections: [{ fromId: 'n1', toId: 'n2', isLoop: false }],
                        books: {}
                    }
                }
            };
            await window.Data.saveScenario(record);
            return record.id;
        });

        expect(savedId).toBeTruthy();

        const found = await page.evaluate(async (id) => {
            const sc = await window.Data.getScenarioById(id);
            return sc ? { id: sc.id, nodeCount: sc.params?.graph?.nodes?.length || 0 } : null;
        }, savedId);

        expect(found).not.toBeNull();
        expect(found.nodeCount).toBe(2);
    });

    test('кнопка 🆕 очищает холст', async ({ page }) => {
        await page.click('#btn-add-stim');
        await page.waitForTimeout(200);
        const before = await page.locator('.scenario-node').count();
        expect(before).toBeGreaterThan(0);

        page.on('dialog', (d) => d.accept());
        await page.click('#btn-new');
        await page.waitForTimeout(500);

        const after = await page.locator('.scenario-node').count();
        expect(after).toBe(0);
    });

    test('переключение режима Узлы ↔ Стимулы', async ({ page }) => {
        await expect(page.locator('#canvas')).toBeVisible();
        await page.click('#btn-mode-toggle');
        await page.waitForTimeout(300);
        const canvasVisible = await page.locator('#canvas').isVisible();
        expect(canvasVisible).toBeFalsy();
        await page.click('#btn-mode-toggle');
        await page.waitForTimeout(300);
        await expect(page.locator('#canvas')).toBeVisible();
    });
});
