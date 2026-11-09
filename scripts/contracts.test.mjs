import test from "node:test";import assert from "node:assert/strict";
import {contractMetrics,contractReadiness,filterContracts,normalizeContract,safeContracts,validateContract,upsertContract} from "../docs/contracts-model.mjs";
const valid={reference:"CTR-100",type:"pilgrim_group",scope:"umrah",status:"review",startDate:"2099-01-01",endDate:"2099-03-01",returnResponsibility:"on",guaranteeReady:"on",penaltyReviewed:"on",notes:"Synthetic contract record"};
test("validates and normalizes a non-personal contract",()=>{assert.deepEqual(validateContract(valid),[]);assert.deepEqual(normalizeContract(valid,"c1"),{...valid,id:"c1",returnResponsibility:true,guaranteeReady:true,penaltyReviewed:true,notes:valid.notes})});
test("rejects invalid dates, ranges and enums",()=>{assert.deepEqual(validateContract({...valid,reference:"",type:"other",scope:"payment",status:"signed",startDate:"2099-02-30",endDate:"2098-01-01",notes:"x".repeat(241)}),["reference","type","scope","status","startDate","notes"])});
test("applies contract-type readiness rules",()=>{assert.deepEqual(contractReadiness(normalizeContract(valid,"c")),{required:["returnResponsibility","guaranteeReady","penaltyReviewed"],blockers:[],score:100});assert.deepEqual(contractReadiness(normalizeContract({...valid,returnResponsibility:false,penaltyReviewed:false},"b")).blockers,["returnResponsibility","penaltyReviewed"]);assert.deepEqual(contractReadiness(normalizeContract({...valid,type:"guarantor",guaranteeReady:false},"g")).required,["guaranteeReady"])});
test("restores valid unique records only",()=>{const one=normalizeContract(valid,"same"),other={...one,id:"other"};assert.deepEqual(safeContracts([null,{...one,id:" "},one,{...one,reference:"duplicate"},other]).map(x=>x.id),["same","other"])});
test("calculates blocked and expiring contract metrics",()=>{const items=[normalizeContract({...valid,status:"active",endDate:"2099-01-20"},"a"),normalizeContract({...valid,status:"approved",returnResponsibility:false,endDate:"2099-06-01"},"b"),normalizeContract({...valid,status:"completed"},"c"),normalizeContract({...valid,status:"review"},"d")];assert.deepEqual(contractMetrics(items,"2099-01-01"),{total:4,review:1,active:1,blocked:1,expired:0,expiring:1,completed:1})});
test("filters contracts by reference, notes, type and status",()=>{const items=[normalizeContract(valid,"a"),normalizeContract({...valid,reference:"AG-2",type:"agency",status:"active",notes:"International agency"},"b")];assert.deepEqual(filterContracts(items,{query:"international",type:"agency",status:"active"}).map(x=>x.id),["b"])});

test("separates expired contracts from today's and future expirations",()=>{
 const items=[
 normalizeContract({...valid,status:"active",endDate:"2099-01-09"},"past"),
 normalizeContract({...valid,status:"approved",endDate:"2099-01-10"},"today"),
 normalizeContract({...valid,status:"active",endDate:"2099-02-09"},"boundary"),
 normalizeContract({...valid,status:"active",endDate:"2099-02-10"},"later"),
 normalizeContract({...valid,status:"cancelled",endDate:"2099-01-09"},"cancelled"),
 normalizeContract({...valid,status:"completed",endDate:"2099-01-09"},"completed"),
 normalizeContract({...valid,status:"draft",endDate:"2099-01-09"},"draft"),
 normalizeContract({...valid,status:"active",endDate:""},"open")
 ];
 const result=contractMetrics(items,"2099-01-10");
 assert.equal(result.expired,1);assert.equal(result.expiring,2);
 assert.equal(items[0].status,"active");
});

test("updates contract obligations without duplicating or mutating records",()=>{
 const before=[normalizeContract(valid,"a")];
 const result=upsertContract(before,{...valid,status:"active",notes:"Updated"},"a");
 assert.deepEqual(result.errors,[]);assert.equal(result.items.length,1);
 assert.equal(result.items[0].id,"a");assert.equal(result.items[0].status,"active");assert.equal(before[0].status,"review");
});
test("invalid edits and incomplete approvals retain the original records",()=>{
 const before=[normalizeContract(valid,"a")];
 for(const change of [{endDate:"2098-01-01"},{status:"active",guaranteeReady:false}]){
 const result=upsertContract(before,{...valid,...change},"a");
 assert.ok(result.errors.length);assert.equal(result.items,before);
 }
});

test("rejects duplicate contract references on creation and editing",()=>{
 const before=[normalizeContract(valid,"a"),normalizeContract({...valid,reference:"CTR-200"},"b")];
 for(const id of ["new","b"]){
 const result=upsertContract(before,{...valid,reference:" ctr-100 "},id);
 assert.deepEqual(result.errors,["duplicateReference"]);assert.equal(result.items,before);
 }
 assert.deepEqual(upsertContract(before,{...valid,reference:" ctr-100 "},"a").errors,[]);
});
