import { test, expect } from '@playwright/test';

// Selects the first sub-faction button in the cards grid. We don't pin to a
// specific name (e.g. Statebuilders) because live sync data could rename
// factions; instead we rely on the DOM structure: the sub-factions list lives
// inside each GoI card, with each row as a <li><button>...</button></li>.
const FIRST_ROW = '.gois-main li button';

test.describe('GoIs page sub-faction drilldown', () => {
  test.beforeEach(async ({ page }) => {
    // Routes use hash routing — match how a11y.spec.js navigates.
    await page.goto('/#/gois');
    // Hash navigation doesn't fire network idle, so wait on the data-driven
    // markup directly. The cards render each GoI name as h3 once gois.json
    // has loaded.
    await page.waitForSelector(FIRST_ROW, { timeout: 10_000 });
  });

  test('clicking a sub-faction populates the rail panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Both desktop rail and mobile sheet panels exist in the DOM; scope reads
    // to the desktop rail wrapper so the locators stay unambiguous.
    const rail = page.locator('.gois-rail-desktop');
    await expect(rail.locator('.s-rail-empty')).toBeVisible();

    const firstRow = page.locator(FIRST_ROW).first();
    const expectedName = await firstRow.locator('span').first().textContent();
    await firstRow.click();

    await expect(rail.locator('.s-rail-name')).toHaveText((expectedName ?? '').trim());
    await expect(rail.locator('.s-rail-parent')).toBeVisible();
    await expect(rail.locator('.s-rail-goal')).toBeVisible();
    // The radar should render at least the primary polygon (or overlay-only
    // when per-sub-faction worldview is absent in older data). Once the v5
    // sync ships, an additional dashed overlay polygon will appear behind the
    // primary line — but we don't pin to it here because production data may
    // lag the schema bump.
    const polygons = rail.locator('svg path[fill-opacity], svg path[stroke-dasharray]');
    await expect(polygons.first()).toBeVisible();
  });

  test('clicking the same sub-faction again clears the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rail = page.locator('.gois-rail-desktop');
    const row = page.locator(FIRST_ROW).first();
    await row.click();
    await expect(rail.locator('.s-rail-name')).toBeVisible();
    await row.click();
    await expect(rail.locator('.s-rail-empty')).toBeVisible();
  });

  test('Esc dismisses the rail selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rail = page.locator('.gois-rail-desktop');
    await page.locator(FIRST_ROW).first().click();
    await expect(rail.locator('.s-rail-name')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(rail.locator('.s-rail-empty')).toBeVisible();
  });

  test('mobile viewport uses bottom sheet instead of sticky rail', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.gois-rail-desktop')).toBeHidden();
    await expect(page.locator('.s-sheet')).toHaveCount(0);

    await page.locator(FIRST_ROW).first().click();

    await expect(page.locator('.s-sheet')).toBeVisible();
    await expect(page.locator('.s-sheet .s-rail-name')).toBeVisible();
    // Tap backdrop dismisses.
    await page.locator('.s-sheet-backdrop').click();
    await expect(page.locator('.s-sheet')).toHaveCount(0);
  });
});
