import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSignedSessionToken(
  purpose: string,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${purpose}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySignedSessionToken(
  token: string | undefined,
  purpose: string,
  secret: string,
): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokenPurpose, expiresAtRaw, signature] = parts;
  if (tokenPurpose !== purpose) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = sign(`${tokenPurpose}.${expiresAtRaw}`, secret);
  const expectedBytes = Buffer.from(expected, 'hex');
  let actualBytes: Buffer;
  try {
    actualBytes = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}
