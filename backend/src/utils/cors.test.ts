import { parseAllowedOrigins, resolveAllowedOrigins } from '@utils/cors.js';

describe('parseAllowedOrigins', () => {
  it.each([undefined, '', '   ', ' , ,'])('falls back to the local frontend origins for %j', (value) => {
    expect(parseAllowedOrigins(value, 5173)).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('uses the given frontend port in the defaults', () => {
    expect(parseAllowedOrigins(undefined, 8080)).toEqual(['http://localhost:8080', 'http://127.0.0.1:8080']);
  });

  it('parses a comma separated list, trimming and skipping empty entries', () => {
    expect(parseAllowedOrigins(' https://a.example.com , http://b.example.com:8080,, ', 5173)).toEqual([
      'https://a.example.com',
      'http://b.example.com:8080',
    ]);
  });

  it('normalises to the bare origin (drops the trailing slash and default port)', () => {
    expect(parseAllowedOrigins('https://a.example.com/', 5173)).toEqual(['https://a.example.com']);
    expect(parseAllowedOrigins('https://a.example.com:443', 5173)).toEqual(['https://a.example.com']);
  });

  it.each([
    ['not a url', 'expected e.g. https://app.example.com'],
    ['app.example.com', 'expected e.g. https://app.example.com'],
    ['ftp://a.example.com', 'only http and https are allowed'],
    ['javascript:alert(1)', 'only http and https are allowed'],
    ['https://a.example.com/path', 'no path, query or fragment allowed'],
    ['https://a.example.com?x=1', 'no path, query or fragment allowed'],
    ['https://a.example.com/#frag', 'no path, query or fragment allowed'],
  ])('rejects %j', (value, reason) => {
    expect(() => parseAllowedOrigins(value, 5173)).toThrow(reason);
  });

  it('rejects the whole list when any single entry is invalid', () => {
    expect(() => parseAllowedOrigins('https://ok.example.com,nope', 5173)).toThrow('Invalid CORS origin');
  });

  it('never allows a wildcard', () => {
    expect(() => parseAllowedOrigins('*', 5173)).toThrow('Invalid CORS origin');
  });
});

describe('resolveAllowedOrigins', () => {
  it('reads CORS_ALLOWED_ORIGINS and FRONTEND_PORT from the given environment', () => {
    expect(resolveAllowedOrigins({ CORS_ALLOWED_ORIGINS: 'https://a.example.com' })).toEqual(['https://a.example.com']);
    expect(resolveAllowedOrigins({ FRONTEND_PORT: '4000' })).toEqual([
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ]);
    expect(resolveAllowedOrigins({})).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('propagates an invalid FRONTEND_PORT', () => {
    expect(() => resolveAllowedOrigins({ FRONTEND_PORT: 'abc' })).toThrow('Invalid port');
  });
});
