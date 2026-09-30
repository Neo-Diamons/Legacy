import { randomBytes } from 'node:crypto';
import { userService } from '@service/user.service.js';

const TICKET_TTL_MS = 30_000;

type Ticket = { userId: string; tokenVersion: number; expiresAt: number };

const tickets = new Map<string, Ticket>();

function sweep(now: number) {
  for (const [ticket, entry] of tickets) if (entry.expiresAt <= now) tickets.delete(ticket);
}

export function issueWsTicket(userId: string, tokenVersion: number): string {
  const now = Date.now();
  sweep(now);
  const ticket = randomBytes(32).toString('base64url');
  tickets.set(ticket, { userId, tokenVersion, expiresAt: now + TICKET_TTL_MS });
  return ticket;
}

export async function redeemWsTicket(ticket: string): Promise<string | undefined> {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  const version = await userService.getTokenVersion(entry.userId);
  return version === entry.tokenVersion ? entry.userId : undefined;
}
