import test from "node:test";
import assert from "node:assert/strict";
import {filterLeads,leadMetrics,normalizeLead,safeLeads,validateLead} from "../docs/customers-model.mjs";

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
