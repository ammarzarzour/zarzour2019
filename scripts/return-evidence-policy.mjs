/**
 * Offline preflight for traveler return verification. No personal data, authorization,
 * database access, or payments. A positive result is NOT proof of a real return:
 * a privileged server must validate source records and record an immutable audit.
 */
export const returnEvidenceTypes = Object.freeze(['border_exit_confirmation', 'carrier_arrival_confirmation', 'authorized_officer_review']);
export function evaluateReturnEvidence({ evidenceTypes, reviewedByAuthorizedOfficer = false, referenceChecked = false } = {}) {
  if (!Array.isArray(evidenceTypes) || evidenceTypes.length === 0 ||
      evidenceTypes.some(type => !returnEvidenceTypes.includes(type)) ||
      new Set(evidenceTypes).size !== evidenceTypes.length) {
    throw new RangeError('Evidence types must be a nonempty, unique list of approved codes');
  }
  if (typeof reviewedByAuthorizedOfficer !== 'boolean' || typeof referenceChecked !== 'boolean') {
    throw new TypeError('Review flags must be booleans');
  }
  const hasExternalEvidence = evidenceTypes.includes('border_exit_confirmation') || evidenceTypes.includes('carrier_arrival_confirmation');
  const missing = [];
  if (!hasExternalEvidence) missing.push('external_evidence_required');
  if (!referenceChecked) missing.push('reference_check_required');
  if (!reviewedByAuthorizedOfficer) missing.push('authorized_review_required');
  return Object.freeze({ eligibleForServerVerification: missing.length === 0, missing: Object.freeze(missing), authorized: false, persisted: false });
}
