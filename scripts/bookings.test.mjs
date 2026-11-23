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
