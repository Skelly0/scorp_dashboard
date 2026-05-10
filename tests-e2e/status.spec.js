import { test, expect } from '@playwright/test';

test.describe('Status page vital signs', () => {
  test('uses the Money resource as the headline economy metric', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.band-title', { hasText: 'Vital Signs' })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator('.kpi-block').filter({ hasText: /^Money/ })).toContainText('Reserve');
    await expect(page.locator('.kpi-label', { hasText: /^Government Revenue$/ })).toHaveCount(0);
    await expect(page.locator('.kpi-label', { hasText: /^Treasury$/ })).toHaveCount(0);
  });
});
