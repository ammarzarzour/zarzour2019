import test from "node:test";
import assert from "node:assert/strict";
import {filterLeads,leadMetrics,normalizeLead,safeLeads,upsertLead,validateLead} from "../docs/customers-model.mjs";

const valid={reference:"REQ-204",service:"umrah",source:"website",stage:"inquiry",followUp:"2099-03-02",notes:"Synthetic test record"};

test("validates and normalizes a non-personal inquiry",()=>{
  assert.deepEqual(validateLead(valid),[]);
  assert.deepEqual(normalizeLead({...valid,reference:" REQ-204 ",notes:" test "},"x"),{...valid,id:"x",notes:"test"});
});

test("rejects invalid enumerations, dates and oversized notes",()=>{
  assert.deepEqual(validateLead({...valid,reference:"",service:"payment",source:"unknown",stage:"lost",followUp:"2099-02-30",notes:"x".repeat(241)}),["reference","service","source","stage","followUp","notes"]);
});

test("restores only valid unique stored records",()=>{
  const one=normalizeLead(valid,"same"),duplicate={...one,reference:"other"},other={...one,id:"other"};
  assert.deepEqual(safeLeads([null,{...one,id:" "},one,duplicate,other]).map(item=>item.id),["same","other"]);
});

test("calculates follow-up and pipeline metrics without financial data",()=>{
  const leads=[normalizeLead({...valid,followUp:"2099-03-01"},"a"),normalizeLead({...valid,stage:"documents",followUp:"2099-03-02"},"b"),normalizeLead({...valid,stage:"booked",followUp:""},"c"),normalizeLead({...valid,stage:"completed",followUp:"2099-01-01"},"d")];
  assert.deepEqual(leadMetrics(leads,"2099-03-02"),{total:4,active:3,documents:1,booked:1,completed:1,overdue:1,dueToday:1});
});

test("filters by reference, notes, service and stage",()=>{
  const leads=[normalizeLead(valid,"a"),normalizeLead({...valid,reference:"TOUR-1",service:"tourism",stage:"qualified",notes:"Damascus itinerary"},"b")];
  assert.deepEqual(filterLeads(leads,{query:"dam",service:"tourism",stage:"qualified"}).map(item=>item.id),["b"]);
  assert.equal(filterLeads(leads,{query:"missing"}).length,0);
});

test("edits preserve identity and order without mutating saved records",()=>{
 const original=[normalizeLead(valid,"a"),normalizeLead({...valid,reference:"REQ-205"},"b")];
 const result=upsertLead(original,{...valid,stage:"qualified",followUp:"2099-04-01"},"a");
 assert.deepEqual(result.errors,[]);
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].stage,"qualified");
 assert.equal(result.items[0].followUp,"2099-04-01");
 assert.equal(original[0].stage,"inquiry");
 assert.strictEqual(result.items[1],original[1]);
});
test("rejects duplicate references on creation and edit, allows own reference",()=>{
 const items=[normalizeLead(valid,"a"),normalizeLead({...valid,reference:"REQ-205"},"b")];
 for(const id of ["new","b"]){
  const result=upsertLead(items,{...valid,reference:" req-204 "},id);
  assert.deepEqual(result.errors,["duplicateReference"]);assert.strictEqual(result.items,items);
 }
 assert.deepEqual(upsertLead(items,{...valid,reference:" req-204 "},"a").errors,[]);
 assert.equal(upsertLead(items,{...valid,reference:"REQ-206"},"new").items.length,3);
});
test("invalid edits leave original records intact",()=>{
 const items=[normalizeLead(valid,"a")];
 const result=upsertLead(items,{...valid,followUp:"2099-02-30"},"a");
 assert.deepEqual(result.errors,["followUp"]);assert.strictEqual(result.items,items);
});
