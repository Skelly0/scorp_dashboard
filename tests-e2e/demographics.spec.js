import { test, expect } from '@playwright/test';

test.describe('Demographics page — workforce rework', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    // Wait for the loader to clear and the first band to render.
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
  });

  test('top KPIs show new tiles, not the old three', async ({ page }) => {
    // New tiles present.
    await expect(page.locator('text=Available Housing')).toBeVisible();
    await expect(page.locator('text=Predicted Growth')).toBeVisible();
    await expect(page.locator('text=Workforce Fill')).toBeVisible();

    // Removed tiles absent (effective CDR / Net Δ% / Total Deaths) from Pop Dynamics.
    // Note: these may still appear elsewhere if added later — scope to band 01.
    const band01 = page.locator('section').filter({ hasText: 'Pop Dynamics' }).first();
    await expect(band01.locator('text=Effective CDR')).toHaveCount(0);
    await expect(band01.locator('text=Net Δ%')).toHaveCount(0);
    await expect(band01.locator('text=Total Deaths')).toHaveCount(0);
  });

  test('Available Housing shows count and "% free" subtitle', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Available Housing' });
    await expect(tile).toBeVisible();
    // Subtitle should say "X% free".
    await expect(tile.locator('.kpi-subtitle')).toHaveText(/\d+% free/);
  });

  test('Predicted Growth shows signed "/ turn" value', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Predicted Growth' });
    await expect(tile).toBeVisible();
    // Should look like "+150 / turn", "-18 / turn", or "—".
    await expect(tile).toContainText(/(\+|−|-|—).*\/ turn|—/);
  });

  test('Class Vitals has Demand and Fill % columns', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'Demand' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Fill %' })).toBeVisible();
    // Total expected column count: Class, Pop, Mortality, Growth/turn, Deaths/turn,
    // Mobility In, Mobility Out, Demand, Fill %, Unemployed, Satisfaction = 11.
    const headers = await page.locator('table.tbl thead th').count();
    expect(headers).toBe(11);
  });

  test('Workforce band renders between Class Vitals and Housing', async ({ page }) => {
    const workforceBand = page.locator('text=Workforce').first();
    await expect(workforceBand).toBeVisible();

    // Three workforce tiles.
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Demand' })).toBeVisible();
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Supply' })).toBeVisible();
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Unemployed' })).toBeVisible();

    // Fill bar.
    await expect(page.locator('.bar-row').filter({ hasText: 'Colony-wide Fill' })).toBeVisible();
  });

  test('skill-mismatch callout appears when both shortage and unemployment exist (live data)', async ({ page }) => {
    // The current snapshot has skill mismatch (Industrial/Service unemployed; Botanists/Engineers short).
    // If a future snapshot lacks one side, this assertion can flip — adjust then.
    await expect(page.locator('text=Skill mismatch:')).toBeVisible();
  });

  test('band ordering — Pop Dynamics → Class Vitals → Workforce → Housing → Food Security', async ({ page }) => {
    const bandTitles = await page.locator('.band').allInnerTexts();
    // Each band string contains the title; check the sequence.
    // CSS upper-cases band titles, so compare case-insensitively.
    const order = ['Pop Dynamics', 'Class Vitals', 'Workforce', 'Housing', 'Food Security'];
    for (let i = 0; i < order.length; i++) {
      expect(bandTitles[i].toLowerCase()).toContain(order[i].toLowerCase());
    }
  });
});
