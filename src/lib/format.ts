import type { Condition, ConditionPref, PtaPref, PtaStatus } from './types';

export function rs(n: number | null | undefined): string {
  if (n == null) return '—';
  return 'Rs ' + Math.round(n).toLocaleString('en-US');
}

export function rsShort(n: number): string {
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

/** Parses "180,000" or "180000" into a number. Returns NaN if empty. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : NaN;
}

export function formatAmountInput(text: string): string {
  const n = parseAmount(text);
  return Number.isNaN(n) ? '' : n.toLocaleString('en-US');
}

export const conditionLabel: Record<Condition, string> = {
  new: 'New',
  a_plus: 'Used · A+',
  a: 'Used · A',
  b: 'Used · B',
  c: 'Used · C',
};

export const conditionPrefLabel: Record<ConditionPref, string> = {
  new: 'New',
  used: 'Used',
  any: 'Any condition',
};

export const ptaLabel: Record<PtaStatus, string> = {
  pta_approved: 'PTA approved',
  non_pta: 'Non-PTA',
};

export const ptaPrefLabel: Record<PtaPref, string> = {
  pta_approved: 'PTA approved',
  non_pta: 'Non-PTA',
  any: 'Any PTA',
};

export function storageLabel(gb: number): string {
  return gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`;
}

export function secondsLeft(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

export function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ago`;
}

export function shopLocation(shop: { floor_label: string; stall_number: string; wing?: string | null }): string {
  return `${shop.floor_label} · Shop ${shop.stall_number}`;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}

/** Turns "0300 1234567", "3001234567" or "+923001234567" into +923001234567. */
export function toPkPhone(input: string): string | null {
  let d = input.replace(/[^0-9]/g, '');
  if (d.startsWith('92')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return /^3\d{9}$/.test(d) ? `+92${d}` : null;
}
