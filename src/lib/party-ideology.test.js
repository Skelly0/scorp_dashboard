import { describe, expect, test } from 'vitest';
import { partyIdeology } from './party-ideology.js';

const centered = { expansion: 4, authority: 4, corporate: 4, technocratic: 4, faith: 4, materialist: 4 };

describe('partyIdeology', () => {
  test('a perfectly centred stance is neutral, no lean', () => {
    const ideo = partyIdeology(centered);
    expect(ideo.color).toBe('var(--muted)');
    expect(ideo.leanLabel).toBe('Centrist');
    expect(ideo.strength).toBe(0);
  });

  test('missing stance degrades gracefully without throwing', () => {
    const ideo = partyIdeology(null);
    expect(ideo.color).toBe('var(--muted)');
    expect(ideo.strength).toBe(0);
    expect(typeof ideo.leanLabel).toBe('string');
  });

  test('a high-pole lean labels with AXIS_HIGH_LABELS and yields an hsl colour', () => {
    const ideo = partyIdeology({ ...centered, faith: 7 });
    expect(ideo.leanLabel).toBe('Reason');
    expect(ideo.leanAxis).toBe('faith');
    expect(ideo.color.startsWith('hsl(')).toBe(true);
    expect(ideo.strength).toBeGreaterThan(0);
  });

  test('a low-pole lean labels with the opposite pole', () => {
    const ideo = partyIdeology({ ...centered, corporate: 1 });
    expect(ideo.leanLabel).toBe('Corporate');
    expect(ideo.leanAxis).toBe('corporate');
  });

  test('stronger deviation is more saturated than a mild one', () => {
    const mild = partyIdeology({ ...centered, faith: 5 });
    const strong = partyIdeology({ ...centered, faith: 7 });
    const sat = (c) => Number(c.match(/hsl\(\d+ (\d+)%/)[1]);
    expect(sat(strong.color)).toBeGreaterThan(sat(mild.color));
  });

  test('opposite stances sit on opposite sides of the hue wheel', () => {
    const hue = (c) => Number(c.match(/hsl\((\d+)/)[1]);
    const high = hue(partyIdeology({ ...centered, faith: 7 }).color);
    const low = hue(partyIdeology({ ...centered, faith: 1 }).color);
    const diff = Math.abs(high - low);
    const circular = Math.min(diff, 360 - diff);
    expect(circular).toBeGreaterThan(150);
  });
});
