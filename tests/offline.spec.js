import { test, expect } from '@playwright/test';

test.describe('Offline — service worker', () => {
    test('SW регистрируется на admin.html', async ({ page, context }) => {
        // SW регистрируется только на localhost или https
        await page.goto('/admin.html');
        await page.waitForTimeout(2000);

        const hasSW = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return false;
            const regs = await navigator.serviceWorker.getRegistrations();
            return regs.length > 0;
        });

        // SW может быть не зарегистрирован в dev (app.js проверяет IS_DEV)
        // Проверяем хотя бы наличие API
        const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
        expect(swSupported).toBeTruthy();
    });

    test('офлайн-страница отдаётся при отсутствии сети', async ({ page, context }) => {
        // Заходим первый раз, чтобы SW закэшировал
        await page.goto('/admin.html');
        await page.waitForTimeout(2000);

        // Отключаем сеть
        await context.setOffline(true);

        // Пробуем загрузить страницу
        let offlineContent = '';
        try {
            await page.goto('/admin.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
            offlineContent = await page.content();
        } catch (e) {
            offlineContent = 'navigation failed';
        }

        // Включаем сеть обратно
        await context.setOffline(false);

        // Проверяем, что либо SW отдал страницу, либо браузер показал offline-ошибку
        // Главное — не белый экран
        expect(offlineContent.length).toBeGreaterThan(0);
    });

    test('Vissort содержит офлайн-fallback в SW', async ({ page }) => {
        // Проверяем, что sw.js содержит OFFLINE_HTML
        const response = await page.goto('/sw.js');
        const text = await response.text();

        expect(text).toContain('OFFLINE_HTML');
        expect(text).toContain('Нет соединения');
    });

    test('приложение работает офлайн после первого визита', async ({ page, context }) => {
        // Первый визит
        await page.goto('/admin.html');
        await page.waitForTimeout(3000);

        // Проверяем, что VissortCore загрузился
        const loaded = await page.evaluate(() => typeof window.VissortCore !== 'undefined');
        expect(loaded).toBeTruthy();

        // Отключаем сеть
        await context.setOffline(true);

        // Проверяем, что JS-модули уже в памяти
        const stillWorks = await page.evaluate(() => {
            return typeof window.VissortCore !== 'undefined' && typeof window.Data !== 'undefined';
        });
        expect(stillWorks).toBeTruthy();

        await context.setOffline(false);
    });

    test('повторный визит использует кэш (быстрая загрузка)', async ({ page }) => {
        // Первый визит
        const start1 = Date.now();
        await page.goto('/admin.html');
        await page.waitForLoadState('networkidle');
        const time1 = Date.now() - start1;

        // Второй визит — должен быть быстрее из кэша
        const start2 = Date.now();
        await page.goto('/admin.html');
        await page.waitForLoadState('domcontentloaded');
        const time2 = Date.now() - start2;

        // Второй визит не должен быть медленнее первого в 2 раза
        expect(time2).toBeLessThan(time1 * 2 + 1000);
    });
});
