import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['light', 'dark', 'schematic'];

// public/data/congress.json may be absent until the first post-merge sync,
// and Vite preview serves the SPA HTML fallback for missing JSON paths.
// Mocking keeps these checks deterministic (same rationale as tech.spec.js).
const mockCongressPayload = {
  congress: {
    total_seats: 27,
    parties: [
      { name: 'Independent', seats: 4 },
      { name: 'Lunar Survival League', seats: 8 },
      { name: 'Novus Chrysalis Collective', seats: 6 },
      { name: 'Selenite Rose Front', seats: 7 },
      { name: 'Education Party', seats: 2 },
      { name: 'Non-aligned', seats: 0 },
    ],
  },
  council: {
    total_seats: 15,
    parties: [
      { name: 'Independent', seats: 2 },
      { name: 'Lunar Survival League', seats: 5 },
      { name: 'Novus Chrysalis Collective', seats: 3 },
      { name: 'Selenite Rose Front', seats: 4 },
      { name: 'Education Party', seats: 1 },
      { name: 'Non-aligned', seats: 0 },
    ],
  },
};

async function mockMeta(page, syncedAt) {
  await page.route('**/data/meta.json?*', async (route) => {
    await route.fulfill({
      json: {
        history_year: 2076,
        partial_failures: [],
        schema_version: 11,
        senate_visible: false,
        synced_at: syncedAt,
      },
    });
  });
}

async function mockCongressData(page, payload = mockCongressPayload) {
  await mockMeta(page, 'playwright-congress');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ json: payload });
  });
}

async function gotoWithTheme(page, theme, path) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of THEMES) {
  test(`Congress page renders both chambers (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Celestial Council' })).toBeVisible();
    await expect(page.locator('.seat-strip')).toHaveCount(2);

    // Congress chamber sorts seats-desc: LSL leads with 8.
    const congressRows = page.locator('.seat-rows').first().locator('.seat-row');
    await expect(congressRows.first()).toContainText('Lunar Survival League');
    await expect(congressRows.first()).toContainText('8');

    // One muted zero-seat Non-aligned row per chamber.
    await expect(page.locator('.seat-row.muted')).toHaveCount(2);
  });

  test(`Congress page axe a11y (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('Congress page shows the empty state when congress.json is absent', async ({ page }) => {
  await mockMeta(page, 'playwright-congress-empty');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  await expect(page.getByText(/Congress data is not yet wired up/)).toBeVisible();
  await expect(page.locator('code', { hasText: 'CongressPartySeats' })).toBeVisible();
});
