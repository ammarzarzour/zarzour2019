import test from "node:test";import assert from "node:assert/strict";import {deliveryReadiness,filterProjects,localToday,normalizeProject,projectMetrics,safeProjects,upsertProject,validateProject,exportProjectBackup,importProjectBackup,PROJECT_BACKUP_MAX_BYTES,PROJECT_BACKUP_MAX_ITEMS, mergeProjectBackup } from "../docs/soft/projects-model.mjs";
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
 const listener=source.slice(source.indexOf('if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("storage"'),source.indexOf("// Explicit, local-only handoff"));
 assert.ok(listener.startsWith('if(typeof window'));
 const original=normalizeProject(valid,"one"),updated={...original,notes:"Other tab update"};
 let callback,renders=0,writes=0,languageUpdates=0,notices=[],items=[original],editingId="one";
 const context=vm.createContext({...storageModel,key:"soft-register",languageKey:"soft-language",lang:"en",items,editingId,
   window:{addEventListener:(name,fn)=>{assert.equal(name,"storage");callback=fn}},
   applyLanguage:()=>{languageUpdates++;renders++},render:()=>renders++,show:(message,error)=>notices.push({message,error}),save:()=>writes++});
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
 assert.equal(context.items.length,0);assert.equal(renders,3);assert.equal(writes,0);
 assert.equal(context.lang,"ar","clearing storage must reset the language preference safely");
 assert.equal(languageUpdates,1);
 callback({key:"soft-language",newValue:"en"});
 assert.equal(context.lang,"en","language events must synchronize other browser tabs");
 assert.equal(languageUpdates,2);assert.equal(renders,4);assert.equal(writes,0,"language sync must not echo writes");
 callback({key:"unrelated",newValue:"ar"});
 assert.equal(context.lang,"en");assert.equal(renders,4);
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


test("portable Soft JSON backup roundtrips strict versioned project data",()=>{
 const first=normalizeProject(valid,"soft-1");
 const second=normalizeProject({...valid,reference:"SOFT-102",notes:"ملاحظات بالعربية"},"soft-2");
 const stamp="2026-11-23T12:30:45.000Z";
 const data=exportProjectBackup([first,second],stamp);
 const json=JSON.parse(data);
 assert.equal(json.schema,"zarzour-soft-projects");
 assert.equal(json.version,1);
 assert.equal(json.exportedAt,stamp);
 assert.deepEqual(json.projects,[first,second]);
 assert.deepEqual(importProjectBackup(data),[first,second]);
 assert.notStrictEqual(importProjectBackup(data)[0],first);
 assert.equal(data,exportProjectBackup([first,second],stamp),"identical data and timestamp produce identical backups");
});

test("project backup rejects malformed, duplicated, oversized and untrusted schemas",()=>{
 const one=normalizeProject(valid,"p1");
 const good=JSON.parse(exportProjectBackup([one],"2026-11-23T12:30:45.000Z"));
 const cases=[
  "",null,"{",JSON.stringify(null),JSON.stringify([]),JSON.stringify({...good,schema:"zarzour-travel-bookings"}),
  JSON.stringify({...good,version:2}),JSON.stringify({...good,projects:[]}),
  JSON.stringify({...good,projects:[one,{...one,id:"p2"}]}),
  JSON.stringify({...good,projects:[one,{...one,id:"p2",reference:"soft-101"}]}),
  JSON.stringify({...good,projects:[{id:"bad"}]}),JSON.stringify({...good,extra:"secrets"}),
  JSON.stringify({...good,projects:Array.from({length:PROJECT_BACKUP_MAX_ITEMS+1},(_,i)=>({...one,id:"id-"+i,reference:"SOFT-"+i}))}),
  JSON.stringify({...good,projects:[{...one,notes:"😀".repeat(PROJECT_BACKUP_MAX_BYTES/2)}]})
 ];
 for(const source of cases)assert.throws(()=>importProjectBackup(source),Error);
 assert.throws(()=>exportProjectBackup([{...one},{...one,id:"p2"}]),/Invalid project register/);
 assert.throws(()=>exportProjectBackup(Array.from({length:PROJECT_BACKUP_MAX_ITEMS+1},(_,i)=>({...one,id:"s-"+i,reference:"SOFT-"+i}))),/Invalid project register/);
 assert.throws(()=>exportProjectBackup([one],"not-a-date"),/timestamp/);
});

test("Soft backup controls import only after user confirmation and reject conflicting browser writes",async()=>{
 const html=readFileSync(new URL("../docs/soft/projects.html",import.meta.url),"utf8");
 assert.match(html,/id="export-projects"[^>]*data-ar=/);
 assert.match(html,/id="import-projects"[^>]*data-ar=/);
 assert.match(html,/id="import-project-file"[^>]*type="file"/);
 const source=readFileSync(new URL("../docs/soft/projects.mjs",import.meta.url),"utf8");
 const tail=source.slice(source.indexOf("// Explicit, local-only handoff"));
 assert.ok(tail.startsWith("// Explicit, local-only handoff"));
 const first=normalizeProject(valid,"id-one");
 const restored=normalizeProject({...valid,reference:"SOFT-102",notes:"A portable release"},"id-two");
 const backup=exportProjectBackup([restored],"2026-11-23T12:30:45.000Z");
 const listeners={},notifications=[],buttons={};
 let stored=JSON.stringify([first]),writes=0,confirmed=false,editCancelled=0,renders=0,clicks=0,revokeCount=0;
 const input={value:"",files:[{size:new TextEncoder().encode(backup).byteLength,text:async()=>backup}],click(){clicks++},addEventListener(kind,fn){listeners["file-"+kind]=fn}};
 const document={
  getElementById:id=>{
   if(id==="import-project-file")return input;
   return buttons[id]||(buttons[id]={addEventListener:(kind,fn)=>{listeners[id+"-"+kind]=fn}});
  },
  createElement:()=>({click(){clicks++},remove(){}}),
  body:{append(){}}
 };
 const localStorage={getItem:key=>key==="zarzour-soft-projects-v1"?stored:null,
  setItem:(key,value)=>{assert.equal(key,"zarzour-soft-projects-v1");stored=value;writes++}};
 const context=vm.createContext({document,localStorage,lang:"en",key:"zarzour-soft-projects-v1",items:[first],editingId:"id-one",
  exportProjectBackup,importProjectBackup,PROJECT_BACKUP_MAX_BYTES,localToday,Date,Blob,URL:{createObjectURL:()=> "blob:local",revokeObjectURL:()=>revokeCount++},
  safeProjects,mergeProjectBackup,render:()=>renders++,cancelEdit:()=>editCancelled++,show:(text,error)=>notifications.push({text,error}),
  window:{confirm:()=>confirmed},save:next=>{localStorage.setItem("zarzour-soft-projects-v1",JSON.stringify(next));return true}});
 vm.runInContext(tail,context);
 listeners["import-projects-click"]();
 assert.equal(clicks,1,"button opens local JSON file picker");
 await listeners["file-change"]();
 assert.equal(writes,0,"cancelled confirmation must never overwrite current projects");
 assert.equal(input.value,"","file picker clears after cancellation");
 confirmed=true;
 await listeners["file-change"]();
 assert.equal(writes,1);
 assert.deepEqual(JSON.parse(stored),[restored]);
 assert.equal(context.items[0].id,"id-two");
 assert.equal(editCancelled,1);
 assert.equal(renders,1);
 assert.match(notifications.at(-1).text,/Imported 1 verified/);
 listeners["export-projects-click"]();
 assert.equal(revokeCount,1);
 assert.equal(clicks,2,"export is a local file download");
 assert.match(notifications.at(-1).text,/no data was sent/);
 // Storage is changed while the confirm dialogue is open: refuse replacement.
 const modified=JSON.stringify([{...restored,notes:"Newer tab edit"}]);
 context.window.confirm=()=>{stored=modified;return true};
 await listeners["file-change"]();
 assert.equal(stored,modified);
 assert.equal(writes,1);
 assert.match(notifications.at(-1).text,/another tab/);
 // Non-destructive migration has its own explicit action.
 stored=JSON.stringify([first]);context.window.confirm=()=>false;
 listeners["merge-projects-click"]();
 await listeners["file-change"]();
 assert.deepEqual(JSON.parse(stored),[first]);
 assert.equal(writes,1);
 context.window.confirm=()=>true;
 listeners["merge-projects-click"]();
 await listeners["file-change"]();
 assert.deepEqual(JSON.parse(stored),[first,restored]);
 assert.equal(writes,2);
 listeners["merge-projects-click"]();
 await listeners["file-change"]();
 assert.equal(writes,2);
 assert.match(notifications.at(-1).text,/No new projects/);
});

test("invalid Soft project backup never changes local records",async()=>{
 const source=readFileSync(new URL("../docs/soft/projects.mjs",import.meta.url),"utf8");
 const tail=source.slice(source.indexOf("// Explicit, local-only handoff"));
 const first=normalizeProject(valid,"old");
 const stored=JSON.stringify([first]);
 let writes=0,confirmations=0,notices=[];
 const listeners={},file={value:"selected",files:[{size:42,text:async()=>"{bad-json"}],click(){},addEventListener:(kind,fn)=>listeners[kind]=fn};
 const document={getElementById:id=>id==="import-project-file"?file:{addEventListener(){}},body:{append(){}},createElement:()=>({click(){},remove(){}})};
 const context=vm.createContext({document,localStorage:{getItem:()=>stored,setItem:()=>writes++},lang:"en",key:"zarzour-soft-projects-v1",items:[first],editingId:null,
  exportProjectBackup,importProjectBackup,PROJECT_BACKUP_MAX_BYTES,localToday,Date,Blob,URL,
  safeProjects,render:()=>{},cancelEdit:()=>{},show:(text,error)=>notices.push({text,error}),
  window:{confirm:()=>{confirmations++;return true}},save:()=>{writes++;return true}});
 vm.runInContext(tail,context);
 await listeners.change();
 assert.equal(writes,0);
 assert.equal(confirmations,0);
 assert.match(notices[0].text,/invalid/);
 file.files=[{size:PROJECT_BACKUP_MAX_BYTES+1,text:async()=>{throw Error("Should not read oversize file")}}];
 await listeners.change();
 assert.equal(writes,0);
 assert.equal(confirmations,0);
 assert.equal(file.value,"");
});

test("non-destructive Soft migration merges new records, skips identical copies and rejects conflicts",()=>{
 const a=normalizeProject(valid,"merge-a"),b=normalizeProject({...valid,reference:"SOFT-MERGE-B"},"merge-b");
 const original=Object.freeze([Object.freeze(a)]);
 const merged=mergeProjectBackup(original,[a,b]);
 assert.deepEqual(merged,{items:[a,b],added:1,skipped:1});
 assert.deepEqual(original,[a]);
 assert.deepEqual(mergeProjectBackup([], [b]),{items:[b],added:1,skipped:0});
 assert.deepEqual(mergeProjectBackup(original,[a]),{items:[a],added:0,skipped:1});
 assert.throws(()=>mergeProjectBackup(original,[{...a,notes:"different"}]),/conflict/);
 assert.throws(()=>mergeProjectBackup(original,[{...a,id:"different"}]),/conflict/);
 assert.throws(()=>mergeProjectBackup(original,[{...a,reference:"SOFT-OTHER"}]),/conflict/);
 assert.throws(()=>mergeProjectBackup(original,[b,{...a,notes:"different"}]),/conflict/);
 assert.throws(()=>mergeProjectBackup(original,[]),/Invalid project register/);
 assert.deepEqual(importProjectBackup(exportProjectBackup(merged.items,"2026-11-28T12:00:00.000Z")),[a,b]);
 assert.deepEqual(original,[a]);
});
