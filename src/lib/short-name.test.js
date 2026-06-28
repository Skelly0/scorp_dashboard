import { describe, expect, test } from 'vitest';
import { abbrevName } from './short-name.js';

describe('abbrevName', () => {
  test('initials of significant words, articles/conjunctions dropped', () => {
    expect(abbrevName('The All Lunar Labor Bund')).toBe('ALLB');
    expect(abbrevName('Novus Chrysalis Collective')).toBe('NCC');
    expect(abbrevName('Selenite Rose Front')).toBe('SRF');
    expect(abbrevName('Lunar Reconstruction Association')).toBe('LRA');
  });
  test('single-word names take the first three letters', () => {
    expect(abbrevName('Independent')).toBe('IND');
    expect(abbrevName('Non-aligned')).toBe('NA'); // hyphen splits; "aligned" → N + A
  });
  test('caps initials at four and tolerates blanks', () => {
    expect(abbrevName('Education Party')).toBe('EP');
    expect(abbrevName('')).toBe('');
    expect(abbrevName(null)).toBe('');
  });
});
