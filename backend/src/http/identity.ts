import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';

type JwtPayload = { sub?: string };

export function getAuthenticatedUserId(c: Context): string {
  const subject = (c.get('jwtPayload') as JwtPayload | undefined)?.sub;
  if (!subject) throw new HTTPException(401, { message: 'Authentication required' });
  return subject;
}

export function requireOwnUser(c: Context, requestedId: string): string {
  const userId = getAuthenticatedUserId(c);
  if (userId !== requestedId) throw new HTTPException(403, { message: 'Access denied' });
  return userId;
}
