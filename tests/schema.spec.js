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
        access_token: 'mock',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh',
        user: fakeUser
    };

    await page.route('**/auth/v1/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/user')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(fakeUser)
            });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fakeSession)
        });
    });

    await page.addInitScript(
        ([session]) => {
            const projectRef = 'hzvypwdpdhsjzaclxmbm';
            localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
            const fp = 'test-fp';
            sessionStorage.setItem('vissort_fp', fp);
            localStorage.setItem(
                'vissort_device_calib',
                JSON.stringify({
                    [fp]: { ppi: 96, focalLengthPx: 700 }
                })
            );
        },
        [fakeSession]
    );
}

test.describe('Schema version — миграция', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
    });

    test('новый сценарий сохраняется с schemaVersion: 2', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Проверяем наличие migrateScenario в global scope
            const hasMigrate = typeof window.migrateScenario !== 'undefined';

            // Сохраняем сценарий со schemaVersion 2 через API
            const record = {
                id: 'schema-test-' + Date.now(),
                name: 'Schema test v2',
                training_type: 'single',
                params: {
                    schemaVersion: 2,
                    scenarioKey: 'test-key',
                    graph: { nodes: [], connections: [], books: {} }
                }
            };
            await window.Data.saveScenario(record);
            const loaded = await window.Data.getScenarioById(record.id);
            return {
                hasMigrate,
                savedSchemaVersion: loaded?.params?.schemaVersion
            };
        });

        expect(result.savedSchemaVersion).toBe(2);
    });

    test('старый сценарий без schemaVersion читается', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Сохраняем сценарий БЕЗ schemaVersion (как v1)
            const record = {
                id: 'schema-test-v1-' + Date.now(),
                name: 'Schema test v1',
                training_type: 'single',
                params: {
                    scenarioKey: 'test-key-v1',
                    graph: { nodes: [], connections: [], books: {} }
                }
            };
            await window.Data.saveScenario(record);
            const loaded = await window.Data.getScenarioById(record.id);
            return {
                exists: !!loaded,
                schemaVersion: loaded?.params?.schemaVersion
            };
        });

        // Сценарий должен сохраниться даже без версии
        expect(result.exists).toBeTruthy();
        // И значение должно быть undefined — миграция происходит при загрузке графа, не в Data
        expect(result.schemaVersion).toBeUndefined();
    });
});
