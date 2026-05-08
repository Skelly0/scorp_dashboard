import { test, expect } from '@playwright/test';

test.describe('Map zoom controls', () => {
  test.beforeEach(async ({ page }) => {
    // Each test gets a fresh browser context with empty localStorage,
    // so no explicit clear is needed. (Earlier versions of this file used
    // addInitScript to remove 'scorp.map.zoom', which broke the
    // persists-across-reload test by re-running on page.reload().)
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
  });

  test('renders the zoom segmented control with three labelled buttons', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    await expect(group).toBeVisible();
    await expect(group.getByRole('button', { name: /zoom out/i })).toBeVisible();
    await expect(group.getByRole('button', { name: /zoom in/i })).toBeVisible();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toBeVisible();
  });

  test('clicking + and − changes the percentage label', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    const reset = group.getByRole('button', { name: /reset zoom/i });

    await expect(reset).toHaveText('100%');
    await group.getByRole('button', { name: /zoom in/i }).click();
    await expect(reset).toHaveText('125%');
    await group.getByRole('button', { name: /zoom out/i }).click();
    await expect(reset).toHaveText('100%');
  });

  test('disables + at the upper bound and − at the lower bound', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    const zoomIn = group.getByRole('button', { name: /zoom in/i });
    const zoomOut = group.getByRole('button', { name: /zoom out/i });

    // Step from 100% to 200% (four steps of 25%).
    for (let i = 0; i < 4; i++) await zoomIn.click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('200%');
    await expect(zoomIn).toBeDisabled();

    // Reset to 100% then step down to 75% (one step of 25%).
    await group.getByRole('button', { name: /reset zoom/i }).click();
    await zoomOut.click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('75%');
    await expect(zoomOut).toBeDisabled();
  });

  test('persists zoom across reload', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    await group.getByRole('button', { name: /zoom in/i }).click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('125%');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i })).toHaveText('125%');
  });

  test('keyboard shortcut + zooms when viewport has focus', async ({ page }) => {
    // Task 7 of the resizable-map plan moved the keydown handler from the
    // <canvas> to the wrapping `.map-viewport` div, so the test focuses that.
    await page.locator('.map-viewport').focus();
    await page.keyboard.press('=');
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });
    await expect(reset).toHaveText('125%');
    await page.keyboard.press('0');
    await expect(reset).toHaveText('100%');
  });
});
