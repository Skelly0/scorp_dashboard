import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/#/map',
  '/#/population',
  '/#/demographics',
  '/#/gois',
  '/#/tech',
  '/#/parties',
  '/#/situations',
];

test.describe('mobile route smoke', () => {
  test('routes render without body-level horizontal overflow', async ({ page, request }) => {
    const routes = [...ROUTES];
    const senate = await request.get('/data/senate.json');
    if (senate.ok() && senate.headers()['content-type']?.includes('application/json')) routes.push('/#/senate');

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.band, .kpi-block, .s-card, canvas[role="application"]').first()).toBeVisible({ timeout: 10000 });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
    }

    expect(errors).toEqual([]);
  });
});
