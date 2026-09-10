import { parsePort } from '@utils/port.js';

describe('parsePort', () => {
  it('returns the fallback when value is undefined', () => {
    expect(parsePort(undefined, 3000)).toBe(3000);
  });

  it('returns the fallback when value is empty or whitespace', () => {
    expect(parsePort('', 3000)).toBe(3000);
    expect(parsePort('   ', 3000)).toBe(3000);
  });

  it('parses a valid decimal port', () => {
    expect(parsePort('8080', 3000)).toBe(8080);
    expect(parsePort(' 8080 ', 3000)).toBe(8080);
  });

  it('accepts the boundary values 1 and 65535', () => {
    expect(parsePort('1', 3000)).toBe(1);
    expect(parsePort('65535', 3000)).toBe(65535);
  });

  it('throws on non-numeric input', () => {
    expect(() => parsePort('abc', 3000)).toThrow(/Invalid port/);
    expect(() => parsePort('12abc', 3000)).toThrow(/Invalid port/);
  });

  it('throws on non-decimal notations', () => {
    expect(() => parsePort('0x10', 3000)).toThrow(/Invalid port/);
    expect(() => parsePort('1e3', 3000)).toThrow(/Invalid port/);
  });

  it('throws on floats', () => {
    expect(() => parsePort('80.5', 3000)).toThrow(/Invalid port/);
  });

  it('throws on out-of-range ports', () => {
    expect(() => parsePort('0', 3000)).toThrow(/Invalid port/);
    expect(() => parsePort('-1', 3000)).toThrow(/Invalid port/);
    expect(() => parsePort('65536', 3000)).toThrow(/Invalid port/);
  });
});
