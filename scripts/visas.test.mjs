import test from "node:test";
import assert from "node:assert/strict";
import { filterVisaCases, normalizeVisaCase, safeVisaCases, validateVisaCase, visaMetrics, visaReadiness } from "../docs/visas-model.mjs";

const valid = { reference: "vz-104", type: "umrah", destination: "Saudi Arabia", status: "documents", targetDate: "2026-11-14", submittedDate: "", passportChecked: true, photoChecked: true, applicationChecked: true, itineraryChecked: true, notes: "Synthetic test case" };

test("validates required operational fields", () => {
  assert.deepEqual(validateVisaCase(valid), []);
  assert.deepEqual(validateVisaCase({ ...valid, reference: "!", type: "other", targetDate: "bad" }), ["reference", "type", "targetDate"]);
});

test("requires a submission date after submission", () => assert.deepEqual(validateVisaCase({ ...valid, status: "review" }), ["submittedDate"]));

test("normalizes references and checkbox values", () => {
  const item = normalizeVisaCase({ ...valid, reference: " vz-104 ", photoChecked: "on" }, "case-1");
  assert.equal(item.reference, "VZ-104"); assert.equal(item.photoChecked, true); assert.equal(item.id, "case-1");
});

test("uses itinerary as a blocker for Umrah but not business cases", () => {
  assert.deepEqual(visaReadiness({ ...normalizeVisaCase(valid), itineraryChecked: false }).blockers, ["itineraryChecked"]);
  assert.equal(visaReadiness({ ...normalizeVisaCase(valid), type: "business", itineraryChecked: false }).ready, true);
});

test("sanitizes malformed and duplicate stored cases", () => {
  const first = normalizeVisaCase(valid, "one");
  assert.deepEqual(safeVisaCases([first, { ...first, id: "two" }, { id: "broken" }]).map(item => item.id), ["one"]);
});

test("calculates readiness and deadline alerts", () => {
  const items = [
    normalizeVisaCase(valid, "a"),
    normalizeVisaCase({ ...valid, reference: "VZ-105", targetDate: "2026-11-08", itineraryChecked: false }, "b"),
    normalizeVisaCase({ ...valid, reference: "VZ-106", status: "approved", submittedDate: "2026-11-01" }, "c")
  ];
  assert.deepEqual(visaMetrics(items, "2026-11-09"), { total: 3, submitted: 0, approved: 1, rejected: 0, blocked: 1, overdue: 1, dueSoon: 1, ready: 1 });
});

test("filters by type, status and reference", () => {
  const items = [normalizeVisaCase(valid, "a"), normalizeVisaCase({ ...valid, reference: "BIZ-9", type: "business", status: "draft" }, "b")];
  assert.deepEqual(filterVisaCases(items, { query: "biz", type: "business", status: "draft" }).map(item => item.id), ["b"]);
});


test("rejects impossible calendar dates in both date fields", () => {
  for (const date of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01"]) {
    assert.deepEqual(validateVisaCase({ ...valid, targetDate: date }), ["targetDate"]);
    assert.deepEqual(validateVisaCase({ ...valid, submittedDate: date }), ["submittedDate"]);
  }
});

test("accepts leap days and excludes impossible stored deadlines", () => {
  assert.deepEqual(validateVisaCase({ ...valid, targetDate: "2028-02-29" }), []);
  assert.deepEqual(safeVisaCases([{ ...normalizeVisaCase(valid, "bad-date"), targetDate: "2026-02-30" }]), []);
});
