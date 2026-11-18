import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReturnEvidence } from './return-evidence-policy.mjs';

test('requires independent evidence, reference check and officer review', () => {
  const decision = evaluateReturnEvidence({ evidenceTypes: ['border_exit_confirmation'] });
  assert.equal(decision.eligibleForServerVerification, false);
  assert.deepEqual(decision.missing, ['reference_check_required', 'authorized_review_required']);
});
test('accepts valid checklist but never claims authorization or persistence', () => {
  const decision = evaluateReturnEvidence({ evidenceTypes: ['carrier_arrival_confirmation'], referenceChecked: true, reviewedByAuthorizedOfficer: true });
  assert.equal(decision.eligibleForServerVerification, true);
  assert.equal(decision.authorized, false);
  assert.equal(decision.persisted, false);
  assert.ok(Object.isFrozen(decision));
  assert.ok(Object.isFrozen(decision.missing));
});
test('officer review alone is insufficient', () => {
  const decision = evaluateReturnEvidence({ evidenceTypes: ['authorized_officer_review'], referenceChecked: true, reviewedByAuthorizedOfficer: true });
  assert.deepEqual(decision.missing, ['external_evidence_required']);
});
test('rejects unknown, duplicate, missing and malformed evidence', () => {
  for (const evidenceTypes of [[], ['passport_number'], ['border_exit_confirmation', 'border_exit_confirmation'], 'border_exit_confirmation']) {
    assert.throws(() => evaluateReturnEvidence({ evidenceTypes }), RangeError);
  }
  assert.throws(() => evaluateReturnEvidence({ evidenceTypes: ['border_exit_confirmation'], referenceChecked: 'yes' }), TypeError);
});
