import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['light', 'dark', 'schematic'];

const mockTechPayload = {
  branches: ['Agriculture', 'Industry', 'Terraforming', 'Social', 'Defense', 'Logistics'],
  techs: [
    {
      name: 'Stacked Nutrient Loops',
      branch: 'Agriculture',
      tier: 1,
      cost_rp: 12,
      researched: true,
      available: false,
      prereqs: [],
      effects: [
        {
          type: 'yield',
          type_raw: 'Yield',
          target: 'SuperdenseHydroponicGreensOutputMultiplier',
          mag: 0.18,
        },
        {
          type: 'workforce',
          type_raw: 'Workforce',
          target: 'VacuumHardenedHorticultureSupportCrew',
          mag: -0.08,
        },
      ],
      description: 'Compact farms tuned for tight colony infrastructure.',
    },
    {
      name: 'Basalt Spur Gearing',
      branch: 'Industry',
      tier: 1,
      cost_rp: 10,
      researched: false,
      available: true,
      prereqs: [],
      effects: [],
      description: '',
    },
    {
      name: 'Shade Sail Protocols',
      branch: 'Terraforming',
      tier: 1,
      cost_rp: 10,
      researched: false,
      available: true,
      prereqs: [],
      effects: [],
      description: '',
    },
    {
      name: 'Commons Ledger',
      branch: 'Social',
      tier: 1,
      cost_rp: 10,
      researched: false,
      available: true,
      prereqs: [],
      effects: [],
      description: '',
    },
    {
      name: 'Dustline Forts',
      branch: 'Defense',
      tier: 1,
      cost_rp: 10,
      researched: false,
      available: true,
      prereqs: [],
      effects: [],
      description: '',
    },
    {
      name: 'Crawler Dispatch',
      branch: 'Logistics',
      tier: 1,
      cost_rp: 10,
      researched: false,
      available: true,
      prereqs: [],
      effects: [],
      description: '',
    },
  ],
};

async function mockTechData(page, payload = mockTechPayload) {
  await page.route('**/data/meta.json?*', async (route) => {
    await route.fulfill({
      json: {
        history_year: 2075,
        partial_failures: [],
        schema_version: 8,
        senate_visible: false,
        synced_at: 'playwright-tech-overflow',
      },
    });
  });
  await page.route('**/data/tech.json?*', async (route) => {
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

// The committed public data may omit optional tech.json, and Vite preview can
// serve the SPA fallback HTML for that URL. Mocking keeps these layout checks
// deterministic and exercises the populated tree path every run.

for (const theme of THEMES) {
  test(`Tech page renders (${theme})`, async ({ page }) => {
    await mockTechData(page);
    await gotoWithTheme(page, theme, '/#/tech');
    await expect(page.locator('section')).toContainText(
      /Research Progress|Tech tree not yet wired up/,
      { timeout: 10000 }
    );

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
    await mockTechData(page);
    await gotoWithTheme(page, theme, '/#/tech');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('Tech page keeps effect text inside green effect chips', async ({ page }) => {
  await mockTechData(page);
  await page.setViewportSize({ width: 380, height: 900 });
  await gotoWithTheme(page, 'light', '/#/tech');
  await page.waitForSelector('.tech-effect-chip.pos');

  const overflowingChips = await page.locator('.tech-effect-chip').evaluateAll((chips) =>
    chips
      .filter((chip) => {
        const chipBox = chip.getBoundingClientRect();
        const childrenOverflow = [...chip.children].some((child) => {
          const childBox = child.getBoundingClientRect();
          return childBox.left < chipBox.left - 1 || childBox.right > chipBox.right + 1;
        });
        return chip.scrollWidth > chip.clientWidth + 1 || childrenOverflow;
      })
      .map((chip) => chip.textContent.replace(/\s+/g, ' ').trim())
  );

  expect(overflowingChips).toEqual([]);
});

test('Tech page gives effect chips enough width at dashboard size', async ({ page }) => {
  await mockTechData(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.goto('/#/tech');
  await page.waitForSelector('.tech-effect-chip.pos');

  const wrappedTargets = await page.locator('.tech-effect-target').evaluateAll((targets) =>
    targets
      .filter((target) => {
        const styles = getComputedStyle(target);
        const lineHeight = Number.parseFloat(styles.lineHeight);
        const singleLineHeight = Number.isFinite(lineHeight)
          ? lineHeight
          : Number.parseFloat(styles.fontSize) * 1.5;
        return target.getBoundingClientRect().height > singleLineHeight * 1.35;
      })
      .map((target) => target.textContent.replace(/\s+/g, ' ').trim())
  );

  expect(wrappedTargets).toEqual([]);
});
