import { test, expect } from '@playwright/test';

test.describe('Map page — staffing & dropdowns', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop map dropdown coverage runs in desktop projects.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas[role=application]')).toBeVisible();
  });

  test('Yields dropdown opens, lists 6 options, switching updates the legend', async ({ page }) => {
    const yieldsTrigger = page.getByRole('button', { name: /^Yields/ });
    await yieldsTrigger.click();
    const items = page.getByRole('menuitem');
    await expect(items).toHaveCount(6);
    await items.filter({ hasText: 'Water' }).click();
    // popup closed
    await expect(page.getByRole('menu')).toHaveCount(0);
    // trigger label updated
    await expect(yieldsTrigger).toContainText('Water');
    // legend reads "water yield"
    await expect(page.locator('text=/water yield/i').first()).toBeVisible();
  });

  test('Staffing button selects the staffing layer and renders gradient legend', async ({ page }) => {
    const staffingBtn = page.getByRole('button', { name: 'Staffing' });
    if (await staffingBtn.count() === 0) {
      test.skip(true, 'available_categories.staffing is false in current data');
      return;
    }
    await staffingBtn.click();
    await expect(staffingBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('text=/Staffing —/i').first()).toBeVisible();
  });

  test('Esc precedence: popup closes first', async ({ page }) => {
    await page.getByRole('button', { name: /^Yields/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
});

test.describe('Map mobile inspector sheet', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas[role=application]')).toBeVisible();
  });

  test('tapping a tile opens a dismissable bottom sheet', async ({ page }) => {
    const canvas = page.locator('canvas[role=application]');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.map-inspector-sheet')).toBeVisible();
    await expect(page.locator('.map-inspector-sheet', { hasText: /Tile/ })).toBeVisible();

    await page.locator('.s-sheet-backdrop').click();
    await expect(page.locator('.map-inspector-sheet')).toHaveCount(0);
  });
});
