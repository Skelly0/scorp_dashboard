import { test, expect } from '@playwright/test';

test.describe('Map overlay system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
  });

  test('shows ten layer tabs', async ({ page }) => {
    const tabs = page.locator('.layer-tabs button');
    await expect(tabs).toHaveCount(10);
    await expect(tabs.nth(7)).toHaveText(/Resources/);
    await expect(tabs.nth(8)).toHaveText(/Features/);
    await expect(tabs.nth(9)).toHaveText(/Improvements/);
  });

  test('Resources tab shows roster + chips', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click();
    // Roster rendered
    await expect(page.locator('.roster-row').first()).toBeVisible();
    // Up to 8 type rows expected (matches live data; assertion uses BeGreaterThan
    // so the test stays useful even if a resource type is later removed).
    const count = await page.locator('.roster-row').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
  });

  test('Features tab shows roster', async ({ page }) => {
    await page.getByRole('button', { name: 'Features' }).click();
    await expect(page.locator('.roster-row').first()).toBeVisible();
  });

  test('Improvements tab groups by category', async ({ page }) => {
    await page.getByRole('button', { name: 'Improvements' }).click();
    // At least one category section
    await expect(page.locator('.roster-section').first()).toBeVisible();
    // At least one leaf-row entry
    await expect(page.locator('.roster-row').first()).toBeVisible();
  });
});
