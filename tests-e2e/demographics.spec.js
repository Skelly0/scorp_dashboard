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

  test('Avg Satisfaction tone follows the 0 to 1 satisfaction scale', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Avg Satisfaction' });
    const num = tile.locator('.kpi-num');
    const value = await page.evaluate(async () => {
      const response = await fetch('/data/demographics.json');
      const data = await response.json();
      return data.totals.avg_satisfaction;
    });
    const expected = value < 0.33 ? 'crit' : value < 0.66 ? 'warn' : 'good';

    expect(Number.isFinite(value)).toBe(true);
    await expect(tile).toHaveClass(new RegExp(`\\btone-${expected}\\b`));
    await expect(num).toHaveClass(new RegExp(`\\b${expected}\\b`));
  });

  test('Available Housing shows count and "% free" subtitle', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Available Housing' });
    await expect(tile).toBeVisible();
    // Subtitle should say "X% free".
    await expect(tile.locator('.kpi-subtitle')).toHaveText(/\d+% free/);
  });

  test('Predicted Growth shows signed value with "per year" subtitle', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Predicted Growth' });
    await expect(tile).toBeVisible();
    // Headline is a bare signed integer ("+150", "-18", "0") or "—"; the unit
    // lives in the subtitle so the value never wraps mid-string.
    const num = tile.locator('.kpi-num');
    await expect(num).toHaveText(/^(\+|-)?[\d,]+$|^—$/);
    const text = (await num.innerText()).trim();
    if (text !== '—') {
      await expect(tile.locator('.kpi-subtitle')).toHaveText('per year');
    }
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

  test('skill-mismatch callout follows current live data', async ({ page }) => {
    const mismatch = await page.evaluate(async () => {
      const response = await fetch('/data/pops.json');
      const data = await response.json();
      const classes = data.classes ?? [];
      const totalUnemployed = classes.reduce((sum, c) => sum + (c.unemployed_count ?? 0), 0);
      const shortage = classes.reduce(
        (sum, c) => sum + Math.max(0, (c.workforce?.demand ?? 0) - (c.workforce?.supply ?? 0)),
        0
      );
      return totalUnemployed > 0 && shortage > 0;
    });
    const callout = page.getByRole('status', { name: 'Skill mismatch' });
    if (mismatch) {
      await expect(callout).toBeVisible();
    } else {
      await expect(callout).toHaveCount(0);
    }
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

  test('Consumption card lists Water / Energy / Materials with Per Cap and Total', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    const card = page.locator('.s-card').filter({ has: page.locator('h3', { hasText: 'Consumption' }) });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.getByText('Water', { exact: true })).toBeVisible();
    await expect(card.getByText('Energy', { exact: true })).toBeVisible();
    await expect(card.getByText('Materials', { exact: true })).toBeVisible();
    // Each resource sub-column shows Per Cap + Total / turn labels.
    await expect(card.locator('dt', { hasText: 'Per cap' })).toHaveCount(3);
    await expect(card.locator('dt', { hasText: 'Total / turn' })).toHaveCount(3);
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
    await expect(page.getByRole('heading', { name: 'Signal Lost' })).toBeVisible();
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
