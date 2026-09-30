import { hashPassword, verifyPassword } from '@utils/password.js';

describe('hashPassword', () => {
  it('produces scrypt:<salt>:<key> and never contains the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const [algorithm, salt, key, ...rest] = hash.split(':');

    expect(algorithm).toBe('scrypt');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{128}$/);
    expect(rest).toEqual([]);
    expect(hash).not.toContain('correct-horse-battery');
  });

  it('uses a fresh salt each time so equal passwords hash differently', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password-1'), hashPassword('same-password-1')]);
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('accepts the original password', async () => {
    expect(await verifyPassword('correct-horse-battery', await hashPassword('correct-horse-battery'))).toBe(true);
  });

  it.each(['correct-horse-batter', 'correct-horse-batteryy', 'Correct-horse-battery', '', ' correct-horse-battery'])(
    'rejects %j',
    async (attempt) => {
      expect(await verifyPassword(attempt, await hashPassword('correct-horse-battery'))).toBe(false);
    }
  );

  it('handles unicode and very long passwords', async () => {
    for (const password of ['pässwörd-🔐-日本語-long', 'x'.repeat(10_000)]) {
      const hash = await hashPassword(password);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword(`${password}!`, hash)).toBe(false);
    }
  });

  it('accepts the empty password only against its own hash', async () => {
    const hash = await hashPassword('');
    expect(await verifyPassword('', hash)).toBe(true);
    expect(await verifyPassword('a', hash)).toBe(false);
  });

  it('rejects a hash made with a different salt', async () => {
    const [a, b] = await Promise.all([hashPassword('pw-number-one'), hashPassword('pw-number-one')]);
    const [algorithm, saltA] = a.split(':');
    const keyB = b.split(':')[2];
    expect(await verifyPassword('pw-number-one', `${algorithm}:${saltA}:${keyB}`)).toBe(false);
  });

  it.each([
    ['empty string', ''],
    ['unknown algorithm', 'bcrypt:abcd:abcd'],
    ['placeholder used by migrations', '!'],
    ['missing key', 'scrypt:abcd'],
    ['missing salt', 'scrypt::abcd'],
    ['no separators', 'scrypt'],
    ['truncated key', 'scrypt:abcd:abcd'],
    ['non-hex key', `scrypt:abcd:${'zz'.repeat(64)}`],
  ])('returns false (does not throw) for a malformed stored value: %s', async (_name, stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });

  it('verifies the legacy hash shipped in the migrations against the documented password', async () => {
    const legacyHash =
      'scrypt:16c774f711f8bd660bfc555c3494597a:1f2beb82b4ca566c3a42e63ac9fef618003883ddfdeba8f7b725768dcc3cebb347d827187ce44037d6b50b636c60ba97e8b0e8a80dfd4b3b76ecaf765dea9fd8';
    expect(await verifyPassword('LegacyUser123!', legacyHash)).toBe(true);
    expect(await verifyPassword('legacyuser123!', legacyHash)).toBe(false);
  });
});
