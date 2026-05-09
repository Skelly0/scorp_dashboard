import { test, expect } from '@playwright/test';

test.describe('Map page — staffing & dropdowns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas[role=application]')).toBeVisible();
  });

  test('Yields quick-selects, then opens dropdown and switches legend', async ({ page }) => {
    const yieldsTrigger = page.getByRole('button', { name: /^Yields/ });
    await yieldsTrigger.click();
    await expect(yieldsTrigger).toContainText('Food');
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
    await page.getByRole('button', { name: /^Yields/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
});
