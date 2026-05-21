import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function mockStatus(page, crisisFactor) {
  return page.route('**/data/status.json*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        stability: 0.41,
        crisis_factor: crisisFactor,
        gov_approval: 0.31,
        population_total: 92000,
        resources: [{ name: 'Money', current: 1000, income: 10, upkeep: 5, delta: 5 }],
        active_situations: [],
        demographics: { avg_satisfaction: 0.3, total_births: 100, total_deaths: 80 },
      }),
    }),
  );
}

function mockSituations(page, factors) {
  return page.route('**/data/situations.json*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        active: factors.map((f, i) => ({ name: `Situation ${i}`, description: 'x', crisis_factor: f })),
        ended: [],
        stability_modifiers: [],
        tier_ladder: [],
      }),
    }),
  );
}

test.describe('Crisis breach visual state (driven by Situation Load)', () => {
  test('engages on every page when situation load > 1.0', async ({ page }) => {
    await mockStatus(page, 0.5);
    await mockSituations(page, [0.7, 0.6]); // load 1.3
    await page.goto('/');

    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-edge')).toHaveCount(4);
    await expect(page.locator('.crisis-over-tag')).toBeVisible();
    await expect(page.locator('.crisis-gauge')).toBeVisible();
    await expect(page).toHaveTitle(/⚠ CRISIS · /);

    await page.goto('/#/demographics');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow).toBe(true);
  });

  test('stays calm when situation load is under 1.0', async ({ page }) => {
    await mockStatus(page, 0.95);
    await mockSituations(page, [0.5, 0.2]); // load 0.7
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toHaveCount(0);
    await expect(page.locator('.crisis-frame')).toHaveCount(0);
    await expect(page).not.toHaveTitle(/⚠ CRISIS/);
  });

  test('passes axe with breach active', async ({ page }) => {
    await mockStatus(page, 0.5);
    await mockSituations(page, [0.8, 0.7]); // load 1.5
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('renders a static breach under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await mockStatus(page, 0.5);
    await mockSituations(page, [0.7, 0.6]); // load 1.3
    await page.goto('/');
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await context.close();
  });
});
