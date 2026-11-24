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
            localStorage.setItem(
                'vissort_device_calib',
                JSON.stringify({ [fp]: { ppi: 96, focalLengthPx: 700 } })
            );
        },
        [fakeSession]
    );
}

const setInput = (page, id, value) =>
    page.evaluate(
        ([elId, v]) => {
            const el = document.getElementById(elId);
            el.value = String(v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        [id, value]
    );

test.describe('Контраст стимул/фон — инспектор', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
        await page.click('#btn-add-stim');
        await page.waitForSelector('#inp-contrast', { state: 'visible', timeout: 10000 });
    });

    test('ползунок контраста пересчитывает яркости стимула и фона', async ({ page }) => {
        await setInput(page, 'inp-contrast', 50);
        const v = await page.evaluate(() => ({
            stim: document.getElementById('inp-stim-brightness').value,
            bg: document.getElementById('inp-bg-brightness').value,
            shown: document.getElementById('inp-contrast-val').textContent,
            hint: document.getElementById('inp-contrast-hint').textContent
        }));
        // base=100, c=+0.5 → 150/50 → нормировка → 100/33 (соотношение 3:1 сохранено)
        expect(v.stim).toBe('100');
        expect(v.bg).toBe('33');
        expect(v.shown).toBe('50');
        expect(v.hint).toContain('Стимул 100%');
        expect(v.hint).toContain('Фон 33%');
    });

    test('контраст -100% даёт тёмный стимул на светлом фоне', async ({ page }) => {
        await setInput(page, 'inp-contrast', -100);
        const v = await page.evaluate(() => ({
            stim: document.getElementById('inp-stim-brightness').value,
            bg: document.getElementById('inp-bg-brightness').value,
            hint: document.getElementById('inp-contrast-hint').textContent
        }));
        expect(v.stim).toBe('0');
        expect(v.bg).toBe('100');
        expect(v.hint).toContain('Стимул 0%');
    });

    test('«Применить» сохраняет нулевую яркость (регрессия parseInt(0) || 100)', async ({ page }) => {
        await setInput(page, 'inp-contrast', -100);
        await page.click('#inp-apply');
        await page.waitForTimeout(200);
        const saved = await page.evaluate(() => {
            const st = window.AppState;
            const n = st.nodes.find((x) => x.id === st.activeNodeId) || st.nodes[0];
            return { s: n.stimBrightness, b: n.bgBrightness };
        });
        expect(saved.s).toBe(0);
        expect(saved.b).toBe(100);
    });

    test('ручная правка яркостей синхронизирует ползунок и базовую', async ({ page }) => {
        await setInput(page, 'inp-stim-brightness', 100);
        await setInput(page, 'inp-bg-brightness', 25);
        const v = await page.evaluate(() => ({
            slider: document.getElementById('inp-contrast').value,
            base: document.getElementById('inp-base-brightness').value,
            hint: document.getElementById('inp-contrast-hint').textContent
        }));
        // (100-25)/125 = 60%; base = (100+25)/2 = 63
        expect(v.slider).toBe('60');
        expect(v.base).toBe('63');
        expect(v.hint).not.toContain('изолюминантно');

        await setInput(page, 'inp-bg-brightness', 100);
        const eq = await page.evaluate(() => ({
            slider: document.getElementById('inp-contrast').value,
            hint: document.getElementById('inp-contrast-hint').textContent
        }));
        expect(eq.slider).toBe('0');
        expect(eq.hint).toContain('изолюминантно');
    });

    test('ядро: 0% яркости стимула → чёрная буква', async ({ page }) => {
        const res = await page.evaluate(() =>
            window.VissortCore.getStimulusSVG(
                {
                    stimType: 'LETTER_E',
                    stimDirection: 'up',
                    stimR: 255,
                    stimG: 255,
                    stimB: 255,
                    bgR: 0,
                    bgG: 0,
                    bgB: 0,
                    stimBrightness: 0,
                    bgBrightness: 100
                },
                120
            )
        );
        expect(res.html).toMatch(/rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/);
        expect(res.bgColor).toBe('rgb(0,0,0)');
    });
});
