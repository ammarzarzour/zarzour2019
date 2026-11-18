/** Pure, offline travel booking lifecycle rules. No database, network, or payments. */
export const bookingStatuses = Object.freeze(['draft', 'pending_review', 'confirmed', 'in_progress', 'returned', 'closed', 'cancelled']);
const transitions = Object.freeze({
  draft: ['pending_review', 'cancelled'],
  pending_review: ['draft', 'confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['returned'],
  returned: ['closed'],
  closed: [],
  cancelled: [],
});
export function transitionBooking(current, next, { returnVerified = false } = {}) {
  if (!bookingStatuses.includes(current) || !bookingStatuses.includes(next)) {
    throw new RangeError('Unknown booking status');
  }
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid booking transition: ${current} -> ${next}`);
  }
  if (next === 'returned' && returnVerified !== true) {
    throw new Error('Verified traveler return is required');
  }
  return Object.freeze({ previousStatus: current, status: next, requiresAudit: true });
}
export function allowedBookingTransitions(status) {
  if (!bookingStatuses.includes(status)) throw new RangeError('Unknown booking status');
  return [...transitions[status]];
}
