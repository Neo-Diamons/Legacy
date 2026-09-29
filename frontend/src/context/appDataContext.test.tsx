import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { useAppData } from './appDataContext';

describe('useAppData', () => {
  test('throws a helpful error outside <AppDataProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Orphan = () => {
      useAppData();
      return null;
    };
    expect(() => render(<Orphan />)).toThrow('useAppData must be used within an <AppDataProvider>');
  });
});
