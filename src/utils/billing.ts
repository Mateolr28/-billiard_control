import { TableSession } from '../types';

/**
 * Format currency without unnecessary decimals, using standard Colombian/LatAm thousand separators
 * e.g. 12000 -> "$12.000"
 */
export function formatMoney(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0';
  }
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);

  // International standard format clean-up
  return formatted.replace(/\s+/g, ' ');
}

/**
 * Format seconds into HH:MM:SS (or MM:SS if under 1 hour)
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return '00:00';
  const sec = Math.floor(seconds % 60);
  const min = Math.floor((seconds / 60) % 60);
  const hrs = Math.floor(seconds / 3600);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}`;
}

/**
 * Calculate active elapsed time in seconds for a session
 * Accounting for pauses cleanly without polling every second to database
 */
export function calculateElapsedSeconds(session: TableSession, nowTimestamp: number = Date.now()): number {
  const startedAtMs = new Date(session.started_at).getTime();
  if (isNaN(startedAtMs)) return 0;

  let effectiveEndMs = nowTimestamp;

  if (session.status === 'paused' && session.paused_at) {
    effectiveEndMs = new Date(session.paused_at).getTime();
  } else if (session.status === 'ended' && session.ended_at) {
    effectiveEndMs = new Date(session.ended_at).getTime();
  }

  const rawElapsedSeconds = Math.max(0, Math.floor((effectiveEndMs - startedAtMs) / 1000));
  const activeSeconds = Math.max(0, rawElapsedSeconds - (session.total_paused_seconds || 0));

  return activeSeconds;
}

/**
 * Calculate remaining seconds for a prepago session
 */
export function calculatePrepagoRemainingSeconds(session: TableSession, nowTimestamp: number = Date.now()): number {
  if (session.mode !== 'prepago' || !session.prepago_minutes) return 0;
  const totalAllowedSeconds = session.prepago_minutes * 60;
  const elapsed = calculateElapsedSeconds(session, nowTimestamp);
  return Math.max(0, totalAllowedSeconds - elapsed);
}

/**
 * Calculate monetary cost for elapsed time based on hourly rate
 * Example: $10.000 / hr ->
 * 30 min = $5.000
 * 45 min = $7.500
 * 60 min = $10.000
 * Uses round to nearest $100 for clean billar cashier transactions
 */
export function calculateTimeCost(elapsedSeconds: number, hourlyRate: number): number {
  if (elapsedSeconds <= 0 || hourlyRate <= 0) return 0;
  
  // Rate per second
  const rawCost = (elapsedSeconds / 3600) * hourlyRate;
  
  // Clean rounding to nearest $100 to prevent odd single-peso changes
  return Math.round(rawCost / 100) * 100;
}

/**
 * Safe UUID v4 generator for both online and offline environments
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
