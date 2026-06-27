import { test, expect } from '@playwright/test';

// The Demographics page is the "Colony Census" — a three-view surface
// (Register / Quadrant / Conditions) over pops.json + population.json +
// demographics.json. These specs lock down the layout AND that nothing the old
// page surfaced was lost (per-class mortality/births/deaths/mobility, the full
// ClassDetail drilldown, workforce aggregates, housing/food signals).

async function censusData(page) {
  return page.evaluate(async () => {
    const [pops, population, demographics] = await Promise.all([
      fetch('/data/pops.json').then((r) => r.json()),
      fetch('/data/population.json').then((r) => r.json()),
      fetch('/data/demographics.json').then((r) => r.json()),
    ]);
    return { pops, population, demographics };
  });
}

test.describe('Census — Register view', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop census coverage runs in desktop projects.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
  });

  test('view tabs default to Register', async ({ page }) => {
    const tabs = page.getByRole('group', { name: 'Census view' });
    await expect(tabs.getByRole('button', { name: 'Register' })).toHaveAttribute('aria-pressed', 'true');
    await expect(tabs.getByRole('button', { name: 'Quadrant' })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Conditions' })).toBeVisible();
  });

  test('colony indicator tiles render the five KPIs', async ({ page }) => {
    for (const label of ['Population', 'Avg Satisfaction', 'Radicalisation', 'Workforce Fill', 'Housing Use']) {
      await expect(page.locator('.ckpi').filter({ hasText: label })).toBeVisible();
    }
  });

  test('Avg Satisfaction tile shows the colony figure from demographics.json', async ({ page }) => {
    const { demographics } = await censusData(page);
    const expected = `${Math.round(demographics.totals.avg_satisfaction * 100)}%`;
    const tile = page.locator('.ckpi').filter({ hasText: 'Avg Satisfaction' });
    await expect(tile.locator('.ckpi-value')).toHaveText(expected);
  });

  test('clicking a KPI tile expands its detail drivers', async ({ page }) => {
    const tile = page.locator('.ckpi').filter({ hasText: 'Population' }).first();
    await expect(tile.locator('.ckpi-detail')).toHaveCount(0);
    await tile.click();
    await expect(tile.locator('.ckpi-detail')).toBeVisible();
    await expect(tile.getByText('Births / turn')).toBeVisible();
    await expect(tile.getByText('Working class share')).toBeVisible();
  });

  test('class register lists every class with tier + sort controls', async ({ page }) => {
    const { pops } = await censusData(page);
    await expect(page.locator('.reg-row')).toHaveCount(pops.classes.length);
    for (const t of ['All', 'Upper', 'Middle', 'Lower', 'Expropriated']) {
      await expect(page.getByRole('button', { name: t, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Satisfaction', exact: true })).toBeVisible();
  });

  test('Tier filter narrows the register to that tier', async ({ page }) => {
    const { population } = await censusData(page);
    const lowerCount = population.classes.filter((c) => c.tier === 'Lower').length;
    expect(lowerCount).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Lower', exact: true }).click();
    await expect(page.locator('.reg-row')).toHaveCount(lowerCount);
  });

  test('row drilldown reuses the full ClassDetail record — nothing lost', async ({ page }) => {
    const firstRow = page.locator('.reg-row').first();
    await firstRow.click();
    const expand = page.locator('.reg-expand');
    await expect(expand).toBeVisible();

    // Census-specific facet bars.
    await expect(expand.getByText('Satisfaction Drivers · 11 facets')).toBeVisible();

    // The complete per-class record carried over from the old page.
    await expect(expand.locator('.s-card', { hasText: 'Population Profile' })).toBeVisible();
    await expect(expand.locator('.s-card', { hasText: 'Worldview Chart' })).toBeVisible();
    await expect(expand.locator('.s-card', { hasText: 'Consumption' })).toBeVisible();
    await expect(expand.locator('.s-card', { hasText: 'Income · per cap' })).toBeVisible();

    // Demography card preserves per-class births/deaths/mortality/mobility,
    // which the old vitals table had but ClassDetail previously lacked.
    const demoCard = expand.locator('.s-card', { hasText: 'Demography' });
    await expect(demoCard).toBeVisible();
    for (const dt of ['Births', 'Deaths', 'Mortality', 'Mobility in', 'Mobility out']) {
      await expect(demoCard.locator('dt', { hasText: dt })).toBeVisible();
    }

    // Per-class workforce + weekly hours preserved.
    const workforceCard = expand.locator('.s-card', { hasText: 'Workforce' }).filter({ hasText: 'Fill Ratio' });
    await expect(workforceCard.locator('dt', { hasText: 'Weekly Hours' })).toBeVisible();
  });

  test('drilldown toggles closed on second click and on Escape', async ({ page }) => {
    const firstRow = page.locator('.reg-row').first();
    await firstRow.click();
    await expect(page.locator('.reg-expand')).toBeVisible();
    await firstRow.click();
    await expect(page.locator('.reg-expand')).toHaveCount(0);

    await firstRow.click();
    await expect(page.locator('.reg-expand')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.reg-expand')).toHaveCount(0);
  });
});

test.describe('Census — Quadrant view', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop census coverage runs in desktop projects.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
    await page.getByRole('group', { name: 'Census view' }).getByRole('button', { name: 'Quadrant' }).click();
    await expect(page.locator('text=Stability Quadrant')).toBeVisible();
  });

  test('scatter, dossier and composition all render', async ({ page }) => {
    await expect(page.getByRole('img', { name: /Satisfaction versus radicalisation/ })).toBeVisible();
    await expect(page.locator('.dossier-name')).toBeVisible();
    await expect(page.locator('text=Population Composition')).toBeVisible();
    for (const t of ['By class', 'By satisfaction', 'By radicalisation']) {
      await expect(page.getByRole('button', { name: t, exact: true })).toBeVisible();
    }
  });

  test('clicking a scatter bubble updates the dossier', async ({ page }) => {
    const { pops } = await censusData(page);
    // Pick a non-default class (default selection is the largest by pop).
    const smallest = [...pops.classes].sort((a, b) => a.pop - b.pop)[0].name;
    await page.locator(`circle[aria-label="${smallest}"]`).click();
    await expect(page.locator('.dossier-name')).toHaveText(smallest);
  });
});

test.describe('Census — Conditions view', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop census coverage runs in desktop projects.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
    await page.getByRole('group', { name: 'Census view' }).getByRole('button', { name: 'Conditions' }).click();
    await expect(page.locator('text=Housing & Sustenance')).toBeVisible();
  });

  test('housing/food gauges, labour market and standard-of-living all render', async ({ page }) => {
    await expect(page.locator('.gauge').filter({ hasText: 'Housing Occupancy' })).toBeVisible();
    await expect(page.locator('.gauge').filter({ hasText: 'Food Security' })).toBeVisible();
    await expect(page.locator('.gauge').filter({ hasText: 'Food Variety' })).toBeVisible();

    await expect(page.locator('text=Labour Market')).toBeVisible();
    await expect(page.locator('.labour-row').first()).toBeVisible();

    await expect(page.locator('text=Standard of Living by Class')).toBeVisible();
    await expect(page.locator('.sol-row').first()).toBeVisible();
  });

  test('skill-mismatch callout follows current live data', async ({ page }) => {
    const { pops } = await censusData(page);
    const classes = pops.classes ?? [];
    const totalUnemployed = classes.reduce((s, c) => s + (c.unemployed_count ?? 0), 0);
    const shortage = classes.reduce(
      (s, c) => s + Math.max(0, (c.workforce?.demand ?? 0) - (c.workforce?.supply ?? 0)),
      0
    );
    const callout = page.getByRole('status', { name: 'Skill mismatch' });
    if (totalUnemployed > 0 && shortage > 0) {
      await expect(callout).toBeVisible();
    } else {
      await expect(callout).toHaveCount(0);
    }
  });
});

test.describe('Census — route + persistence', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop census coverage runs in desktop projects.');

  test('Population page is no longer exposed as a standalone route', async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('nav a', { hasText: 'Population' })).toHaveCount(0);
    await page.goto('/#/population');
    await expect(page.locator('.band-title', { hasText: 'Page Not Found' })).toBeVisible();
  });

  test('selected view persists across reloads', async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
    await page.getByRole('group', { name: 'Census view' }).getByRole('button', { name: 'Conditions' }).click();
    await expect(page.locator('text=Housing & Sustenance')).toBeVisible();
    await page.reload();
    await expect(page.locator('text=Housing & Sustenance')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Census mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/demographics');
    await expect(page.locator('text=Colony Indicators')).toBeVisible({ timeout: 10000 });
  });

  test('register trims columns and opens the full drilldown on tap', async ({ page }) => {
    // Collapsible columns hidden on phones.
    await expect(page.locator('.reg-head .reg-collapse').first()).toBeHidden();

    await page.locator('.reg-row').first().tap();
    await expect(page.locator('.reg-expand')).toBeVisible();
    await expect(page.locator('.reg-expand .s-card', { hasText: 'Population Profile' })).toBeVisible();
  });

  test('no horizontal page overflow', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
  });
});
