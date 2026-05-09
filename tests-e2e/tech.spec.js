import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['light', 'dark', 'schematic'];

// The Tech page is data-conditional:
//   - When public/data/tech.json has techs (named range present), the
//     6-branch tree grid renders with .tech-card state classes.
//   - When tech.json is empty (named range not yet added), the empty-state
//     band renders with the "TechTable" callout.
// Both paths are valid; this spec covers whichever is current and asserts
// the page is accessible in either shape across all three themes.

for (const theme of THEMES) {
  test(`Tech page renders (${theme})`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/#/tech');
    await page.waitForLoadState('networkidle');

    const grid = await page.locator('.tech-grid').count();
    if (grid > 0) {
      // Tree-grid path: every visible tech card carries one of three state
      // classes. We don't assert specific counts because they depend on the
      // GM's current data, but we do assert the union covers every card.
      const totalCards = await page.locator('.tech-card').count();
      const stateCards = await page.locator(
        '.tech-card.researched, .tech-card.available, .tech-card.locked'
      ).count();
      expect(stateCards).toBe(totalCards);
      expect(totalCards).toBeGreaterThan(0);
    } else {
      // Empty-state path: the band + callout copy must be present.
      await expect(page.getByText(/Tech tree not yet wired up/)).toBeVisible();
      await expect(page.locator('code', { hasText: 'TechTable' })).toBeVisible();
    }
  });

  test(`Tech page axe a11y (${theme})`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/#/tech');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
