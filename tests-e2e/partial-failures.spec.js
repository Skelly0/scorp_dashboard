import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_META = {
  synced_at: new Date().toISOString(),
  schema_version: 10,
  senate_visible: false,
  partial_failures: ['gois'],
};

async function mockPartialFailure(page) {
  await page.route('**/data/meta.json?*', (route) => route.fulfill({ json: MOCK_META }));
  // Pin the crisis state: live situations.json is currently in breach, and the global
  // CrisisFrame/CrisisBanner chrome would entangle the axe scan (and flake on sync changes).
  await page.route('**/data/situations.json?*', (route) =>
    route.fulfill({ json: { active: [], ended: [], stability_modifiers: [], tier_ladder: [] } }));
  await page.route('**/data/gois.json?*', (route) =>
    route.fulfill({ json: { gois: [], pop_capture_matrix: { classes: [], gois: [], values: [] } } }));
  await page.route('**/data/parties.json?*', (route) =>
    route.fulfill({ json: { parties: [], class_compat_matrix: null, party_capture_pct_matrix: null, party_capture_pop_matrix: null } }));
  await page.route('**/data/pops.json?*', (route) => route.fulfill({ json: { classes: [] } }));
}

test('failed page shows the stale banner and the nav warn chip', async ({ page }) => {
  await mockPartialFailure(page);
  await page.goto('/#/gois');
  await expect(page.locator('.stale-banner')).toBeVisible();
  await expect(page.locator('.stale-banner')).toContainText('failed to sync');
  await expect(page.locator('nav .border-warn')).toBeVisible();
  await expect(page.locator('nav .border-warn')).toContainText('⚠');
  await expect(page.locator('nav .border-warn')).toHaveAttribute('title', 'Partial sync — failed: gois');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('unaffected page has no banner but keeps the nav warn chip', async ({ page }) => {
  await mockPartialFailure(page);
  await page.goto('/#/parties');
  await expect(page.locator('.band-title', { hasText: 'Founded Parties' })).toBeVisible();
  await expect(page.locator('.stale-banner')).toHaveCount(0);
  await expect(page.locator('nav .border-warn')).toBeVisible();
});
