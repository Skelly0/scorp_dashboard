import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const mockCropsimPayload = {
  metrics: {
    total_supply: 833.3043028,
    total_demand: 846.25,
    balance: -12.9456972,
    security_ratio: 0.9847022781,
    per_cap: 0.0109645303,
    variety_index: 0.03517815181,
    production_types: 5,
    demand_classes: 11,
  },
  production: [
    { food_type: 'Greens', total_units: 188.2532576, calorie_mult: 1, share: 0.2259 },
    { food_type: 'Cereal Substitutes', total_units: 272.2791836, calorie_mult: 1.1, share: 0.3267 },
    { food_type: 'Vat Protein', total_units: 272.2791836, calorie_mult: 1.3, share: 0.3267 },
    { food_type: 'Algal Paste', total_units: 100.49, calorie_mult: 1.2, share: 0.1206 },
    { food_type: 'Fruits', total_units: 0, calorie_mult: 1, share: 0 },
  ],
  demand: [
    { class_name: 'Bureaucrats', pop: 5225, per_cap_demand: 0.01, total_demand: 52.25, share: 0.0617 },
    { class_name: 'Industrial Workers', pop: 17250, per_cap_demand: 0.015, total_demand: 258.75, share: 0.3058 },
    { class_name: 'Service Workers', pop: 16000, per_cap_demand: 0.01, total_demand: 160, share: 0.1891 },
  ],
};

const mockStatusPayload = {
  resources: [
    { name: 'Food', current: 1000, income: 833.3043028, upkeep: 846.25, delta: -12.9456972 },
  ],
};

async function mockCropsimData(page) {
  await page.route('**/data/meta.json?*', async (route) => {
    await route.fulfill({
      json: {
        history_year: 2075,
        partial_failures: [],
        schema_version: 12,
        senate_visible: false,
        synced_at: 'playwright-cropsim',
      },
    });
  });
  await page.route('**/data/cropsim.json?*', async (route) => {
    await route.fulfill({ json: mockCropsimPayload });
  });
  await page.route('**/data/status.json?*', async (route) => {
    await route.fulfill({ json: mockStatusPayload });
  });
}

test('Cropsim page renders food balance, production, and demand', async ({ page }) => {
  await mockCropsimData(page);
  await page.goto('/#/cropsim');

  await expect(page.locator('.band-title', { hasText: 'Food Balance' })).toBeVisible();
  await expect(page.locator('.kpi-block', { hasText: 'Food Reserve' })).toContainText('1,000');
  await expect(page.locator('.kpi-block', { hasText: 'Food Reserve' })).toContainText('+833');
  await expect(page.locator('.kpi-block', { hasText: 'Food Reserve' })).toContainText('-846');
  await expect(page.locator('.kpi-block', { hasText: 'Net/Turn' })).toContainText('-12.9');
  await expect(page.locator('.kpi-label', { hasText: /^Balance$/ })).toHaveCount(0);
  await expect(page.locator('.kpi-block', { hasText: 'Security Ratio' })).toContainText('98%');
  await expect(page.locator('.kpi-block', { hasText: 'Food / Cap' })).toContainText('0.01');
  await expect(page.locator('.kpi-block', { hasText: 'Variety Index' })).toContainText('0.04');
  await expect(page.locator('.crop-mix-card', { hasText: 'Vat Protein' })).toBeVisible();
  await expect(page.locator('table.tbl', { hasText: 'Industrial Workers' })).toBeVisible();
});

test('Cropsim page axe a11y', async ({ page }) => {
  await mockCropsimData(page);
  await page.goto('/#/cropsim');
  await expect(page.locator('.band-title', { hasText: 'Food Balance' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
