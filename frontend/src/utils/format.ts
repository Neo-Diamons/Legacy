import type { TaskPriority } from '../types';

export const PRIORITY_LABELS: Record<TaskPriority, { label: string; variant: string }> = {
  urgent: { label: 'Urgente', variant: 'dark' },
  high: { label: 'Haute', variant: 'danger' },
  medium: { label: 'Moyenne', variant: 'warning' },
  low: { label: 'Basse', variant: 'secondary' },
};

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
