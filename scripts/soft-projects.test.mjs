import test from "node:test";import assert from "node:assert/strict";import {deliveryReadiness,filterProjects,localToday,normalizeProject,projectMetrics,safeProjects,upsertProject,validateProject} from "../docs/soft/projects-model.mjs";
const valid={reference:"SOFT-101",type:"website",stage:"build",status:"active",targetDate:"2099-03-01",tasksTotal:"12",tasksDone:"7",acceptanceReady:"on",securityReviewed:"on",bilingualReviewed:"on",notes:"Synthetic independent software project"};
test("deadline calendar uses local date and rolls forward without a stale UTC day",()=>{
 const before=new Date(2026,10,17,23,59,59),after=new Date(2026,10,18,0,0,1);
 assert.equal(localToday(before),"2026-11-17");
 assert.equal(localToday(after),"2026-11-18");
 const item=normalizeProject({...valid,targetDate:"2026-11-17"},"deadline");
 assert.equal(projectMetrics([item],localToday(before)).overdue,0);
 assert.equal(projectMetrics([item],localToday(after)).overdue,1);
});
test("validates and normalizes an independent software project",()=>{assert.deepEqual(validateProject(valid),[]);const item=normalizeProject(valid,"p");assert.equal(item.tasksTotal,12);assert.equal(item.tasksDone,7);assert.equal(item.securityReviewed,true)});
test("rejects invalid enums, dates and task counts",()=>{assert.deepEqual(validateProject({...valid,reference:"",type:"travel",stage:"payment",status:"unknown",targetDate:"2099-02-30",tasksTotal:"0",tasksDone:"13",notes:"x".repeat(241)}),["reference","type","stage","status","targetDate","tasksTotal","tasksDone","notes"])});
test("requires acceptance, security, bilingual review and complete tasks",()=>{assert.deepEqual(deliveryReadiness(normalizeProject({...valid,tasksDone:"12"},"ok")),{blockers:[],score:100});assert.deepEqual(deliveryReadiness(normalizeProject({...valid,securityReviewed:false},"b")),{blockers:["securityReviewed","tasksComplete"],score:50})});
test("restores unique valid projects only",()=>{const one=normalizeProject(valid,"same"),other={...one,id:"other",reference:"SOFT-102"};assert.deepEqual(safeProjects([null,{...one,id:" "},one,{...one,reference:"duplicate"},other]).map(x=>x.id),["same","other"])});
test("restored registers reject duplicate references after trimming and case folding",()=>{
 const first=normalizeProject(valid,"first");
 const collision=normalizeProject({...valid,reference:" soft-101 "},"second");
 const unique=normalizeProject({...valid,reference:"SOFT-102"},"third");
 assert.deepEqual(safeProjects([first,collision,unique]).map(x=>x.id),["first","third"]);
 assert.deepEqual(safeProjects([collision,first]).map(x=>x.id),["second"]);
});
test("incomplete restored completed projects remain saved but count as open",()=>{
 const ready=normalizeProject({...valid,status:"completed",tasksDone:"12",targetDate:"2099-01-01",reference:"SOFT-103"},"ready");
 const incomplete=normalizeProject({...valid,status:"completed",tasksDone:"7",targetDate:"2099-01-01"},"incomplete");
 const unreviewed=normalizeProject({...valid,status:"completed",tasksDone:"12",securityReviewed:false,targetDate:"2099-01-04",reference:"SOFT-102"},"unreviewed");
 const restored=safeProjects([incomplete,unreviewed,ready]);
 assert.deepEqual(restored.map(x=>x.id),["incomplete","unreviewed","ready"]);
 const metrics=projectMetrics(restored,"2099-01-02");
 assert.equal(metrics.overdue,1);
 assert.equal(metrics.dueSoon,1);
 assert.equal(metrics.releaseReady,0);
});
test("calculates delivery health and aggregate progress",()=>{const items=[normalizeProject({...valid,targetDate:"2099-01-01",tasksTotal:"10",tasksDone:"5"},"a"),normalizeProject({...valid,status:"blocked",targetDate:"2099-01-05",tasksTotal:"10",tasksDone:"5"},"b"),normalizeProject({...valid,stage:"release",status:"completed",tasksTotal:"10",tasksDone:"10"},"c")];assert.deepEqual(projectMetrics(items,"2099-01-02"),{total:3,active:1,blocked:1,overdue:1,dueSoon:1,releaseReady:1,progress:67})});
test("filters projects by reference, note, type and status",()=>{const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"APP-2",type:"mobile_app",status:"blocked",notes:"Bilingual mobile release"},"b")];assert.deepEqual(filterProjects(items,{query:"mobile",type:"mobile_app",status:"blocked"}).map(x=>x.id),["b"])});

test("updates project stages and progress without adding duplicate records",()=>{
 const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"SOFT-102"},"b")];
 const result=upsertProject(items,{...valid,stage:"validation",tasksDone:"10"},"a",items[0]);
 assert.deepEqual(result.errors,[]);assert.equal(result.items.length,2);assert.equal(result.items[0].tasksDone,10);assert.equal(result.items[0].stage,"validation");
 assert.equal(items[0].tasksDone,7);assert.strictEqual(result.items[1],items[1]);
});
test("rejects duplicate references on add and edit, allows own reference",()=>{
 const items=[normalizeProject(valid,"a"),normalizeProject({...valid,reference:"SOFT-102"},"b")];
 for(const id of ["new","b"]){const result=upsertProject(items,{...valid,reference:" soft-101 "},id,id==="b"?items[1]:undefined);assert.deepEqual(result.errors,["duplicateReference"]);assert.strictEqual(result.items,items)}
 assert.deepEqual(upsertProject(items,valid,"a",items[0]).errors,[]);
});
test("editing cannot bypass delivery readiness or invalid task counts",()=>{
 const items=[normalizeProject(valid,"a")];
 assert.deepEqual(upsertProject(items,{...valid,status:"completed"},"a",items[0]).errors,["readiness"]);
 assert.deepEqual(upsertProject(items,{...valid,tasksDone:"13"},"a",items[0]).errors,["tasksDone"]);
 const result=upsertProject(items,{...valid,status:"completed",tasksDone:"12"},"a",items[0]);
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
   rows:{addEventListener:(event,fn)=>handlers[event]=fn},window:{confirm:()=>true},localStorage:{getItem:()=>stored},
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

test("cross-tab storage events refresh the board without writes or lost edit inputs",()=>{
 const source=readFileSync(new URL("../docs/soft/projects.mjs",import.meta.url),"utf8");
 const listener=source.slice(source.indexOf('if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("storage"'));
 assert.ok(listener.startsWith('if(typeof window'));
 const original=normalizeProject(valid,"one"),updated={...original,notes:"Other tab update"};
 let callback,renders=0,writes=0,notices=[],items=[original],editingId="one";
 const context=vm.createContext({...storageModel,key:"soft-register",lang:"en",items,editingId,
   window:{addEventListener:(name,fn)=>{assert.equal(name,"storage");callback=fn}},
   render:()=>renders++,show:(message,error)=>notices.push({message,error}),save:()=>writes++});
 vm.runInContext(listener,context);
 callback({key:"unrelated",newValue:"[]"});
 assert.equal(renders,0);
 callback({key:"soft-register",newValue:JSON.stringify([updated])});
 assert.equal(renders,1);assert.equal(context.items[0].notes,"Other tab update");
 assert.equal(context.editingId,"one");assert.equal(writes,0);
 assert.match(notices.at(-1).message,/another tab/);
 callback({key:"soft-register",newValue:"{invalid"});
 assert.equal(context.items[0].notes,"Other tab update");assert.equal(renders,1);
 callback({key:"soft-register",newValue:JSON.stringify([updated,{id:"bad"}])});
 assert.equal(context.items.length,1);assert.equal(renders,1);
 callback({key:null,newValue:null});
 assert.equal(context.items.length,0);assert.equal(renders,2);assert.equal(writes,0);
});

test("deleting incomplete historical completed records checks the latest row without requiring release readiness",()=>{
 const source=readFileSync(new URL("../docs/soft/projects.mjs",import.meta.url),"utf8");
 const listeners=source.slice(source.indexOf('rows.addEventListener("change"'),source.indexOf(';for(const id of ["search"'));
 const legacy=normalizeProject({...valid,status:"completed",tasksDone:"7"},"legacy");
 const newer={...legacy,notes:"Edited in another tab"};
 for(const scenario of ["unchanged","changed","deleted","storageFailure"]){
  let stored=JSON.stringify(scenario==="changed"?[newer]:scenario==="deleted"?[]:[legacy]);
  const before=stored,handlers={};let notices=[],cancelled=0;
  const context=vm.createContext({...storageModel,items:[legacy],editingId:"legacy",editingSnapshot:legacy,key:"soft",lang:"en",
   rows:{addEventListener:(event,fn)=>handlers[event]=fn},window:{confirm:()=>true},localStorage:{getItem:()=>stored},
   save:next=>{if(scenario==="storageFailure")return false;stored=JSON.stringify(next);return true},
   show:message=>notices.push(message),render:()=>{},cancelEdit:()=>cancelled++});
  vm.runInContext(listeners,context);
  handlers.click({target:{dataset:{deleteId:"legacy"}}});
  if(scenario==="unchanged"){assert.deepEqual(JSON.parse(stored),[]);assert.equal(cancelled,1)}
  else{assert.equal(stored,before);assert.equal(cancelled,0);assert.ok(notices.length)}
 }
});
