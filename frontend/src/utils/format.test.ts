import { describe, expect, test } from 'vitest';

import { formatDate, formatShortDate, initialsOf, PRIORITY_LABELS } from './format';

describe('initialsOf', () => {
  test.each([
    ['Michel Dupont', 'MD'],
    ['michel dupont', 'MD'],
    ['Michel', 'M'],
    ['Jean Pierre Dupont', 'JP'],
    ['  Michel   Dupont  ', 'MD'],
    ['Élodie Martin', 'ÉM'],
  ])('%j -> %j', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });

  test.each([[''], ['   ']])('returns an empty string for blank input %j', (name) => {
    expect(initialsOf(name)).toBe('');
  });
});

describe('date formatting (fr-FR)', () => {
  // Noon UTC keeps the calendar day stable in every timezone.
  test('formatDate includes the year', () => {
    expect(formatDate('2026-01-14T12:00:00.000Z')).toBe('14 janv. 2026');
  });

  test('formatShortDate omits the year', () => {
    expect(formatShortDate('2026-03-02T12:00:00.000Z')).toBe('2 mars');
  });
});

describe('PRIORITY_LABELS', () => {
  test('covers every priority with a distinct label', () => {
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual(['high', 'low', 'medium', 'urgent']);
    const labels = Object.values(PRIORITY_LABELS).map((p) => p.label);
    expect(new Set(labels).size).toBe(4);
  });
});
