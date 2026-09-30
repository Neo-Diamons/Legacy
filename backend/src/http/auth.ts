import fs from 'fs';
import { jwt, verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';
import { userService } from '@service/user.service.js';

export function getJwtSecret(): string {
  const file = process.env.JWT_SECRET_FILE;
  const secret = (file ? fs.readFileSync(file, 'utf8') : process.env.JWT_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and contain at least 32 characters');
  }
  return secret;
}

async function isSessionCurrent(payload: Record<string, unknown>): Promise<boolean> {
  if (typeof payload.sub !== 'string') return false;
  const version = await userService.getTokenVersion(payload.sub);
  return version !== undefined && version === payload.tv;
}

export async function verifyToken(token: string): Promise<string> {
  const payload = await verify(token, getJwtSecret(), 'HS256');
  if (typeof payload.sub !== 'string' || !(await isSessionCurrent(payload))) throw new Error('Session expired');
  return payload.sub;
}

export const jwtAuth = (): MiddlewareHandler => {
  const verifySignature = jwt({ secret: getJwtSecret(), alg: 'HS256' });
  return (c, next) =>
    verifySignature(c, async () => {
      if (!(await isSessionCurrent(c.get('jwtPayload') as Record<string, unknown>)))
        throw new HTTPException(401, { message: 'Session expired' });
      await next();
    });
};
