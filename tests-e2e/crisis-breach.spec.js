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

test.describe('Crisis breach visual state', () => {
  test('engages on every page when crisis_factor > 1.0', async ({ page }) => {
    await mockStatus(page, 1.18);
    await page.goto('/');

    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-edge')).toHaveCount(4);
    await expect(page.locator('.crisis-over-tag')).toBeVisible();
    await expect(page.locator('.crisis-gauge')).toBeVisible();
    await expect(page).toHaveTitle(/⚠ CRISIS · /);

    // Frame + banner persist across routes (colony-wide).
    await page.goto('/#/demographics');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();

    // No horizontal scroll introduced by the fixed frame.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow).toBe(true);
  });

  test('stays calm below 1.0', async ({ page }) => {
    await mockStatus(page, 0.84);
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toHaveCount(0);
    await expect(page.locator('.crisis-frame')).toHaveCount(0);
    await expect(page).not.toHaveTitle(/⚠ CRISIS/);
  });

  test('passes axe with breach active', async ({ page }) => {
    await mockStatus(page, 1.42);
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    // Scope to WCAG A/AA like the rest of the suite (a11y.spec.js). The default
    // ruleset also runs the `region` best-practice rule, which already fires on
    // the Status page's pre-existing generic grids/bands — unrelated to the
    // breach overlay (the frame is aria-hidden, the banner is role="status").
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('renders a static breach under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await mockStatus(page, 1.2);
    await page.goto('/');
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await context.close();
  });
});
