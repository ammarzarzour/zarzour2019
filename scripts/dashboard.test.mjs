import test from "node:test";
import assert from "node:assert/strict";

test("preserves storage failures through summary and forces attention", () => {
 const result = summarizeModules([{id:"contracts",href:"contracts.html",total:0,alerts:0,ready:9,unavailable:true}]);
 assert.equal(result.modules[0].unavailable,true);
 assert.equal(result.modules[0].health,"attention");
 assert.equal(result.totals.alerts,1);
 assert.equal(result.totals.ready,0);
});
test("does not treat string failure flags as storage errors", () => {
 const result=normalizeSnapshot({id:"contracts",href:"contracts.html",total:1,alerts:0,ready:1,unavailable:"false"});
 assert.equal(Object.hasOwn(result,"unavailable"),false);
 assert.equal(result.ready,1);
});
import { moduleHealth, normalizeSnapshot, summarizeModules, contractSnapshot, readDashboardModule } from "../docs/dashboard-model.mjs";

test("normalizes positive integer counters and rejects unsafe links", () => {
  assert.deepEqual(normalizeSnapshot({ id: "customers", total: "4.9", alerts: -3, ready: 2, href: "https://bad.example/" }), { id: "customers", total: 4, alerts: 0, ready: 2, href: "#" });
});

test("rejects unknown modules", () => assert.equal(normalizeSnapshot({ id: "soft-projects" }), null));

test("marks attention before active and empty", () => {
  assert.equal(moduleHealth({ total: 4, alerts: 1 }), "attention");
  assert.equal(moduleHealth({ total: 4, alerts: 0 }), "active");
  assert.equal(moduleHealth({ total: 0, alerts: 0 }), "empty");
});

test("summarizes, deduplicates and prioritizes alerts", () => {
  const result = summarizeModules([
    { id: "customers", total: 5, alerts: 1, ready: 2, href: "customers.html" },
    { id: "operations", total: 2, alerts: 3, ready: 1, href: "operations.html" },
    { id: "customers", total: 99, alerts: 99, ready: 99, href: "customers.html" },
    { id: "directory", total: 0, alerts: 0, ready: 0, href: "directory.html" }
  ]);
  assert.deepEqual(result.totals, { modules: 3, active: 2, records: 7, alerts: 4, ready: 3 });
  assert.deepEqual(result.modules.map(item => item.id), ["operations", "customers", "directory"]);
});


test("contract dashboard counts overlapping alerts once and excludes expired readiness",()=>{
 const base={type:"partner",status:"active",penaltyReviewed:true,endDate:"2026-12-20"};
 const items=[base,{...base,endDate:"2026-11-08",penaltyReviewed:false},{...base,endDate:"2026-11-08"},{...base,endDate:"2026-11-09"},{...base,status:"approved",penaltyReviewed:false},{...base,status:"completed",endDate:"2026-11-01"},{...base,endDate:""}];
 assert.deepEqual(contractSnapshot(items,"2026-11-09"),{total:7,alerts:4,ready:3});
});
test("contract alert window includes day thirty and excludes later dates",()=>{
 const base={type:"partner",status:"active",penaltyReviewed:true};
 assert.deepEqual(contractSnapshot([{...base,endDate:"2026-12-09"},{...base,endDate:"2026-12-10"}],"2026-11-09"),{total:2,alerts:1,ready:2});
});

const definition={id:"contracts",key:"test-records",href:"contracts.html",safe:items=>items,metrics:items=>({total:items.length,alerts:0,ready:items.length})};
test("missing storage is empty while malformed storage requires attention",()=>{
 assert.equal(readDashboardModule(definition,{getItem:()=>null}).total,0);
 for(const raw of ["", "{", "null", "{}", "42", '"text"']){
  const result=readDashboardModule(definition,{getItem:()=>raw});
  assert.equal(result.unavailable,true);
  assert.equal(result.alerts,1);
  assert.equal(result.ready,0);
 }
});
test("storage access failures are isolated from healthy modules",()=>{
 const failed=readDashboardModule(definition,{getItem:()=>{throw Error("blocked")}});
 const healthy=readDashboardModule({...definition,id:"customers",href:"customers.html"},{getItem:()=>'[{"id":"synthetic"}]'});
 const summary=summarizeModules([failed,healthy]);
 assert.equal(summary.totals.records,1);
 assert.equal(summary.totals.alerts,1);
 assert.equal(summary.modules.find(item=>item.id==="customers").health,"active");
});

test("partially invalid storage is visible and cannot claim complete readiness",()=>{
 const def={...definition,safe:items=>items.filter(x=>x&&x.valid===true)};
 const result=readDashboardModule(def,{getItem:()=>'[{"valid":true},null,{"valid":false}]'});
 assert.equal(result.total,1);assert.equal(result.discarded,2);assert.equal(result.alerts,1);assert.equal(result.ready,0);
 const summary=summarizeModules([result]);assert.equal(summary.modules[0].discarded,2);
 assert.equal(summary.modules[0].health,"attention");assert.equal(summary.totals.ready,0);
 assert.equal(Object.hasOwn(result,"unavailable"),false);
 const healthy=readDashboardModule(def,{getItem:()=>'[{"valid":true}]'});
 assert.equal(Object.hasOwn(healthy,"discarded"),false);assert.equal(healthy.ready,1);
});
test("discarded record warning adds to operational alerts",()=>{
 const def={...definition,safe:()=>[],metrics:()=>({total:0,alerts:3,ready:2})};
 const result=readDashboardModule(def,{getItem:()=>'[null]'});
 assert.equal(result.alerts,4);assert.equal(result.ready,0);
});

import {readFileSync} from "node:fs";
import vm from "node:vm";
test("dashboard updates for related storage and language changes only",()=>{
 const source=readFileSync(new URL("../docs/dashboard.mjs",import.meta.url),"utf8");
 const listener=source.slice(source.indexOf('window.addEventListener("storage"'));
 assert.ok(listener.startsWith('window.addEventListener("storage"'));
 let handler,rendered=0,saved="en";
 const localStorage={getItem:()=>saved};
 const context=vm.createContext({window:{addEventListener:(name,fn)=>{assert.equal(name,"storage");handler=fn}},localStorage,navigator:{language:"ar-SY"},definitions:[{key:"contract-key"}],render:()=>rendered++});
 vm.runInContext('let lang="ar";'+listener,context);
 handler({key:"other-project",storageArea:localStorage});assert.equal(rendered,0);
 handler({key:"contract-key",storageArea:{}});assert.equal(rendered,0);
 handler({key:"contract-key",storageArea:localStorage});assert.equal(rendered,1);
 handler({key:"zarzour-language",storageArea:localStorage});assert.equal(rendered,2);assert.equal(vm.runInContext("lang",context),"en");
 saved=null;handler({key:null,storageArea:localStorage});assert.equal(rendered,3);assert.equal(vm.runInContext("lang",context),"ar");
 saved="invalid";handler({key:"zarzour-language",storageArea:localStorage});assert.equal(vm.runInContext("lang",context),"ar");
 localStorage.getItem=()=>{throw Error("blocked")};handler({key:"zarzour-language",storageArea:localStorage});assert.equal(vm.runInContext("lang",context),"ar");
});
