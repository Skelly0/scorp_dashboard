import { test, expect } from '@playwright/test';

test.describe('Command page (replaces Status)', () => {
  test('renders Vital Signs with the Treasury (Money reserve) headline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.band-title', { hasText: 'Vital Signs' })).toBeVisible({ timeout: 10_000 });

    const treasury = page.locator('.vital').filter({ hasText: 'Treasury' });
    await expect(treasury).toContainText('Reserve');
    await expect(treasury).toContainText('₡');

    // The retired Status headline labels must be gone.
    await expect(page.locator('.kpi-label', { hasText: /^Government Revenue$/ })).toHaveCount(0);
  });

  test('toggles between the Command and Telemetry sub-views', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.band-title', { hasText: 'Vital Signs' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Telemetry' }).click();
    await expect(page.locator('.band-title', { hasText: 'Trend Telemetry' })).toBeVisible();
    await expect(page.locator('.band-title', { hasText: 'Instruments' })).toBeVisible();

    await page.getByRole('tab', { name: 'Command' }).click();
    await expect(page.locator('.band-title', { hasText: 'Resource Telemetry' })).toBeVisible();
  });

  test('scrubs the year timeline to an archive year', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.band-title', { hasText: 'Vital Signs' })).toBeVisible({ timeout: 10_000 });

    // Live → Archive chip flips when stepping back a year (requires 2 history years).
    await expect(page.locator('.tl-chip')).toHaveText('Live');
    await page.getByRole('button', { name: 'Previous year' }).click();
    await expect(page.locator('.tl-chip')).toHaveText('Archive');
  });
});
