import test from "node:test";import assert from "node:assert/strict";import {deliveryReadiness,filterProjects,normalizeProject,projectMetrics,safeProjects,upsertProject,validateProject} from "../docs/soft/projects-model.mjs";
const valid={reference:"SOFT-101",type:"website",stage:"build",status:"active",targetDate:"2099-03-01",tasksTotal:"12",tasksDone:"7",acceptanceReady:"on",securityReviewed:"on",bilingualReviewed:"on",notes:"Synthetic independent software project"};
test("validates and normalizes an independent software project",()=>{assert.deepEqual(validateProject(valid),[]);const item=normalizeProject(valid,"p");assert.equal(item.tasksTotal,12);assert.equal(item.tasksDone,7);assert.equal(item.securityReviewed,true)});
test("rejects invalid enums, dates and task counts",()=>{assert.deepEqual(validateProject({...valid,reference:"",type:"travel",stage:"payment",status:"unknown",targetDate:"2099-02-30",tasksTotal:"0",tasksDone:"13",notes:"x".repeat(241)}),["reference","type","stage","status","targetDate","tasksTotal","tasksDone","notes"])});
test("requires acceptance, security, bilingual review and complete tasks",()=>{assert.deepEqual(deliveryReadiness(normalizeProject({...valid,tasksDone:"12"},"ok")),{blockers:[],score:100});assert.deepEqual(deliveryReadiness(normalizeProject({...valid,securityReviewed:false},"b")),{blockers:["securityReviewed","tasksComplete"],score:50})});
test("restores unique valid projects only",()=>{const one=normalizeProject(valid,"same"),other={...one,id:"other"};assert.deepEqual(safeProjects([null,{...one,id:" "},one,{...one,reference:"duplicate"},other]).map(x=>x.id),["same","other"])});
test("calculates delivery health and aggregate progress",()=>{const items=[normalizeProject({...valid,targetDate:"2099-01-01",tasksTotal:"10",tasksDone:"5"},"a"),normalizeProject({...valid,status:"blocked",targetDate:"2099-01-05",tasksTotal:"10",tasksDone:"5"},"b"),normalizeProject({...valid,stage:"release",status:"completed",tasksTotal:"10",tasksDone:"10"},"c")];assert.deepEqual(projectMetrics(items,"2099-01-02"),{total:3,active:1,blocked:1,overdue:1,dueSoon:1,releaseReady:1,progress:67})});
test("filters projects by reference, note, type and status",()=>{const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"APP-2",type:"mobile_app",status:"blocked",notes:"Bilingual mobile release"},"b")];assert.deepEqual(filterProjects(items,{query:"mobile",type:"mobile_app",status:"blocked"}).map(x=>x.id),["b"])});

test("updates project stages and progress without adding duplicate records",()=>{
 const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"SOFT-102"},"b")];
 const result=upsertProject(items,{...valid,stage:"validation",tasksDone:"10"},"a");
 assert.deepEqual(result.errors,[]);assert.equal(result.items.length,2);assert.equal(result.items[0].tasksDone,10);assert.equal(result.items[0].stage,"validation");
 assert.equal(items[0].tasksDone,7);assert.strictEqual(result.items[1],items[1]);
});
test("rejects duplicate references on add and edit, allows own reference",()=>{
 const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"SOFT-102"},"b")];
 for(const id of ["new","b"]){const result=upsertProject(items,{...valid,reference:" soft-101 "},id);assert.deepEqual(result.errors,["duplicateReference"]);assert.strictEqual(result.items,items)}
 assert.deepEqual(upsertProject(items,valid,"a").errors,[]);
});
test("editing cannot bypass delivery readiness or invalid task counts",()=>{
 const items=[normalizeProject(valid,"a")];
 assert.deepEqual(upsertProject(items,{...valid,status:"completed"},"a").errors,["readiness"]);
 assert.deepEqual(upsertProject(items,{...valid,tasksDone:"13"},"a").errors,["tasksDone"]);
 const result=upsertProject(items,{...valid,status:"completed",tasksDone:"12"},"a");
 assert.deepEqual(result.errors,[]);assert.equal(result.items[0].status,"completed");
});

test("task counters reject values that only coerce to numbers",()=>{
 for(const value of [null,true,false,[],[1],{}, "", " ", "01", "1e2","0x10","+2"," 2"]){
 assert.ok(validateProject({...valid,tasksTotal:value}).includes("tasksTotal"));
 assert.ok(validateProject({...valid,tasksDone:value}).includes("tasksDone"));
 }
 assert.deepEqual(validateProject({...valid,tasksTotal:"12",tasksDone:"0"}),[]);
});

test("stale edits preserve changed and deleted records",()=>{
 const original=normalizeProject(valid,"a");
 for(const latest of [[{...original,notes:"Newer change"}],[]]){
 const result=upsertProject(latest,{...valid,notes:"Stale edit"},"a",original);
 assert.deepEqual(result.errors,["conflict"]);assert.strictEqual(result.items,latest);
 }
 const result=upsertProject([original],{...valid,notes:"Current edit"},"a",{...original});
 assert.deepEqual(result.errors,[]);assert.equal(result.items[0].notes,"Current edit");
});

import * as storageModel from "../docs/soft/projects-model.mjs";
import {verifyStorageRetry} from "./form-storage-harness.mjs";
for(const editing of [false,true])test(`storage failure preserves ${editing?"edit":"new"} inputs and retry saves once`,()=>verifyStorageRetry("../docs/soft/projects.mjs","items",valid,storageModel,editing));
import vm from "node:vm";
import {readFileSync} from "node:fs";

test("row actions preserve newer projects and edit forms on conflict or storage failure",()=>{
 const source=readFileSync(new URL("../docs/soft/projects.mjs",import.meta.url),"utf8");
 const listeners=source.slice(source.indexOf('rows.addEventListener("change"'),source.indexOf(';for(const id of ["search"'));
 const original=normalizeProject(valid,"one"),other=normalizeProject({...valid,reference:"SOFT-102"},"two");
 for(const action of ["status","delete"])for(const scenario of ["success","changed","deleted","invalid","partial","writeFailure","completionBlocked"]){
  let stored=JSON.stringify(scenario==="changed"?[{...original,notes:"Newer edit"},other]:scenario==="deleted"?[other]:[original,other]);
  if(scenario==="invalid")stored="{bad";
  if(scenario==="partial")stored=JSON.stringify([original,{id:"bad"}]);
  const before=stored,handlers={};let cancelled=0,saves=0;
  const context=vm.createContext({...storageModel,items:[original],editingId:"one",editingSnapshot:original,key:"soft",lang:"en",
   rows:{addEventListener:(event,fn)=>handlers[event]=fn},localStorage:{getItem:()=>stored},
   save:items=>{saves++;if(scenario==="writeFailure")return false;stored=JSON.stringify(items);return true},
   show:()=>{},render:()=>{},cancelEdit:()=>cancelled++});
  vm.runInContext(listeners,context);
  const status=scenario==="completionBlocked"?"completed":"blocked";
  if(action==="delete")handlers.click({target:{dataset:{deleteId:"one"}}});
  else handlers.change({target:{dataset:{statusId:"one"},value:status}});
  const success=scenario==="success"||(action==="delete"&&scenario==="completionBlocked");
  if(success){const saved=JSON.parse(stored);assert.deepEqual(saved.find(x=>x.id==="two"),other);assert.equal(saved.length,action==="delete"?1:2);if(action==="status")assert.equal(saved[0].status,"blocked")}
  else assert.equal(stored,before,action+" "+scenario+" must preserve saved data");
  assert.equal(cancelled,success&&action==="delete"?1:0,"form must survive rejected deletion");
  if(scenario==="writeFailure"){assert.equal(saves,1);assert.equal(context.items[0].status,"active")}
 }
});
