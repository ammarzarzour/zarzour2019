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
