import { test, expect } from '@playwright/test';

test.describe('Login — admin.html', () => {
    test('открывается страница логина', async ({ page }) => {
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(/Vissort/);
        await expect(page.locator('#auth-modal')).toBeVisible();
    });

    test('не-админ редиректится на user.html', async ({ page }) => {
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
        await page.goto('/admin.html');
        await page.waitForSelector('#auth-email', { state: 'visible' });

        await page.fill('#auth-email', 'wrong@vissort.com');
        await page.fill('#auth-password', 'wrong-password-123');

        const dialogPromise = page.waitForEvent('dialog', { timeout: 10000 });
        await page.click('#auth-submit');
        const dialog = await dialogPromise;
        expect(dialog.message()).toMatch(/ошибка|error|invalid/i);
        await dialog.dismiss();
    });
});
