import { test, expect } from '@playwright/test';

async function matchCount(page) {
  const strip = page.locator('.filter-strip');
  await expect(strip).toContainText(/\d+\s+matches/i);
  const text = await strip.innerText();
  const match = text.match(/(\d+)\s+matches/i);
  expect(match, `Could not parse match count from: ${text}`).not.toBeNull();
  return parseInt(match[1], 10);
}

test.describe('Map overlay system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
  });

  test('shows the core layer tabs and overlay buttons', async ({ page }) => {
    // Post-refactor: tab strip composed of single buttons + LayerMenu triggers.
    // Required tabs: Terrain, Yields (menu), Resources/Features/Improvements.
    // Optional tabs (gated on available_categories): Upkeep, Workforce, Staffing.
    await expect(page.getByRole('button', { name: /^Terrain$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Yields/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resources' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Features' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Improvements' })).toBeVisible();
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

    // Switch to a Yields sub-layer via the LayerMenu dropdown.
    await page.getByRole('button', { name: /^Yields/ }).click();
    await page.getByRole('button', { name: /^Yields/ }).click();
    await page.getByRole('menuitem', { name: 'Food' }).click();

    // Filter strip + chip still visible
    await expect(page.locator('.filter-strip')).toBeVisible();
    await expect(page.locator('.filter-chip')).toHaveCount(1);
  });

  test('two filters intersect (count drops or stays equal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click();
    await page.locator('.roster-row').first().click();
    const singleCount = await matchCount(page);

    await page.getByRole('button', { name: 'Features' }).click();
    await page.locator('.roster-row').first().click();

    const intersectionCount = await matchCount(page);

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

test.describe('Improvement category mapping', () => {
  test('inspector shows the placed improvement type separately from ownership type', async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Improvements' }).click();
    await page.locator('.roster-row', { hasText: /Solar Array Field/ }).first().click();

    const inspector = page.locator('aside .s-card').last();
    await expect(inspector).toContainText('Improvement Type');
    await expect(inspector).toContainText('Solar Array Field');
    await expect(inspector).toContainText('Ownership Type');
  });

  test('inspector renders the right category icon', async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');

    // Click the Improvements tab so the roster is visible
    await page.getByRole('button', { name: 'Improvements' }).click();

    // Click any leaf row that mentions "Solar" — should resolve to ☀ (energy)
    const solarRow = page.locator('.roster-row', { hasText: /Solar/ }).first();
    if (await solarRow.count()) {
      await solarRow.click();
      // Inspector should now show the ☀ icon
      await expect(page.locator('.kv-section h4 span').first()).toHaveText('☀');
    }
    // Click a leaf with "Mining" → ⛏
    const miningRow = page.locator('.roster-row', { hasText: /Mining|Extractor|Extraction/ }).first();
    if (await miningRow.count()) {
      await miningRow.click();
      await expect(page.locator('.kv-section h4 span').first()).toHaveText('⛏');
    }
  });
});
