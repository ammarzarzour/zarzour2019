import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingStatuses, transitionBooking, allowedBookingTransitions } from './booking-lifecycle.mjs';
test('valid offline lifecycle requires verified return', () => {
  let status = 'draft';
  for (const next of ['pending_review', 'confirmed', 'in_progress']) status = transitionBooking(status, next).status;
  assert.throws(() => transitionBooking(status, 'returned'), /Verified traveler return/);
  const result = transitionBooking(status, 'returned', { returnVerified: true });
  assert.deepEqual(result, { previousStatus: 'in_progress', status: 'returned', requiresAudit: true });
  assert.equal(transitionBooking('returned', 'closed').status, 'closed');
});
test('terminal states and skipped stages are rejected', () => {
  for (const status of ['closed', 'cancelled']) assert.deepEqual(allowedBookingTransitions(status), []);
  assert.throws(() => transitionBooking('draft', 'confirmed'), /Invalid/);
  assert.throws(() => transitionBooking('closed', 'draft'), /Invalid/);
  assert.throws(() => transitionBooking('draft', 'draft'), /Invalid/);
});
test('unknown statuses and truthy but unverified return are rejected', () => {
  assert.throws(() => transitionBooking('unknown', 'draft'), RangeError);
  assert.throws(() => allowedBookingTransitions('unknown'), RangeError);
  assert.throws(() => transitionBooking('in_progress', 'returned', { returnVerified: 'yes' }), /Verified/);
  assert.equal(bookingStatuses.length, 7);
});
test('no financial action or side effect: immutable result', () => {
  const result = transitionBooking('draft', 'pending_review');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.requiresAudit, true);
});
