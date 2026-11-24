import { test, expect } from '@playwright/test';

// Регрессия: «Живой стимул» не должен заводить вторую цветовую систему.
// Раньше плеер (VissortCore.playDynamicStimulus) считал цвет по colorTable[D * 10]
// (0.0 D → красный, 2.0 D → синий) и полностью игнорировал цвета узла из «🎨 Цвета и яркость».
// Теперь цвета берутся ТОЛЬКО из узла, а ЖС анимирует их:
//   • «Яркость %» кадра — множитель к базовой яркости (100 % = как без ЖС);
//   • D (дефокус) — снижение контраста к цвету партнёра (0 — базовые цвета, 2 — слияние с фоном).

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

// Записывает значения в поля инспектора (они скрыты, пока ЖС выключен)
async function setDynFields(page, values) {
    await page.evaluate((vals) => {
        Object.keys(vals).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) throw new Error('нет поля ' + id);
            el.value = String(vals[id]);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }, values);
}

// Запускает плеер и считывает отрисованные цвета (узла, а не colorTable)
async function playAndReadColors(page) {
    await page.evaluate(() => {
        window.AppState.nodes.forEach((n) => {
            n.isStart = true;
            n.isActive = true;
        });
    });
    await page.click('#btn-player');
    await page.waitForTimeout(900);

    return page.evaluate(() => {
        const sd = document.getElementById('stim-display');
        const path = document.querySelector('#stim svg path');
        return {
            bg: (sd?.style.backgroundColor || '').replace(/\s/g, ''),
            fill: (path?.getAttribute('fill') || '').replace(/\s/g, '')
        };
    });
}

const rgbStr = (r, g, b) => `rgb(${r},${g},${b})`;

test.describe('ЖС — единая цветовая система (цвета из «🎨 Цвета и яркость»)', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
        await page.click('#btn-add-stim');
        await page.waitForSelector('#inp-contrast', { state: 'visible', timeout: 10000 });
    });

    test('D = 0 рисует цвет стимула и фон узла, а не colorTable[0]', async ({ page }) => {
        const node = await activeNode(page);

        await page.check('#dyn-enabled');
        await setDynFields(page, {
            'dyn-stim-start': 0,
            'dyn-stim-end': 0,
            'dyn-bg-start': 0,
            'dyn-bg-end': 0
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        // Стимул — базовый цвет узла (255,255,255), фон — базовый фон узла (11,11,13)
        expect(shown.fill).toBe(rgbStr(node.stimR, node.stimG, node.stimB));
        expect(shown.bg).toBe(rgbStr(node.bgR, node.bgG, node.bgB));
        // Красный из colorTable[0] появляться не должен
        expect(shown.fill).not.toBe('rgb(255,0,0)');
        expect(shown.bg).not.toBe('rgb(255,0,0)');
    });

    test('«Яркость %» кадра — множитель к базовой яркости (100 % = как без ЖС)', async ({ page }) => {
        const node = await activeNode(page);

        await page.check('#dyn-enabled');
        await setDynFields(page, {
            'dyn-stim-start': 0,
            'dyn-stim-end': 0,
            'dyn-stim-bright-start': 50,
            'dyn-stim-bright-end': 50
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        expect(shown.fill).toBe(
            rgbStr(
                Math.round(node.stimR * 0.5),
                Math.round(node.stimG * 0.5),
                Math.round(node.stimB * 0.5)
            )
        );
    });

    test('D = 2 сливает стимул с фоном, оттенок не подменяется', async ({ page }) => {
        const node = await activeNode(page);

        await page.check('#dyn-enabled');
        await setDynFields(page, {
            'dyn-stim-start': 2,
            'dyn-stim-end': 2
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        // Дефокус — падение контраста к цвету партнёра, а не синий цвет из colorTable[20]
        expect(shown.fill).toBe(rgbStr(node.bgR, node.bgG, node.bgB));
        expect(shown.fill).not.toBe('rgb(0,0,255)');
    });
});
