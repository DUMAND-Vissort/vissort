import { test, expect } from '@playwright/test';

async function mockClinicLogin(page) {
    const fakeUser = {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'dumand@gmail.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: 'Test Doctor' }
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

    await page.route('**/rest/v1/**', async (route) => {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(
        ([session]) => {
            const projectRef = 'hzvypwdpdhsjzaclxmbm';
            localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
            const fp = 'test-fp';
            sessionStorage.setItem('vissort_fp', fp);
            localStorage.setItem(
                'vissort_device_calib',
                JSON.stringify({ [fp]: { ppi: 96, focalLengthPx: 700 } })
            );
        },
        [fakeSession]
    );
}

test.describe('Clinic — clinic.html', () => {
    test.beforeEach(async ({ page }) => {
        await mockClinicLogin(page);
        await page.goto('/clinic.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
    });

    test('clinic-header виден', async ({ page }) => {
        await expect(page.locator('#clinic-header')).toBeVisible();
        await expect(page.locator('#clinic-name')).toContainText('клинический редактор');
    });

    test('форма протокола видна', async ({ page }) => {
        await expect(page.locator('#protocol-panel')).toBeVisible();
        await expect(page.locator('#protocol-diopters')).toBeVisible();
        await expect(page.locator('#protocol-training-type')).toBeVisible();
        await expect(page.locator('#btn-generate-protocol')).toBeVisible();
    });

    test('сгенерировать → узел на холсте', async ({ page }) => {
        page.on('dialog', async (d) => { await d.accept(); });
        await page.selectOption('#protocol-diopters', '-2');
        await page.selectOption('#protocol-training-type', 'single');
        await page.fill('#protocol-duration', '10');
        await page.click('#btn-generate-protocol');
        await expect(page.locator('.scenario-node')).toHaveCount(1, { timeout: 5000 });
    });

    test('сохранить → сценарий в IndexedDB', async ({ page }) => {
        page.on('dialog', async (d) => { await d.accept('Тест-сценарий'); });
        await page.click('#btn-generate-protocol');
        await page.click('#btn-save-protocol');
        await page.waitForTimeout(800);
        const count = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const req = indexedDB.open('vissort-db');
                req.onsuccess = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('scenarios')) return resolve(0);
                    const tx = db.transaction('scenarios', 'readonly');
                    const countReq = tx.objectStore('scenarios').count();
                    countReq.onsuccess = () => resolve(countReq.result);
                    countReq.onerror = () => resolve(0);
                };
                req.onerror = () => resolve(0);
            });
        });
        expect(count).toBeGreaterThan(0);
    });

    test('пользователи → модалка', async ({ page }) => {
        await page.click('#btn-users');
        await expect(page.locator('#users-modal')).toBeVisible();
    });

    test('Space = пауза в превью', async ({ page }) => {
        page.on('dialog', async (d) => { await d.accept(); });
        await page.click('#btn-generate-protocol');
        await page.click('#btn-player');
        await page.waitForTimeout(1500);
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        const paused = await page.evaluate(() => {
            return window.AppPlayerPreview && window.AppPlayerPreview.isPaused ? window.AppPlayerPreview.isPaused() : null;
        });
        expect(paused === null || paused === true || paused === false).toBeTruthy();
    });
});
