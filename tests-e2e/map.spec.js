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

test.describe('Map page — detail values', () => {
  test('truncates yield decimals in the tile detail box', async ({ page }) => {
    await page.route('**/data/map.json*', async (route) => {
      await route.fulfill({
        json: {
          available_categories: { staffing: false, upkeep: false, workforce: false },
          height: 1,
          width: 2,
          missing_sheets: [],
          palettes: {
            terrain: { Plain: '#333333' },
            resource: {},
            feature: {},
            improvement_category: {},
          },
          tiles: [
            {
              x: 0,
              y: 0,
              terrain: 'Plain',
              feature: null,
              resource: null,
              slots: 0,
              improvement: null,
              yields: {
                food: 1.239,
                water: -2.987,
                energy: 0,
              },
              upkeep: {},
              workforce: {},
              staffing: null,
            },
            {
              x: 1,
              y: 0,
              terrain: 'Plain',
              feature: null,
              resource: null,
              slots: 0,
              improvement: null,
              yields: {},
              upkeep: {},
              workforce: {},
              staffing: null,
            },
          ],
        },
      });
    });

    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas[role=application]');
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 10, y: 10 } });

    const yieldValues = page
      .locator('.kv-section')
      .filter({ has: page.getByRole('heading', { name: 'Yields' }) })
      .locator('dd');
    await expect(yieldValues).toHaveText(['+1.23', '-2.98']);
  });
});
