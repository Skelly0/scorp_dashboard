import { test, expect } from '@playwright/test';

test.describe('Map page — staffing & dropdowns', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop map dropdown coverage runs in desktop projects.');

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

test.describe('Map page — control layer', () => {
  test('Control button selects the control layer and paints controlled tiles', async ({ page }) => {
    await page.route('**/data/map.json*', async (route) => {
      await route.fulfill({
        json: {
          available_categories: { staffing: false, upkeep: false, workforce: false },
          height: 1,
          width: 2,
          missing_sheets: [],
          palettes: {
            terrain: { Plain: '#010203' },
            resource: {},
            feature: {},
            improvement_category: {},
            control: { Administration: '#123456' },
          },
          tiles: [
            {
              x: 0,
              y: 0,
              terrain: 'Plain',
              feature: null,
              resource: null,
              slots: 0,
              improvement: { name: 'Habitat Dome', owner: null, ownership_type: null },
              control: 'Administration',
              yields: {},
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
              control: null,
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

    const controlBtn = page.getByRole('button', { name: 'Control' });
    await controlBtn.click();
    await expect(controlBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('text=/Control —/i').first()).toBeVisible();

    const canvas = page.locator('canvas[role=application]');
    await expect.poll(async () => (
      await canvas.evaluate((canvas) => {
        const ctx = canvas.getContext('2d');
        const x = Math.floor(canvas.width * 0.25);
        const y = Math.floor(canvas.height * 0.5);
        const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
        return { r, g, b, a };
      })
    )).toEqual({ r: 18, g: 52, b: 86, a: 255 });
  });
});

test.describe('Map page — detail values', () => {
  test('Upkeep menu lists upkeep resources from map data', async ({ page }) => {
    await page.route('**/data/map.json*', async (route) => {
      await route.fulfill({
        json: {
          available_categories: { staffing: false, upkeep: true, workforce: true },
          height: 1,
          width: 1,
          missing_sheets: [],
          palettes: {
            terrain: { Plain: '#333333' },
            resource: {},
            feature: {},
            improvement_category: {},
            control: {},
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
              control: null,
              yields: { food: 0 },
              upkeep: {
                energy: 7,
                money: 12,
                helium3: 3,
              },
              workforce: { Engineers: 44 },
              staffing: null,
            },
          ],
        },
      });
    });

    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');

    const upkeepTrigger = page.getByRole('button', { name: /^Upkeep/ });
    await upkeepTrigger.click();
    await upkeepTrigger.click();

    await expect(page.getByRole('menuitem', { name: 'Energy' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Money' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Helium-3' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Money' }).click();
    await expect(upkeepTrigger).toContainText('Money');
    await expect(page.locator('text=/money upkeep/i').first()).toBeVisible();
  });

  test('Workforce Demand menu labels the map layer as demand', async ({ page }) => {
    await page.route('**/data/map.json*', async (route) => {
      await route.fulfill({
        json: {
          available_categories: { staffing: false, upkeep: false, workforce: true },
          height: 1,
          width: 1,
          missing_sheets: [],
          palettes: {
            terrain: { Plain: '#333333' },
            resource: {},
            feature: {},
            improvement_category: {},
            control: {},
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
              control: null,
              yields: {},
              upkeep: {},
              workforce: { Engineers: 44 },
              staffing: null,
            },
          ],
        },
      });
    });

    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');

    const workforceTrigger = page.getByRole('button', { name: /^Workforce Demand/ });
    await expect(workforceTrigger).toBeVisible();

    await workforceTrigger.click();
    await expect(workforceTrigger).toContainText('Engineers');
    await expect(page.locator('text=/Engineers demand/i').first()).toBeVisible();

    const canvas = page.locator('canvas[role=application]');
    await canvas.click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('heading', { name: 'Workforce Demand' })).toBeVisible();
  });

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
