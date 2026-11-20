import { transitionBooking } from './booking-lifecycle.mjs';

/**
 * Build a privacy-minimized audit proposal for an authorized booking transition.
 * Offline only: does not authenticate users, persist records, or grant permissions.
 * A server must independently authorize the actor and write an immutable audit log
 * atomically with the booking update before production use.
 */
export function proposeBookingTransitionAudit({ currentStatus, nextStatus, returnVerified = false, reasonCode, occurredAt }) {
  const result = transitionBooking(currentStatus, nextStatus, { returnVerified });
  const reasons = Object.freeze(['routine', 'customer_request', 'operator_review', 'return_evidence_checked']);
  if (!reasons.includes(reasonCode)) throw new RangeError('Unrecognized audit reason code');
  if (nextStatus === 'returned' && reasonCode !== 'return_evidence_checked') {
    throw new Error('Verified return must use the return evidence reason code');
  }
  if (nextStatus !== 'returned' && reasonCode === 'return_evidence_checked') {
    throw new Error('Return evidence reason code is reserved for verified return');
  }
  const timestamp = typeof occurredAt === 'string'
    ? /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,3}))?Z$/.exec(occurredAt)
    : null;
  if (!timestamp || timestamp[0] !== occurredAt) {
    throw new TypeError('A valid UTC ISO timestamp is required');
  }
  const normalized = timestamp[1] + '.' + (timestamp[2] ?? '').padEnd(3, '0') + 'Z';
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new TypeError('A valid UTC ISO timestamp is required');
  }
  return Object.freeze({
    eventType: 'booking_status_transition',
    previousStatus: result.previousStatus,
    nextStatus: result.status,
    reasonCode,
    occurredAt,
    requiresAudit: true,
    persisted: false,
    authorized: false,
  });
}
