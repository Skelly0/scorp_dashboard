import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/#/map', '/#/demographics', '/#/cropsim', '/#/gois', '/#/tech', '/#/parties', '/#/situations'];
const THEMES = ['light', 'dark', 'schematic'];
const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 900 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];

async function gotoWithTheme(page, theme, path) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`a11y: ${theme} theme — ${viewport.name} — ${path}`, async ({ page }) => {
        await page.setViewportSize(viewport.size);
        await gotoWithTheme(page, theme, path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
}

// GoIs rail in the "sub-faction selected" state — not reachable from the
// default page-load scan, so we sweep it explicitly per theme.
for (const theme of THEMES) {
  test(`a11y: ${theme} theme — /#/gois with sub-faction selected (desktop rail)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithTheme(page, theme, '/#/gois');
    // Wait for the sub-faction row buttons (rendered after gois.json loads).
    await page.waitForSelector('.gois-main li button', { timeout: 10_000 });
    // Click the first sub-faction button to reveal the rail panel.
    await page.locator('.gois-main li button').first().click();
    await page.waitForSelector('.gois-rail-desktop .s-rail-name');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test(`a11y: ${theme} theme — /#/gois with sub-faction selected (mobile sheet)`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoWithTheme(page, theme, '/#/gois');
    await page.waitForSelector('.gois-main li button', { timeout: 10_000 });
    await page.locator('.gois-main li button').first().click();
    await page.waitForSelector('.s-sheet .s-rail-name');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

// Demographics with class detail open — not reachable from a default page-load
// scan, so we sweep it explicitly per theme.
for (const theme of THEMES) {
  test(`a11y: ${theme} theme — /#/demographics with class detail open`, async ({ page }) => {
    await gotoWithTheme(page, theme, '/#/demographics');
    await page.waitForSelector('table.tbl tbody tr', { timeout: 10_000 });
    await page.locator('table.tbl tbody tr').first().click();
    await page.waitForSelector('text=per-class drilldown');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
