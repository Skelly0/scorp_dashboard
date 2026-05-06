import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/#/map', '/#/population', '/#/pops', '/#/demographics', '/#/gois', '/#/parties', '/#/situations'];
const THEMES = ['light', 'dark', 'schematic'];

for (const theme of THEMES) {
  for (const path of PAGES) {
    test(`a11y: ${theme} theme — ${path}`, async ({ page }) => {
      await page.goto('/');
      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
      }, theme);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
