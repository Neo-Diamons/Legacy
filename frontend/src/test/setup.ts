import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { MockWebSocket } from './helpers';

beforeEach(() => {
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  MockWebSocket.instances = [];
});
