import { test, expect } from '@playwright/test';

test.describe('Status page vital signs', () => {
  test('labels the treasury metric as Government Revenue', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.band-title', { hasText: 'Vital Signs' })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator('.kpi-label', { hasText: /^Government Revenue$/ })).toBeVisible();
    await expect(page.locator('.kpi-label', { hasText: /^Treasury$/ })).toHaveCount(0);
  });
});
