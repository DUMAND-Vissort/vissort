import { test, expect } from '@playwright/test';

test.describe('Login — admin.html', () => {
    test('открывается страница логина', async ({ page }) => {
        await page.goto('/admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await expect(page).toHaveTitle(/Vissort/);
        await expect(page.locator('#auth-modal')).toBeVisible();
    });

    test('не-админ редиректится на user.html', async ({ page }) => {
        test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD не заданы');
        await page.goto('/admin.html');
        await page.waitForSelector('#auth-email', { state: 'visible' });

        await page.fill('#auth-email', process.env.TEST_EMAIL || 'test@vissort.com');
        await page.fill('#auth-password', process.env.TEST_PASSWORD || '459188@Rape');
        await page.click('#auth-submit');

        // Ждём любой из признаков: либо URL сменился, либо появилась шапка player.html
        await page.waitForFunction(
            () => {
                if (location.href.includes('user.html')) return true;
                const games = document.getElementById('btn-games');
                return games && getComputedStyle(games).display !== 'none';
            },
            { timeout: 15000 }
        );

        const url = page.url();
        const hasGamesBtn = await page.locator('#btn-games').count();
        expect(url.includes('user.html') || hasGamesBtn > 0).toBeTruthy();
    });

    test('неверный пароль — показывается ошибка', async ({ page }) => {
        await page.route('**/auth/v1/**', async (route) => {
            return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
        });
        await page.goto('/admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#auth-email', { state: 'visible' });

        await page.fill('#auth-email', 'wrong@vissort.com');
        await page.fill('#auth-password', 'wrong-password-123');

        await page.click('#auth-submit');
        // VissortDialog — HTML-модалка, не нативный alert.
        await page.waitForSelector('#vissort-dialog[open]', { timeout: 10000 });
        const msg = await page.textContent('#vd-msg');
        expect(msg).toMatch(/ошибка|error|invalid/i);
        await page.click('#vd-ok');
    });
});
