import test from "node:test";
import assert from "node:assert/strict";
import { bookingMetrics, bookingReadiness, filterBookings, normalizeBooking, safeBookings, validateBooking, upsertBooking } from "../docs/bookings-model.mjs";

const valid = { reference: "BK-201", service: "flight", status: "confirmed", travelers: 4, startDate: "2026-11-12", endDate: "2026-11-12", supplierReference: "SUP-88", supplierConfirmed: true, documentsChecked: true, itineraryIssued: true, notes: "Synthetic test" };

test("validates operational booking fields", () => {
  assert.deepEqual(validateBooking(valid), []);
  assert.deepEqual(validateBooking({ ...valid, reference: "!", service: "other", travelers: 0 }), ["reference", "service", "travelers"]);
});

test("rejects an end date before the start", () => assert.deepEqual(validateBooking({ ...valid, endDate: "2026-11-11" }), ["endDate"]));

test("normalizes references, numbers and checkboxes", () => {
  const item = normalizeBooking({ ...valid, reference: " bk-201 ", travelers: "4", supplierConfirmed: "on" }, "one");
  assert.equal(item.reference, "BK-201"); assert.equal(item.travelers, 4); assert.equal(item.supplierConfirmed, true);
});

test("requires supplier confirmation and issued documents for confirmed bookings", () => {
  const item = normalizeBooking({ ...valid, supplierReference: "", documentsChecked: false });
  assert.deepEqual(bookingReadiness(item).blockers, ["supplierReference", "documentsChecked"]);
});

test("sanitizes duplicate and malformed stored bookings", () => {
  const first = normalizeBooking(valid, "one");
  assert.deepEqual(safeBookings([first, { ...first, id: "two" }, { id: "bad" }]).map(item => item.id), ["one"]);
});

test("calculates service, alert and traveler metrics", () => {
  const items = [
    normalizeBooking(valid, "a"),
    normalizeBooking({ ...valid, reference: "BK-202", status: "hold", supplierConfirmed: false, startDate: "2026-11-20", endDate: "2026-11-21", travelers: 2 }, "b"),
    normalizeBooking({ ...valid, reference: "BK-203", status: "in_service", startDate: "2026-11-01", endDate: "2026-11-08", travelers: 3 }, "c"),
    normalizeBooking({ ...valid, reference: "BK-204", status: "cancelled", travelers: 9 }, "d")
  ];
  assert.deepEqual(bookingMetrics(items, "2026-11-09"), { total: 4, travelers: 9, hold: 1, confirmed: 1, inService: 1, blocked: 1, startingSoon: 1, overdue: 1, completed: 0 });
});

test("filters by service, status and supplier reference", () => {
  const items = [normalizeBooking(valid, "a"), normalizeBooking({ ...valid, reference: "HT-7", service: "hotel", status: "hold", supplierReference: "HOTEL-4" }, "b")];
  assert.deepEqual(filterBookings(items, { query: "hotel-4", service: "hotel", status: "hold" }).map(item => item.id), ["b"]);
});


test("updates a booking without adding a second record",()=>{
 const before=[normalizeBooking(valid,"a")]; const result=upsertBooking(before,{...valid,status:"completed"},"a");
 assert.deepEqual(result.errors,[]);assert.equal(result.items.length,1);assert.equal(result.items[0].status,"completed");assert.equal(before[0].status,"confirmed");
});
test("rejects duplicate references case-insensitively without changing records",()=>{
 const before=[normalizeBooking(valid,"a")];const result=upsertBooking(before,{...valid,reference:" bk-201 "},"b");
 assert.deepEqual(result.errors,["duplicateReference"]);assert.equal(result.items,before);
});

test("rejects impossible dates and accepts actual leap days", () => {
  for (const date of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10"]) {
    assert.ok(validateBooking({ ...valid, startDate: date, endDate: date }).includes("startDate"));
    assert.ok(validateBooking({ ...valid, startDate: "2026-01-01", endDate: date }).includes("endDate"));
  }
  assert.deepEqual(validateBooking({ ...valid, startDate: "2028-02-29", endDate: "2028-02-29" }), []);
});
test("invalid booking dates cannot be saved or updated", () => {
  const before = [normalizeBooking(valid, "a")];
  for (const id of ["a", "b"]) {
    const result = upsertBooking(before, { ...valid, reference: "BK-NEW", endDate: "2026-11-31" }, id);
    assert.ok(result.errors.includes("endDate"));
    assert.equal(result.items, before);
  }
});
test("stored bookings with impossible dates are excluded", () => {
  const good = normalizeBooking(valid, "a");
  assert.deepEqual(safeBookings([good, { ...good, id: "b", reference: "BK-BAD", endDate: "2026-11-31" }]), [good]);
});
