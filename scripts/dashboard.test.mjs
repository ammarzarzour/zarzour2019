import test from "node:test";
import assert from "node:assert/strict";
import { moduleHealth, normalizeSnapshot, summarizeModules, contractSnapshot } from "../docs/dashboard-model.mjs";

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
