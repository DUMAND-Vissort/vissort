import { test, expect } from '@playwright/test';

async function mockUserLogin(page) {
    const fakeUser = {
        id: '00000000-0000-0000-0000-000000000002',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@vissort.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: 'Test User' }
    };
    const fakeSession = {
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh',
        user: fakeUser
    };

    await page.route('**/auth/v1/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/user')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession) });
    });

    await page.route('**/rest/v1/user_scenarios**', async (route) => {
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: 'assign-1', user_id: fakeUser.id, scenario_id: 'sc-1', status: 'ready' }])
        });
    });

    await page.route('**/rest/v1/scenarios**', async (route) => {
        const scenario = {
            id: 'sc-1',
            name: 'Test reading scenario',
            training_type: 'reading',
            params: {
                trainingType: 'reading',
                text: 'Первое предложение текста.\nВторое предложение.\nТретье предложение для чтения.\nЧетвёртое предложение тоже есть.\nПятое предложение завершает блок.',
                textColor: { r: 0, g: 0, b: 0 },
                bgMode: 'solid',
                bgColor: { r: 255, g: 255, b: 255 },
                readingDistance: 1,
                ppi: 96,
                duration: 600000,
                isActive: true
            }
        };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([scenario]) });
    });

    await page.route('**/rest/v1/test_results**', async (route) => {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/training_sessions**', async (route) => {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(([session]) => {
        const projectRef = 'hzvypwdpdhsjzaclxmbm';
        localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
        localStorage.setItem('vissort_cam_preview', '0');
    }, [fakeSession]);
}

async function killOnboarding(page) {
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        const el = document.getElementById('vissort-onboarding');
        if (el) el.remove();
    });
    await page.evaluate(() => {
        const fp = 'test-fp';
        sessionStorage.setItem('vissort_fp', fp);
        localStorage.setItem('vissort_device_calib', JSON.stringify({
            [fp]: { ppi: 96, focalLengthPx: 700 }
        }));
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        const el = document.getElementById('vissort-onboarding');
        if (el) el.remove();
    });
}

test.describe('Reading — player.html', () => {
    test.beforeEach(async ({ page }) => {
        await mockUserLogin(page);
        await page.goto('/player.html');
        await killOnboarding(page);
        await page.waitForSelector('#btn-player', { state: 'visible', timeout: 15000 });
    });

    test('страница плеера загружается для чтения', async ({ page }) => {
        await expect(page).toHaveTitle(/Vissort/);
        await expect(page.locator('#btn-player')).toBeVisible();
    });

    test('старт открывает viewport чтения', async ({ page }) => {
        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');

        // Ждём, что reading-viewport стал видимым
        await page.waitForFunction(() => {
            const v = document.getElementById('reading-viewport');
            return v && getComputedStyle(v).display === 'block';
        }, { timeout: 15000 });

        const viewportVisible = await page.evaluate(() => {
            const v = document.getElementById('reading-viewport');
            return v && getComputedStyle(v).display === 'block';
        });
        expect(viewportVisible).toBeTruthy();
    });

    test('текст из сценария отображается', async ({ page }) => {
        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');

        await page.waitForFunction(() => {
            const c = document.getElementById('reading-content');
            return c && c.textContent.trim().length > 0;
        }, { timeout: 15000 });

        const content = await page.evaluate(() => {
            return document.getElementById('reading-content')?.textContent || '';
        });

        expect(content).toContain('Первое предложение');
    });

    test('toolbar чтения видим при активном чтении', async ({ page }) => {
        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');

        await page.waitForFunction(() => {
            const t = document.getElementById('reading-toolbar');
            return t && getComputedStyle(t).display === 'flex';
        }, { timeout: 15000 });

        const toolbarVisible = await page.evaluate(() => {
            const t = document.getElementById('reading-toolbar');
            return t && getComputedStyle(t).display === 'flex';
        });
        expect(toolbarVisible).toBeTruthy();
    });

    test('кнопка Закончить закрывает чтение', async ({ page }) => {
        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');

        await page.waitForFunction(() => {
            const t = document.getElementById('reading-toolbar');
            return t && getComputedStyle(t).display === 'flex';
        }, { timeout: 15000 });

        // Нажимаем Закончить
        await page.click('#reading-finish');
        await page.waitForTimeout(800);

        // Viewport скрыт
        const viewportHidden = await page.evaluate(() => {
            const v = document.getElementById('reading-viewport');
            return !v || getComputedStyle(v).display === 'none';
        });
        expect(viewportHidden).toBeTruthy();
    });
});
