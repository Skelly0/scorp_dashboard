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

  test('slider jumps directly between zoom levels', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    const slider = group.getByRole('slider', { name: /zoom level/i });
    const reset = group.getByRole('button', { name: /reset zoom/i });

    await expect(slider).toHaveValue('100');
    await expect(slider).toHaveAttribute('aria-valuetext', '100 percent');

    await slider.evaluate((node) => {
      node.value = '175';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(reset).toHaveText('175%');
    await expect(slider).toHaveAttribute('aria-valuetext', '175 percent');
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

  test('rendered content width scales linearly with zoom (no feedback loop)', async ({ page }) => {
    // Regression for the "zoom in goes enormous" bug: when the grid track
    // hosting <MapCanvas> uses `1fr` (= minmax(auto, 1fr)) instead of
    // `minmax(0, 1fr)`, the column expands to fit its widest item, which
    // grows .map-viewport's clientWidth, which feeds back into fitScale,
    // which makes contentCssW even bigger. After a few ResizeObserver
    // ticks the content goes "enormous". Linear scaling proves the loop
    // is broken.
    const content = page.locator('.map-content');
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });
    const zoomIn = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /zoom in/i });

    await expect(reset).toHaveText('100%');
    const w100 = (await content.boundingBox()).width;

    await zoomIn.click();
    await expect(reset).toHaveText('125%');
    // Allow layout + ResizeObserver to settle; if a feedback loop exists
    // it amplifies across ticks, so we wait a beat before measuring.
    await page.waitForTimeout(150);
    const w125 = (await content.boundingBox()).width;

    // Within ±2% of the expected linear scaling. A feedback loop blows
    // through this floor by an order of magnitude.
    const ratio = w125 / w100;
    expect(ratio).toBeGreaterThan(1.225);
    expect(ratio).toBeLessThan(1.275);

    // And after stepping to the cap (200%), content should be ~2× the
    // 100% width — never more.
    for (let i = 0; i < 3; i++) await zoomIn.click();
    await expect(reset).toHaveText('200%');
    await page.waitForTimeout(150);
    const w200 = (await content.boundingBox()).width;
    const fullRatio = w200 / w100;
    expect(fullRatio).toBeGreaterThan(1.95);
    expect(fullRatio).toBeLessThan(2.05);
  });

  test('100 percent fits the entire map inside the viewport', async ({ page }) => {
    const viewport = page.locator('.map-viewport');
    const content = page.locator('.map-content');
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });

    await expect(reset).toHaveText('100%');

    const boxes = await viewport.evaluate((node) => ({
      viewportClientWidth: node.clientWidth,
      viewportClientHeight: node.clientHeight,
      viewportScrollWidth: node.scrollWidth,
      viewportScrollHeight: node.scrollHeight,
    }));
    const contentBox = await content.boundingBox();

    expect(contentBox.width).toBeLessThanOrEqual(boxes.viewportClientWidth + 1);
    expect(contentBox.height).toBeLessThanOrEqual(boxes.viewportClientHeight + 1);
    expect(boxes.viewportScrollWidth).toBeLessThanOrEqual(boxes.viewportClientWidth + 1);
    expect(boxes.viewportScrollHeight).toBeLessThanOrEqual(boxes.viewportClientHeight + 1);
  });

  test('100 percent viewport hugs the fitted map without a side void', async ({ page }) => {
    const viewport = page.locator('.map-viewport');
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });

    await expect(reset).toHaveText('100%');

    const metrics = await viewport.evaluate((node) => {
      const content = node.querySelector('.map-content');
      const viewportRect = node.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const styles = getComputedStyle(node);
      const borderX =
        parseFloat(styles.borderLeftWidth || '0') +
        parseFloat(styles.borderRightWidth || '0');

      return {
        innerViewportWidth: viewportRect.width - borderX,
        contentWidth: contentRect.width,
      };
    });

    expect(metrics.innerViewportWidth - metrics.contentWidth).toBeLessThanOrEqual(2);
  });

  test('map viewport owns vertical scrolling when content is taller than the panel', async ({ page }) => {
    const viewport = page.locator('.map-viewport');
    const zoomIn = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /zoom in/i });

    for (let i = 0; i < 4; i++) await zoomIn.click();
    await expect(page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i })).toHaveText('200%');

    const before = await viewport.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    }));

    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 20);

    await viewport.evaluate((node) => { node.scrollTop = 160; });
    await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  });

  test('map viewport scrollbars use themed bands', async ({ page }) => {
    const styles = await page.locator('.map-viewport').evaluate((node) => {
      const s = getComputedStyle(node);
      return {
        scrollbarColor: s.scrollbarColor,
        scrollbarWidth: s.scrollbarWidth,
      };
    });

    expect(styles.scrollbarWidth).toBe('thin');
    expect(styles.scrollbarColor).not.toBe('auto');
  });

  test('touch pinch suppresses overlapping Safari gesture zoom dispatch', async ({ page }) => {
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });
    const viewport = page.locator('.map-viewport');

    await expect(reset).toHaveText('100%');

    await viewport.evaluate((node) => {
      const makeTouches = (distance) => ({
        length: 2,
        0: { clientX: 0, clientY: 0 },
        1: { clientX: distance, clientY: 0 },
        item(index) {
          return this[index] ?? null;
        },
      });

      const dispatchTouch = (type, distance) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: makeTouches(distance) });
        node.dispatchEvent(event);
      };

      const dispatchGesture = (type, scale) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'scale', { value: scale });
        node.dispatchEvent(event);
      };

      dispatchTouch('touchstart', 100);
      dispatchGesture('gesturestart', 1);
      dispatchTouch('touchmove', 150);
      dispatchGesture('gesturechange', 1.5);
      dispatchTouch('touchend', 0);
      dispatchGesture('gestureend', 1.5);
    });

    await expect(reset).toHaveText('150%');
  });
});
