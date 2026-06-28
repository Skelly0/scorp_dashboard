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
  test(`Congress Chamber + Federations tabs render (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    // Chamber tab (default): party-totals hemicycle + Banzhaf voting-power roster.
    await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Party Roster' })).toBeVisible();
    await expect(page.locator('.hemicycle-seat')).toHaveCount(27);
    // The Celestial Council band is retired.
    await expect(page.getByRole('heading', { name: 'Celestial Council' })).toHaveCount(0);

    const rosterRows = page.locator('.roster-row');
    await expect(rosterRows).toHaveCount(5); // Non-aligned (0 seats) excluded
    await expect(rosterRows.first()).toContainText('Lunar Survival League');
    await expect(rosterRows.first()).toContainText('8');

    // Coalition builder: toggling a party updates the live seat count.
    await page.getByRole('button', { name: /Lunar Survival League/ }).first().click();
    await expect(page.locator('.coalition-seats')).toContainText('8');

    // Federations tab: federation × party seat matrix + parliament diagram.
    await page.getByRole('tab', { name: 'Federations' }).click();
    await expect(page.getByRole('heading', { name: 'Federation Seat Matrix' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trade Federation Delegations' })).toBeVisible();
    await expect(page.locator('.fed-matrix')).toBeVisible();
    await expect(page.locator('.parliament-dot')).toHaveCount(27);
    await expect(page.locator('.parliament-svg path')).toHaveCount(8);
  });

  test(`Congress page axe a11y (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    const chamber = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(chamber.violations).toEqual([]);

    await page.getByRole('tab', { name: 'Federations' }).click();
    await expect(page.locator('.fed-matrix')).toBeVisible();
    const feds = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(feds.violations).toEqual([]);
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

test('Congress page falls back to a pending card when delegations are unpublished', async ({ page }) => {
  await mockCongressData(page, {
    congress: mockCongressPayload.congress,
    federations: { total_seats: 0, delegations: [] },
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  // Chamber tab still renders party totals.
  await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
  await expect(page.locator('.hemicycle-seat')).toHaveCount(27);

  // Federations tab shows the pending card, no matrix or diagram.
  await page.getByRole('tab', { name: 'Federations' }).click();
  await expect(page.getByText(/No delegation results published yet/)).toBeVisible();
  await expect(page.locator('.parliament-svg')).toHaveCount(0);
  await expect(page.locator('.fed-matrix')).toHaveCount(0);
});

test('Congress page renders the pre-election (all-zero) chamber faithfully', async ({ page }) => {
  await mockCongressData(page, {
    congress: {
      total_seats: 27,
      parties: [
        { name: 'Independent', seats: 0 },
        { name: 'Lunar Survival League', seats: 0 },
        { name: 'Non-aligned', seats: 0 },
      ],
    },
    federations: { total_seats: 0, delegations: [] },
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  await expect(page.getByText(/No seats apportioned yet/)).toBeVisible();
  await expect(page.locator('.hemicycle-seat')).toHaveCount(0);
});
