import { test, expect } from '@playwright/test';

// Регрессия: цвет в ЖС задаётся ТОЛЬКО шкалой D ↔ λ (продольная хроматическая аберрация).
//   0.0 D → красный  ≈670 нм
//   2.0 D → сине-фиолетовый ≈423 нм
// Единый источник — VissortCore.PHYSIO_SCALE / colorTable / getColorByD (см. физику в ядре).
// Из «🎨 Цвета и яркость» при активном ЖС работает только ЯРКОСТЬ (контраст):
// «Яркость %» кадра — множитель к базовой яркости узла (100 % = как задано).

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
async function setFields(page, values) {
    await page.evaluate((vals) => {
        Object.keys(vals).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) throw new Error('нет поля ' + id);
            el.value = String(vals[id]);
            el.dispatchEvent(new window.Event('input', { bubbles: true }));
            el.dispatchEvent(new window.Event('change', { bubbles: true }));
        });
    }, values);
}

// Запускает плеер и считывает отрисованные цвета
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

const rgbStr = (c) => `rgb(${c.r},${c.g},${c.b})`;


test.describe('ЖС — цвета по шкале диоптрий (LCA: 0 D = 670 нм, 2 D = 423 нм)', () => {
    test.beforeEach(async ({ page }) => {
        await mockAdminLogin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('#main-layout', { state: 'visible', timeout: 20000 });
        await page.click('#btn-add-stim');
        await page.waitForSelector('#inp-contrast', { state: 'visible', timeout: 10000 });
    });

    test('шкала D ↔ λ монотонна: 0.0 D = 670 нм, 2.0 D ≈ 423 нм', async ({ page }) => {
        const scale = await page.evaluate(() => window.VissortCore.PHYSIO_SCALE);

        expect(scale).toHaveLength(21);
        expect(scale[0].diopters).toBe(0);
        expect(scale[20].diopters).toBe(2);
        expect(scale[0].wavelength_nm).toBe(670);
        // LCA: синий конец ≈ 423 нм (CDR 670→400 нм = 2.4 дптр)
        expect(Math.abs(scale[20].wavelength_nm - 423)).toBeLessThanOrEqual(2);

        // длина волны падает с ростом D, шаг 0.1 дптр — монотонный
        for (let i = 1; i < scale.length; i++) {
            expect(scale[i].wavelength_nm).toBeLessThan(scale[i - 1].wavelength_nm);
        }
        // цвет 0.0 D — красный, 2.0 D — сине-фиолетовый
        const first = scale[0].rgb;
        const last = scale[20].rgb;
        expect(first.r).toBeGreaterThan(first.g + first.b);
        expect(last.b).toBeGreaterThan(last.r);
    });

    test('D = 0 рисует красный шаг шкалы (670 нм), а не цвет узла', async ({ page }) => {
        const table = await page.evaluate(() => window.VissortCore.colorTable);
        const node = await activeNode(page);

        await page.check('#dyn-enabled');
        await setFields(page, {
            'dyn-stim-start': 0,
            'dyn-stim-end': 0,
            'dyn-bg-start': 0,
            'dyn-bg-end': 0
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        // И стимул, и фон — цвет шага 0.0 D (670 нм, ≈ rgb(181,0,0))
        expect(shown.fill).toBe(rgbStr(table[0]));
        expect(shown.bg).toBe(rgbStr(table[0]));
        // Баг «красный на красном» возникал из-за цвета узла, а не из-за шкалы:
        // белый стимул узла в ЖС не попадает
        expect(shown.fill).not.toBe(rgbStr({ r: node.stimR, g: node.stimG, b: node.stimB }));
    });

    test('D = 2 даёт сине-фиолетовый шаг (423 нм), а не прежний «чистый синий»', async ({ page }) => {
        const table = await page.evaluate(() => window.VissortCore.colorTable);

        await page.check('#dyn-enabled');
        await setFields(page, {
            'dyn-stim-start': 2,
            'dyn-stim-end': 2
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        expect(shown.fill).toBe(rgbStr(table[20]));
        // Синий канал доминирует, красный не нулевой (фиолетовый оттенок 423 нм)
        expect(table[20].b).toBeGreaterThan(table[20].r);
        expect(table[20].r).toBeGreaterThan(0);
    });

    test('«Яркость %» кадра — множитель к базовой яркости, оттенок не меняется', async ({ page }) => {
        const table = await page.evaluate(() => window.VissortCore.colorTable);

        await page.check('#dyn-enabled');
        await setFields(page, {
            'dyn-stim-start': 0,
            'dyn-stim-end': 0,
            'dyn-stim-bright-start': 50,
            'dyn-stim-bright-end': 50
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        expect(shown.fill).toBe(
            rgbStr({
                r: Math.round(table[0].r * 0.5),
                g: Math.round(table[0].g * 0.5),
                b: Math.round(table[0].b * 0.5)
            })
        );
    });

    test('цвет узла не влияет на оттенок ЖС — только яркость узла', async ({ page }) => {
        const table = await page.evaluate(() => window.VissortCore.colorTable);

        // Красим стимул узла в зелёный и снижаем базовую яркость до 50 %
        await setFields(page, { 'inp-color': '#00ff00', 'inp-stim-brightness': 50, 'inp-bg-brightness': 100 });

        await page.check('#dyn-enabled');
        await setFields(page, {
            'dyn-stim-start': 0,
            'dyn-stim-end': 0
        });
        await page.click('#inp-apply');
        await page.waitForTimeout(300);

        const shown = await playAndReadColors(page);

        // Оттенок — из шкалы D (красный 670 нм), яркость — базовая 50 %
        expect(shown.fill).toBe(
            rgbStr({
                r: Math.round(table[0].r * 0.5),
                g: Math.round(table[0].g * 0.5),
                b: Math.round(table[0].b * 0.5)
            })
        );
        expect(shown.fill).not.toBe('rgb(0,128,0)');
    });

    test('чипы предпросмотра у полей D показывают цвет шага шкалы', async ({ page }) => {
        const table = await page.evaluate(() => window.VissortCore.colorTable);

        await page.check('#dyn-enabled');
        await setFields(page, {
            'dyn-stim-start': 1,
            'dyn-bg-start': 2
        });
        await page.waitForTimeout(300);

        const swatches = await page.evaluate(() => {
            const pick = (id) => {
                const el = document.getElementById(id);
                return el ? el.style.background.replace(/\s/g, '') : '';
            };
            return {
                stim: pick('dyn-sw-stim-start'),
                bg: pick('dyn-sw-bg-start')
            };
        });

        expect(swatches.stim).toBe(rgbStr(table[10]));
        expect(swatches.bg).toBe(rgbStr(table[20]));
    });
});
