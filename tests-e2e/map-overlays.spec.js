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

test.describe('Filter persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
  });

  test('filter survives tab switch', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click();
    await page.locator('.roster-row').first().click();
    await expect(page.locator('.filter-strip')).toBeVisible();

    // Switch to Food layer (a thematic tab)
    await page.getByRole('button', { name: /Food yield/ }).click();

    // Filter strip + chip still visible
    await expect(page.locator('.filter-strip')).toBeVisible();
    await expect(page.locator('.filter-chip')).toHaveCount(1);
  });

  test('two filters intersect (count drops or stays equal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click();
    await page.locator('.roster-row').first().click();
    const singleMatchText = await page.locator('.filter-strip').innerText();
    const singleCount = parseInt(singleMatchText.match(/(\d+) matches/)?.[1] ?? '0', 10);

    await page.getByRole('button', { name: 'Features' }).click();
    await page.locator('.roster-row').first().click();

    const intersectionText = await page.locator('.filter-strip').innerText();
    const intersectionCount = parseInt(intersectionText.match(/(\d+) matches/)?.[1] ?? '999', 10);

    expect(intersectionCount).toBeLessThanOrEqual(singleCount);
    await expect(page.locator('.filter-chip')).toHaveCount(2);
  });
});

test.describe('Clear filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Resources' }).click();
    await page.locator('.roster-row').first().click();
  });

  test('per-chip ✕ clears that filter', async ({ page }) => {
    await page.locator('.filter-chip button[aria-label*="Clear"]').first().click();
    await expect(page.locator('.filter-strip')).toBeHidden();
  });

  test('Clear all pill clears every filter', async ({ page }) => {
    await page.getByRole('button', { name: 'Features' }).click();
    await page.locator('.roster-row').first().click();
    await expect(page.locator('.filter-chip')).toHaveCount(2);
    await page.locator('.clear-all').click();
    await expect(page.locator('.filter-strip')).toBeHidden();
  });

  test('Esc clears all filters', async ({ page }) => {
    await page.locator('section').first().focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.filter-strip')).toBeHidden();
  });
});
