import { test, expect } from '@playwright/test';

// Регрессия: «Применить» на обычном узле не должно включать «Живой стимул».
// Причина бага: инспектор рисовал чекбокс #dyn-enabled как отмеченный для узлов без ЖС
// (dyn.active !== false), Apply писал stimulusDynamic.active = true, плеер уходил
// в динамический путь, где D = 0 → colorTable[0] = rgb(255,0,0) и для стимула, и для фона.

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
            localStorage.setItem(
                'vissort_device_calib',
                JSON.stringify({ [fp]: { ppi: 96, focalLengthPx: 700 } })
            );
        },
        [fakeSession]
    );
}

const activeNode = (page) =>
    page.evaluate(() => {
        const st = window.AppState;
        return st.nodes.find((x) => x.id === st.activeNodeId) || st.nodes[0];
    });

test.describe('Живой стимул (ЖС) — переключатель в инспекторе', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
        await page.click('#btn-add-stim');
        await page.waitForSelector('#inp-contrast', { state: 'visible', timeout: 10000 });
    });

    test('у нового узла чекбокс ЖС снят', async ({ page }) => {
        const checked = await page.evaluate(() => document.getElementById('dyn-enabled')?.checked);
        expect(checked).toBe(false);
    });

    test('«Применить» не включает ЖС у обычного узла', async ({ page }) => {
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const node = await activeNode(page);
        expect(node.params?.stimulusDynamic?.active === true).toBe(false);

        // и после повторного рендера галочка остаётся снятой
        const rechecked = await page.evaluate(() => document.getElementById('dyn-enabled')?.checked);
        expect(rechecked).toBe(false);
    });

    test('явное включение ЖС сохраняется', async ({ page }) => {
        await page.check('#dyn-enabled');
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const node = await activeNode(page);
        expect(node.params?.stimulusDynamic?.active).toBe(true);
    });

    test('плеер после «Применить» рисует фон узла, а не красный D = 0', async ({ page }) => {
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const nodeBefore = await activeNode(page);
        const bgRgb = `rgb(${nodeBefore.bgR},${nodeBefore.bgG},${nodeBefore.bgB})`;

        await page.evaluate(() => {
            window.AppState.nodes.forEach((n) => {
                n.isStart = true;
                n.isActive = true;
            });
        });
        await page.click('#btn-player');
        await page.waitForTimeout(800);

        const shown = await page.evaluate(() => {
            const sd = document.getElementById('stim-display');
            const stim = document.getElementById('stim');
            const path = stim?.querySelector('svg path');
            return {
                bg: sd?.style.backgroundColor || '',
                fill: path?.getAttribute('fill') || ''
            };
        });

        // Фон — цвет узла (11,11,13), а не colorTable[0] = 255,0,0
        expect(shown.bg.replace(/\s/g, '')).toBe(bgRgb.replace(/\s/g, ''));
        expect(shown.bg).not.toBe('rgb(255, 0, 0)');
        // Буква не должна быть красной на красном
        expect(shown.fill.replace(/\s/g, '')).not.toBe('rgb(255,0,0)');
    });
});
