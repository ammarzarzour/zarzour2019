import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeBookingTransitionAudit } from './booking-transition-audit.mjs';

const base = { currentStatus: 'draft', nextStatus: 'pending_review', reasonCode: 'routine', occurredAt: '2026-11-19T00:00:00.000Z' };
test('creates immutable, explicitly unpersisted audit proposal without personal data', () => {
  const event = proposeBookingTransitionAudit(base);
  assert.equal(event.persisted, false);
  assert.equal(event.authorized, false);
  assert.equal(event.requiresAudit, true);
  assert.equal(event.previousStatus, 'draft');
  assert.ok(Object.isFrozen(event));
  assert.deepEqual(Object.keys(event).sort(), ['authorized','eventType','nextStatus','occurredAt','persisted','previousStatus','reasonCode','requiresAudit'].sort());
});
test('rejects skipped booking stages', () => {
  assert.throws(() => proposeBookingTransitionAudit({ ...base, nextStatus: 'closed' }), /Invalid booking transition/);
});
test('requires verified return and its dedicated audit reason', () => {
  const returned = { ...base, currentStatus: 'in_progress', nextStatus: 'returned', reasonCode: 'return_evidence_checked' };
  assert.throws(() => proposeBookingTransitionAudit(returned), /Verified traveler return/);
  assert.throws(() => proposeBookingTransitionAudit({ ...returned, returnVerified: true, reasonCode: 'routine' }), /reason code/);
  assert.equal(proposeBookingTransitionAudit({ ...returned, returnVerified: true }).nextStatus, 'returned');
});
test('rejects arbitrary free-text reasons and malformed dates', () => {
  assert.throws(() => proposeBookingTransitionAudit({ ...base, reasonCode: 'traveler name and phone' }), /reason code/);
  assert.throws(() => proposeBookingTransitionAudit({ ...base, occurredAt: 'yesterday' }), /timestamp/);
  assert.throws(() => proposeBookingTransitionAudit({ ...base, occurredAt: '2026-02-30T00:00:00.000Z' }), /timestamp/);
});
