import test from "node:test";
import assert from "node:assert/strict";
import {leadFollowUp,filterLeads,leadMetrics,normalizeLead,safeLeads,upsertLead,validateLead} from "../docs/customers-model.mjs";

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

test("follow-up queue separates overdue, today, future and unscheduled open inquiries",()=>{
 const today="2099-03-02";
 const leads=[
 normalizeLead({...valid,followUp:"2099-03-01"},"late"),
 normalizeLead(valid,"today"),
 normalizeLead({...valid,followUp:"2099-03-03"},"future"),
 normalizeLead({...valid,followUp:""},"none"),
 normalizeLead({...valid,stage:"completed",followUp:"2099-03-01"},"closed"),
 normalizeLead({...valid,stage:"archived"},"archived")];
 for(const [followUp,id]of [["overdue","late"],["today","today"],["upcoming","future"],["unscheduled","none"]])
 assert.deepEqual(filterLeads(leads,{followUp,today}).map(x=>x.id),[id]);
 assert.equal(leadFollowUp(leads[4],today),"closed");assert.equal(leadFollowUp(leads[5],today),"closed");
 assert.equal(filterLeads(leads,{followUp:"overdue",today,stage:"completed"}).length,0);
 assert.equal(filterLeads(leads).length,6);
});

test("stale edits preserve changed and deleted records",()=>{
 const original=normalizeLead(valid,"a");
 for(const latest of [[{...original,notes:"Newer change"}],[]]){
 const result=upsertLead(latest,{...valid,notes:"Stale edit"},"a",original);
 assert.deepEqual(result.errors,["conflict"]);assert.strictEqual(result.items,latest);
 }
 const result=upsertLead([original],{...valid,notes:"Current edit"},"a",{...original});
 assert.deepEqual(result.errors,[]);assert.equal(result.items[0].notes,"Current edit");
});

import * as storageModel from "../docs/customers-model.mjs";
import {verifyStorageRetry} from "./form-storage-harness.mjs";
for(const editing of [false,true])test(`storage failure preserves ${editing?"edit":"new"} inputs and retry saves once`,()=>verifyStorageRetry("../docs/customers.mjs","leads",valid,storageModel,editing));
import vm from "node:vm";
import {readFileSync} from "node:fs";

test("inline stage changes preserve concurrent records and reject stale or unreadable storage",()=>{
 const source=readFileSync(new URL("../docs/customers.mjs",import.meta.url),"utf8");
 const listener=source.slice(source.indexOf('rows.addEventListener("change"'),source.indexOf('rows.addEventListener("click"'));
 const original={...valid,id:"one"},other={...valid,id:"two",reference:"REQ-205"};
 for(const scenario of ["success","changed","deleted","invalid","partial","writeFailure"]){
  let persisted=JSON.stringify(scenario==="changed"?[{...original,notes:"Newer edit"},other]:scenario==="deleted"?[other]:[original,other]);
  if(scenario==="invalid")persisted="{broken";
  if(scenario==="partial")persisted=JSON.stringify([original,{id:"bad"}]);
  const before=persisted;let handler,saves=0;
  const context=vm.createContext({...storageModel,leads:[original],lang:"en",storageKey:"test",
   rows:{addEventListener:(_,fn)=>handler=fn},localStorage:{getItem:()=>persisted},
   save:items=>{saves++;if(scenario==="writeFailure")return false;persisted=JSON.stringify(items);return true},
   show:()=>{},render:()=>{}});
  vm.runInContext(listener,context);
  handler({target:{dataset:{stageId:"one"},value:"qualified"}});
  if(scenario==="success"){assert.equal(JSON.parse(persisted)[0].stage,"qualified");assert.deepEqual(JSON.parse(persisted)[1],other)}
  else assert.equal(persisted,before,scenario+" must preserve storage");
  assert.equal(saves,["success","writeFailure"].includes(scenario)?1:0);
  if(scenario==="writeFailure")assert.equal(context.leads[0].stage,"inquiry");
 }
});
test("delete and undo preserve concurrent records, reject conflicts and survive failed writes",()=>{
 const source=readFileSync(new URL("../docs/customers.mjs",import.meta.url),"utf8");
 const listener=source.slice(source.indexOf('rows.addEventListener("click"'),source.indexOf('\nfor(const id of ["search"'));
 const original={...valid,id:"one"},other={...valid,id:"two",reference:"REQ-205"};
 const make=(saved,fail=false)=>{
  let persisted=saved,handler,undo,resets=0;
  const context=vm.createContext({...storageModel,leads:[original],editingId:"one",editingSnapshot:original,deleted:null,lang:"en",storageKey:"test",
   rows:{addEventListener:(_,fn)=>handler=fn},form:{reset:()=>resets++},
   localStorage:{getItem:()=>persisted},document:{getElementById:()=>({}),createElement:()=>({})},
   message:{append:button=>undo=button},show:()=>{},render:()=>{},
   save:items=>{if(fail)return false;persisted=JSON.stringify(items);return true}});
  vm.runInContext(listener,context);
  return {remove:()=>handler({target:{dataset:{deleteId:"one"}}}),undo:()=>undo.onclick(),read:()=>persisted,
   write:value=>persisted=value,fail:value=>fail=value,context,resets:()=>resets};
 };
 for(const saved of [JSON.stringify([{...original,notes:"New edit"},other]),JSON.stringify([other]),"{bad",JSON.stringify([original,{id:"bad"}])]){
  const app=make(saved);app.remove();assert.equal(app.read(),saved);assert.equal(app.resets(),0);assert.equal(app.context.deleted,null);
 }
 const failed=make(JSON.stringify([original,other]),true);failed.remove();
 assert.equal(failed.context.editingId,"one");assert.equal(failed.resets(),0);assert.equal(failed.context.deleted,null);
 const app=make(JSON.stringify([original,other]));app.remove();
 assert.deepEqual(JSON.parse(app.read()),[other]);assert.equal(app.resets(),1);
 const third={...valid,id:"three",reference:"REQ-206"};
 for(const conflict of [{...original,notes:"Recreated"}, {...original,id:"new-id"}]){
  const saved=JSON.stringify([other,conflict]);app.write(saved);app.undo();assert.equal(app.read(),saved);assert.ok(app.context.deleted);
 }
 app.write(JSON.stringify([other,third]));app.fail(true);app.undo();
 assert.deepEqual(JSON.parse(app.read()),[other,third]);assert.ok(app.context.deleted);
 app.fail(false);app.undo();assert.deepEqual(JSON.parse(app.read()),[original,other,third]);assert.equal(app.context.deleted,null);
});
