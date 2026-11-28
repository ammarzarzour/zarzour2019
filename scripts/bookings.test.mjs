import test from "node:test";
import assert from "node:assert/strict";
import { bookingMetrics, bookingReadiness, filterBookings, normalizeBooking, safeBookings, validateBooking, upsertBooking } from "../docs/bookings-model.mjs";

const valid = { reference: "BK-201", service: "flight", status: "confirmed", travelers: 4, startDate: "2026-11-12", endDate: "2026-11-12", supplierReference: "SUP-88", supplierConfirmed: true, documentsChecked: true, itineraryIssued: true, notes: "Synthetic test" };

test("validates operational booking fields", () => {
  assert.deepEqual(validateBooking(valid), []);
  assert.deepEqual(validateBooking({ ...valid, reference: "!", service: "other", travelers: 0 }), ["reference", "service", "travelers"]);
});


test("malformed booking payloads fail closed without throwing or writing", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const payload of [null, undefined, false, 0, "invalid", []]) {
    assert.deepEqual(validateBooking(payload), ["booking"]);
    const result = upsertBooking(before, payload, "new-id");
    assert.deepEqual(result.errors, ["booking"]);
    assert.strictEqual(result.items, before);
  }
  assert.deepEqual(safeBookings([null, false, [], before[0]]), before);
});

test("rejects non-decimal, boolean and malformed traveler counts without saving", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const travelers of [true, false, "1e2", "0x10", "2.5", "Infinity", "  ", [], {}, null]) {
    assert.ok(validateBooking({ ...valid, travelers }).includes("travelers"), String(travelers));
    const result = upsertBooking(before, { ...valid, reference: "BK-NEW", travelers }, "new-id");
    assert.deepEqual(result.errors, ["travelers"]);
    assert.strictEqual(result.items, before);
  }
  for (const travelers of [1, 500, "1", "004", " 12 "]) {
    assert.deepEqual(validateBooking({ ...valid, travelers }), []);
  }
});

test("rejects structured supplier references and notes without modifying bookings", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const field of ["supplierReference", "notes"]) {
    for (const value of [{ code: "X" }, ["X"], 42, true]) {
      const input = { ...valid, reference: "BK-NEW", [field]: value };
      assert.ok(validateBooking(input).includes(field));
      const result = upsertBooking(before, input, "new-id");
      assert.ok(result.errors.includes(field));
      assert.strictEqual(result.items, before);
    }
  }
  assert.deepEqual(validateBooking({ ...valid, supplierReference: "", notes: "" }), []);
});

test("rejects malformed readiness flags without mutating local bookings", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const field of ["supplierConfirmed", "documentsChecked", "itineraryIssued"]) {
    for (const value of ["false", "true", 0, 1, [], {}, "yes"]) {
      const input = { ...valid, reference: "BK-NEW", [field]: value };
      assert.ok(validateBooking(input).includes(field), field + ": " + String(value));
      const result = upsertBooking(before, input, "new-id");
      assert.ok(result.errors.includes(field));
      assert.strictEqual(result.items, before);
    }
    for (const value of [true, false, "on", undefined, null]) {
      assert.deepEqual(validateBooking({ ...valid, [field]: value }), []);
    }
  }
  const stored = normalizeBooking(valid, "stored");
  assert.deepEqual(safeBookings([{ ...stored, supplierConfirmed: "true" }]), []);
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
 const before=[normalizeBooking(valid,"a")]; const result=upsertBooking(before,{...valid,status:"completed"},"a",before[0]);
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
    const result = upsertBooking(before, { ...valid, reference: "BK-NEW", endDate: "2026-11-31" }, id, id==="a"?before[0]:undefined);
    assert.ok(result.errors.includes("endDate"));
    assert.equal(result.items, before);
  }
});
test("stored bookings with impossible dates are excluded", () => {
  const good = normalizeBooking(valid, "a");
  assert.deepEqual(safeBookings([good, { ...good, id: "b", reference: "BK-BAD", endDate: "2026-11-31" }]), [good]);
});

// Audit proposals are offline-only; regression coverage for strict UTC dates.
test("booking transition audit rejects impossible and noncanonical UTC timestamps", async () => {
  const { proposeBookingTransitionAudit } = await import("./booking-transition-audit.mjs");
  const base = { currentStatus: "draft", nextStatus: "pending_review", reasonCode: "routine" };
  for (const occurredAt of [
    "2026-02-29T12:00:00Z", "2026-04-31T12:00:00Z", "2026-11-20T24:00:00Z",
    "2026-11-20T12:60:00Z", "2026-11-20T12:00:60Z", "2026-11-20T12:00:00+00:00",
    "2026-11-20T12:00:00.1234Z", "2026-11-20T12:00:00z",
  ]) {
    assert.throws(() => proposeBookingTransitionAudit({ ...base, occurredAt }), TypeError, occurredAt);
  }
  for (const occurredAt of ["2028-02-29T12:00:00Z", "2026-11-20T12:00:00.1Z", "2026-11-20T12:00:00.123Z"]) {
    const audit = proposeBookingTransitionAudit({ ...base, occurredAt });
    assert.equal(audit.occurredAt, occurredAt);
    assert.equal(audit.persisted, false);
    assert.equal(audit.authorized, false);
    assert.ok(Object.isFrozen(audit));
  }
});

test("booking IDs never replace existing records on create",()=>{
 const first=normalizeBooking(valid,"id-one"),before=[first];
 const result=upsertBooking(before,{...valid,reference:"BK-OTHER"},"id-one");
 assert.deepEqual(result.errors,["duplicateId"]);assert.strictEqual(result.items,before);
 assert.equal(before[0].reference,"BK-201");
});
test("stale booking edit cannot overwrite newer data or recreate a deleted booking",()=>{
 const original=normalizeBooking(valid,"id-one");
 const changed={...original,notes:"Newer update"};
 for(const latest of [[changed],[]]){
  const result=upsertBooking(latest,{...valid,notes:"Stale overwrite"},"id-one",original);
  assert.deepEqual(result.errors,["conflict"]);assert.strictEqual(result.items,latest);
 }
 const correct=upsertBooking([original],{...valid,notes:"Current edit"},"id-one",{...original});
 assert.deepEqual(correct.errors,[]);assert.equal(correct.items[0].notes,"Current edit");
 assert.equal(original.notes,"Synthetic test");
});
test("booking update snapshots must match their booking ID",()=>{
 const original=normalizeBooking(valid,"id-one");
 const other=normalizeBooking({...valid,reference:"BK-202"},"id-two");
 const stored=[original,other];
 for(const wrong of [other,{...original,id:"id-two"},null,{},[]]){
  const result=upsertBooking(stored,{...valid,notes:"Overwrite"},"id-one",wrong);
  assert.deepEqual(result.errors,["conflict"]);
  assert.strictEqual(result.items,stored);
 }
});
test("corrupt local booking registers fail closed without writing",()=>{
 const validItem=normalizeBooking(valid,"id-one");
 for(const stored of [
  [{...validItem},{...validItem}],
  [validItem,{...validItem,id:"another",reference:"bk-201"}],
  [validItem,{id:"bad"}],
  null,{},[]
 ]){
  const expected=stored===null?["bookingStore"]:Array.isArray(stored)&&stored.length===0?[]:["bookingStore"];
  const result=upsertBooking(stored,{...valid,reference:"BK-NEW"},"new-id");
  assert.deepEqual(result.errors,expected);
  if(expected.length)assert.strictEqual(result.items,stored);
 }
});


test("booking interface preserves newer cross-tab data, unsaved form values and delete confirmation",async()=>{
 const {readFileSync}=await import("node:fs");
 const {runInNewContext}=await import("node:vm");
 const source=readFileSync(new URL("../docs/bookings.mjs",import.meta.url),"utf8").replace(/^import[^\n]+\n/,"");
 const original=normalizeBooking(valid,"id-one");
 const other=normalizeBooking({...valid,reference:"BK-202"},"id-two");
 let stored=JSON.stringify([original,other]),writes=0,confirmAllowed=true,blockWrites=false;
 let input={...valid,notes:"My pending edit"};
 const elements=new Map(),listeners={};
 class Node {
  constructor(id){this.id=id;this.children=[];this.listeners={};this.dataset={};this.value="";this.textContent="";this.hidden=false;this.name="";this.type="text";}
  addEventListener(k,fn){this.listeners[k]=fn;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  scrollIntoView(){}
  reset(){}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Node(id));return elements.get(id)};
 el("booking-form").elements=Object.keys(valid).map(name=>{const item=new Node(name);item.name=name;item.type=typeof valid[name]==="boolean"?"checkbox":"text";return item});
 const document={documentElement:{},getElementById:el,querySelectorAll:()=>[],createElement:name=>new Node(name)};
 const localStorage={
  getItem:k=>k==="zarzour-bookings-v1"?stored:null,
  setItem:(k,value)=>{if(blockWrites)throw Error("storage blocked");if(k==="zarzour-bookings-v1"){stored=String(value);writes++}}
 };
 const window={confirm:()=>confirmAllowed,addEventListener:(key,fn)=>listeners[key]=fn};
 runInNewContext(source,{document,localStorage,window,navigator:{language:"en-US"},Date,Math,FormData:class{constructor(){return Object.entries(input)}},
  bookingMetrics,bookingReadiness,filterBookings,normalizeBooking,safeBookings,validateBooking,upsertBooking});
 const body=el("booking-body"),form=el("booking-form");
 body.listeners.click({target:{dataset:{editId:"id-one"}}});
 stored=JSON.stringify([{...original,notes:"Newer tab edit"},other]);
 const snapshot=stored;
 form.listeners.submit({preventDefault(){}});
 assert.equal(stored,snapshot,"stale form must never replace newer stored booking");
 assert.match(el("message").textContent,/another tab/);
 assert.equal(form.elements.find(x=>x.name==="notes").value,original.notes,"current form must not reset on conflict");
 // An edit remains open after a storage event and gets a visible conflict warning.
 listeners.storage({key:"zarzour-bookings-v1",storageArea:localStorage});
 assert.match(el("message").textContent,/another tab/);
 body.listeners.click({target:{dataset:{editId:"id-one"}}});
 form.listeners.submit({preventDefault(){}});
 assert.equal(JSON.parse(stored)[0].notes,"My pending edit","current snapshot saves valid edits");
 assert.equal(JSON.parse(stored).length,2);
 const saved=stored;
 confirmAllowed=false;
 body.listeners.click({target:{dataset:{id:"id-one"}}});
 assert.equal(stored,saved,"cancelled deletion changes nothing");
 confirmAllowed=true;
 stored=JSON.stringify([{...JSON.parse(saved)[0],notes:"Changed again"},other]);
 const newer=stored;
 body.listeners.click({target:{dataset:{id:"id-one"}}});
 assert.equal(stored,newer,"stale deletion must not remove a newer record");
 body.listeners.click({target:{dataset:{id:"id-one"}}});
 assert.equal(JSON.parse(stored).length,1,"current confirmed deletion removes exactly one record");
 assert.equal(JSON.parse(stored)[0].id,"id-two");
 assert.ok(writes>=2);
 blockWrites=true;
 input={...valid,reference:"BK-NEW",notes:"Keep input on failure"};
 form.listeners.submit({preventDefault(){}});
 assert.equal(JSON.parse(stored).length,1,"write failure must not mutate the register");
 assert.match(el("message").textContent,/Local storage failed/);
});

test("oversized stored booking IDs are excluded consistently with edit validation", () => {
  const good = normalizeBooking(valid, "valid-id");
  const oversized = normalizeBooking({ ...valid, reference: "BK-LONG" }, "x".repeat(121));
  const restored = safeBookings([oversized, good]);
  assert.deepEqual(restored, [good]);
  const attempted = upsertBooking([oversized], { ...valid, reference: "BK-NEW" }, "new-id");
  assert.deepEqual(attempted.errors, ["bookingStore"]);
  assert.equal(attempted.items[0], oversized);
  const accepted = upsertBooking(restored, { ...valid, reference: "BK-NEW" }, "new-id");
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.items.length, 2);
});

test("rejects noncanonical booking IDs in storage and writes", () => {
  const good = normalizeBooking(valid, "booking-good");
  const stored = [good];
  for (const id of [" booking-good", "booking-good ", "booking" + String.fromCharCode(10) + "line", "booking" + String.fromCharCode(0) + "null", "booking" + String.fromCharCode(9) + "part", "   "]) {
    const bad = { ...good, id, reference: "BK-OTHER" };
    assert.deepEqual(safeBookings([good, bad]), [good], JSON.stringify(id));
    const result = upsertBooking(stored, { ...valid, reference: "BK-OTHER" }, id);
    assert.deepEqual(result.errors, ["bookingId"], JSON.stringify(id));
    assert.strictEqual(result.items, stored);
  }
  const created = upsertBooking(stored, { ...valid, reference: "BK-OTHER" }, "booking-new");
  assert.deepEqual(created.errors, []);
  assert.equal(created.items.length, 2);
});

test("rejects control characters in supplier references before saving or restoring", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const character of ["\n", "\r", "\t", "\u0000", "\u007f"]) {
    const supplierReference = "SUP" + character + "88";
    const payload = { ...valid, reference: "BK-NEW", supplierReference };
    assert.ok(validateBooking(payload).includes("supplierReference"));
    const result = upsertBooking(before, payload, "new-id");
    assert.ok(result.errors.includes("supplierReference"));
    assert.strictEqual(result.items, before);
    const restored = safeBookings([{ ...before[0], supplierReference }]);
    assert.deepEqual(restored, []);
  }
  assert.deepEqual(validateBooking({ ...valid, supplierReference: "SUP-88/AB" }), []);
});

test("rejects non-string booking references and nonprimitive traveler values before coercion", () => {
  const before = [normalizeBooking(valid, "existing")];
  for (const reference of [123, ["BK-NEW"], { toString: null }, Symbol("BK-NEW")]) {
    const input = { ...valid, reference };
    assert.deepEqual(validateBooking(input), ["reference"]);
    const result = upsertBooking(before, input, "new-id");
    assert.deepEqual(result.errors, ["reference"]);
    assert.strictEqual(result.items, before);
    assert.deepEqual(safeBookings([{ ...before[0], reference }]), []);
  }
  for (const travelers of [{ valueOf: null, toString: null }, Symbol("4")]) {
    const input = { ...valid, reference: "BK-NEW", travelers };
    assert.deepEqual(validateBooking(input), ["travelers"]);
    const result = upsertBooking(before, input, "new-id");
    assert.deepEqual(result.errors, ["travelers"]);
    assert.strictEqual(result.items, before);
    assert.deepEqual(safeBookings([{ ...before[0], travelers }]), []);
  }
  assert.deepEqual(validateBooking({ ...valid, reference: " bk-new ", travelers: " 4 " }), []);
});
