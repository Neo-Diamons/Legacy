export function parsePort(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const trimmed = value.trim();
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || String(port) !== trimmed || port < 1 || port > 65535) {
    throw new Error(`Invalid port ${JSON.stringify(value)}: expected an integer between 1 and 65535`);
  }
  return port;
}
