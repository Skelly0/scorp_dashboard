import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['light', 'dark', 'schematic'];

// public/data/congress.json may be absent until the first post-merge sync,
// and Vite preview serves the SPA HTML fallback for missing JSON paths.
// Mocking keeps these checks deterministic (same rationale as tech.spec.js).
const mockCongressPayload = {
  congress: {
    total_seats: 27,
    parties: [
      { name: 'Independent', seats: 4 },
      { name: 'Lunar Survival League', seats: 8 },
      { name: 'Novus Chrysalis Collective', seats: 6 },
      { name: 'Selenite Rose Front', seats: 7 },
      { name: 'Education Party', seats: 2 },
      { name: 'Non-aligned', seats: 0 },
    ],
  },
  federations: {
    total_seats: 27,
    delegations: [
      {
        name: 'Administration & Bureaucracy',
        seats: 3,
        parties: [
          { name: 'Independent', seats: 1 },
          { name: 'Lunar Survival League', seats: 1 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
        ],
      },
      {
        name: 'Engineering',
        seats: 3,
        parties: [
          { name: 'Independent', seats: 1 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
          { name: 'Education Party', seats: 1 },
        ],
      },
      {
        name: 'Science & Research',
        seats: 3,
        parties: [
          { name: 'Independent', seats: 1 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
          { name: 'Education Party', seats: 1 },
        ],
      },
      {
        name: 'Logistics & Transport',
        seats: 3,
        parties: [
          { name: 'Lunar Survival League', seats: 1 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
          { name: 'Selenite Rose Front', seats: 1 },
        ],
      },
      {
        name: 'Botany & Agriculture',
        seats: 3,
        parties: [
          { name: 'Independent', seats: 1 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
          { name: 'Selenite Rose Front', seats: 1 },
        ],
      },
      {
        name: 'Industrial Production',
        seats: 4,
        parties: [
          { name: 'Lunar Survival League', seats: 2 },
          { name: 'Selenite Rose Front', seats: 2 },
        ],
      },
      {
        name: 'Extraction & Mining',
        seats: 4,
        parties: [
          { name: 'Lunar Survival League', seats: 2 },
          { name: 'Selenite Rose Front', seats: 2 },
        ],
      },
      {
        name: 'Service & Support Workers',
        seats: 4,
        parties: [
          { name: 'Lunar Survival League', seats: 2 },
          { name: 'Novus Chrysalis Collective', seats: 1 },
          { name: 'Selenite Rose Front', seats: 1 },
        ],
      },
    ],
  },
};

async function mockMeta(page, syncedAt) {
  await page.route('**/data/meta.json?*', async (route) => {
    await route.fulfill({
      json: {
        history_year: 2076,
        partial_failures: [],
        schema_version: 12,
        senate_visible: false,
        synced_at: syncedAt,
      },
    });
  });
}

async function mockCongressData(page, payload = mockCongressPayload) {
  await mockMeta(page, 'playwright-congress');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ json: payload });
  });
}

async function gotoWithTheme(page, theme, path) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of THEMES) {
  test(`Congress page renders party totals + federation delegations (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trade Federation Delegations' })).toBeVisible();
    // The Celestial Council band is retired.
    await expect(page.getByRole('heading', { name: 'Celestial Council' })).toHaveCount(0);

    // Band 01: one party seat strip; rows sort seats-desc with LSL at 8.
    await expect(page.locator('.seat-strip')).toHaveCount(1);
    const congressRows = page.locator('.seat-rows').first().locator('.seat-row');
    await expect(congressRows.first()).toContainText('Lunar Survival League');
    await expect(congressRows.first()).toContainText('8');
    await expect(page.locator('.seat-row.muted')).toHaveCount(1);

    // Band 02: parliament diagram — one dot per delegate, one band per federation.
    await expect(page.locator('.parliament-dot')).toHaveCount(27);
    await expect(page.locator('.parliament-svg path')).toHaveCount(8);
    const fedRows = page.locator('.seat-rows').nth(1).locator('.seat-row');
    await expect(fedRows).toHaveCount(8);
    await expect(fedRows.first()).toContainText('Administration & Bureaucracy');
    await expect(fedRows.last()).toContainText('Service & Support Workers');
  });

  test(`Congress page axe a11y (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('Congress page shows the empty state when congress.json is absent', async ({ page }) => {
  await mockMeta(page, 'playwright-congress-empty');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  await expect(page.getByText(/Congress data is not yet wired up/)).toBeVisible();
  await expect(page.locator('code', { hasText: 'CongressPartyNames' })).toBeVisible();
});

test('Congress page falls back to a pending card when delegations are missing', async ({ page }) => {
  await mockCongressData(page, {
    congress: mockCongressPayload.congress,
    federations: { total_seats: 0, delegations: [] },
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trade Federation Delegations' })).toBeVisible();
  await expect(page.getByText(/Delegation data hasn't synced yet/)).toBeVisible();
  await expect(page.locator('.parliament-svg')).toHaveCount(0);
});
