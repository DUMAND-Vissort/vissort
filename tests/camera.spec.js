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

    await page.route('**/rest/v1/**', async (route) => {
        const url = route.request().url();
        if (url.includes('user_scenarios')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'assign-1', user_id: fakeUser.id, scenario_id: 'sc-1', status: 'ready' }]) });
        }
        if (url.includes('scenarios')) {
            const scenario = {
                id: 'sc-1',
                name: 'Camera test scenario',
                training_type: 'single',
                params: {
                    trainingType: 'single',
                    startAcuity: 0.5,
                    endAcuity: 1.0,
                    acuityStep: 0.1,
                    distanceMeters: 1,
                    ppi: 96,
                    seriesCount: 1,
                    seriesSize: 2,
                    seriesThreshold: 1,
                    startStimColor: { r: 255, g: 255, b: 255 },
                    startBgColor: { r: 0, g: 0, b: 0 },
                    duration: 3000,
                    delay1: 100,
                    delay2: 100,
                    response: 0,
                    isActive: true
                }
            };
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([scenario]) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(([session]) => {
        const projectRef = 'hzvypwdpdhsjzaclxmbm';
        localStorage.setItem('sb-' + projectRef + '-auth-token', JSON.stringify(session));
        localStorage.setItem('vissort_cam_preview', '0');

        // Мок getUserMedia: фейковый MediaStream с canvas-треком
        const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async function (constraints) {
            if (constraints && constraints.video) {
                const canvas = document.createElement('canvas');
                canvas.width = 480;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, 480, 360);
                ctx.fillStyle = '#fff';
                ctx.font = '20px sans-serif';
                ctx.fillText('MOCK CAMERA', 120, 180);
                const stream = canvas.captureStream(15);
                return stream;
            }
            return origGetUserMedia(constraints);
        };
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

test.describe('Camera — player.html', () => {
    test.beforeEach(async ({ page }) => {
        await mockUserLogin(page);
        await page.goto('/player.html');
        await killOnboarding(page);
        await page.waitForSelector('#btn-player', { state: 'visible', timeout: 15000 });
    });

    test('страница содержит элементы камеры', async ({ page }) => {
        const hasCamIndicator = await page.locator('#cam-indicator').count();
        expect(hasCamIndicator).toBeGreaterThan(0);
    });

    test('индикатор камеры доступен для отображения', async ({ page }) => {
        const camIndicator = page.locator('#cam-indicator');
        await expect(camIndicator).toHaveCount(1);
    });

    test('при запуске плеера камера инициализируется (мок)', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');
        await page.waitForTimeout(2000);

        const camState = await page.evaluate(() => {
            const cam = document.getElementById('cam-indicator');
            return {
                exists: !!cam,
                display: cam ? getComputedStyle(cam).display : 'none',
                text: cam ? cam.textContent.trim() : ''
            };
        });

        expect(camState.exists).toBeTruthy();
        expect(errors).toHaveLength(0);
    });

    test('превью камеры в overlay не блокирует плеер', async ({ page }) => {
        await page.waitForFunction(() => {
            const b = document.getElementById('btn-player');
            return b && !b.disabled;
        }, { timeout: 15000 });

        await page.click('#btn-player');
        await page.waitForTimeout(1500);

        // Плеер работает несмотря на камеру
        const stopEnabled = await page.evaluate(() => {
            const b = document.getElementById('btn-player-stop');
            return b && !b.disabled;
        });
        expect(stopEnabled).toBeTruthy();

        // Останавливаем
        await page.click('#btn-player-stop');
        await page.waitForTimeout(500);
    });
});
