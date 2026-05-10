import { test, expect } from '@playwright/test';

test.describe('Demographics page — workforce rework', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop demographics coverage runs in desktop projects.');

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

  test('Predicted Growth shows signed "/ year" value', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Predicted Growth' });
    await expect(tile).toBeVisible();
    // Should look like "+150 / year", "-18 / year", or "—".
    await expect(tile).toContainText(/(\+|−|-|—).*\/ year|—/);
  });

  test('Class Vitals has population profile and workforce columns', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'Tier' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Share' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Demand' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Fill %' })).toBeVisible();
    // Total expected column count: Class, Tier, Share, Pop, Mortality, Births/turn,
    // Deaths/turn, Mobility In, Mobility Out, Demand, Fill %, Unemployed, Satisfaction = 13.
    const headers = await page.locator('table.tbl thead th').count();
    expect(headers).toBe(13);
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

test.describe('Demographics — class drilldown', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop demographics coverage runs in desktop projects.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.tbl tbody tr').first()).toBeVisible();
  });

  test('clicking a class row opens the detail band with that class name', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    const className = (await firstRow.locator('td').first().innerText()).trim();
    await firstRow.click();
    await expect(page.locator('.band-title', { hasText: className })).toBeVisible();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
  });

  test('clicking the same row a second time collapses the detail band', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toHaveCount(0);
  });

  test('Escape collapses the detail band', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('text=per-class drilldown')).toHaveCount(0);
  });

  test('Living Standards card uses KV not bars', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    const card = page.locator('.s-card', { hasText: 'Living Standards' });
    await expect(card).toBeVisible();
    await expect(card.locator('dt', { hasText: 'SoL' })).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Expected' })).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Privilege' })).toBeVisible();
    await expect(card.locator('.bar-row')).toHaveCount(0);
  });

  test('Status and per-class Workforce cards present in detail', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    await expect(page.locator('.s-card', { hasText: 'Status' })).toBeVisible();
    const workforceCard = page.locator('.s-card', { hasText: 'Workforce' }).filter({ hasText: 'Fill Ratio' });
    await expect(workforceCard).toBeVisible();
    await expect(workforceCard.locator('dt', { hasText: 'Weekly Hours' })).toBeVisible();
    await expect(workforceCard.locator('dd', { hasText: '40 / wk' })).toBeVisible();
  });

  test('Population profile and worldview chart are merged into class detail', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    const profileCard = page.locator('.s-card', { hasText: 'Population Profile' });
    await expect(profileCard).toBeVisible();
    await expect(profileCard.locator('dt', { hasText: 'Tier' })).toBeVisible();
    await expect(profileCard.locator('dt', { hasText: 'Pop Share' })).toBeVisible();
    await expect(profileCard.locator('dt', { hasText: 'Political Weight' })).toBeVisible();
    await expect(page.locator('.s-card', { hasText: 'Worldview Chart' })).toBeVisible();
  });

  test('Population page is no longer exposed as a standalone route', async ({ page }) => {
    await expect(page.locator('nav a', { hasText: 'Population' })).toHaveCount(0);
    await page.goto('/#/population');
    await expect(page.locator('text=404 — Page Not Found')).toBeVisible();
  });

  test('row aria-pressed reflects selection', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'false');
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Demographics mobile table trim', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/demographics');
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.tbl tbody tr').first()).toBeVisible();
  });

  test('shows trimmed vitals on mobile and opens full drilldown on tap', async ({ page }) => {
    await expect(page.locator('.tbl-hint')).toBeVisible();

    await expect(page.locator('th', { hasText: 'Class' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Pop' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Fill %' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Satisfaction' })).toBeVisible();

    await expect(page.locator('th', { hasText: 'Tier' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Share' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Mortality' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Births/year' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Deaths/year' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Mobility In' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Mobility Out' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Demand' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Unemployed' })).toBeHidden();

    await page.locator('table.tbl tbody tr').first().tap();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await expect(page.locator('.s-card', { hasText: 'Workforce' }).filter({ hasText: 'Demand' })).toBeVisible();
  });
});
