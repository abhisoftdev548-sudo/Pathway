import { describe, expect, it } from 'vitest';
import { clampPercent, formatMinutes, initials, percent } from './utils';

describe('display helpers', () => {
  it('never divides by zero and rounds percentages to one decimal', () => {
    expect(percent(1, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33.3);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-4)).toBe(0);
  });

  it('formats durations and names the way the UI shows them', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(90)).toBe('1 hr 30 min');
    expect(initials('Ada Lovelace')).toBe('AL');
  });
});
