import test from "node:test";import assert from "node:assert/strict";import {commissionMetrics,commissionReadiness,filterCommissions,formatMinor,normalizeCommission,safeCommissions,validateCommission} from "../docs/commissions-model.mjs";
const valid={reference:"COM-101",source:"agent",currency:"SAR",status:"review",baseAmount:"1250.50",rate:"7.25",contractVerified:"on",sourceApproved:"on",calculationReviewed:"on",notes:"Synthetic commission"};
test("normalizes monetary values to integer minor units",()=>{assert.deepEqual(validateCommission(valid),[]);const item=normalizeCommission(valid,"c");assert.equal(item.baseMinor,125050);assert.equal(item.rateBps,725);assert.equal(item.commissionMinor,9066)});
test("rejects malformed amounts, excessive rates and enums",()=>{assert.deepEqual(validateCommission({...valid,reference:"",source:"other",currency:"BTC",status:"paid",baseAmount:"1.999",rate:"100.01",notes:"x".repeat(241)}),["reference","source","currency","status","baseAmount","rate","notes"])});
test("requires contract, source and calculation review before approval",()=>{assert.deepEqual(commissionReadiness(normalizeCommission(valid,"ok")),{blockers:[],score:100});assert.deepEqual(commissionReadiness(normalizeCommission({...valid,sourceApproved:false,calculationReviewed:false},"b")),{blockers:["sourceApproved","calculationReviewed"],score:33})});
test("restores valid unique records and recomputes commission",()=>{const one=normalizeCommission(valid,"same"),tampered={...one,id:"other",commissionMinor:1};const result=safeCommissions([null,{...one,id:" "},one,{...one,reference:"duplicate"},tampered]);assert.deepEqual(result.map(x=>x.id),["same","other"]);assert.equal(result[1].commissionMinor,9066)});
test("summarizes approved readiness and totals by currency without payments",()=>{const items=[normalizeCommission({...valid,status:"approved"},"a"),normalizeCommission({...valid,status:"approved",sourceApproved:false},"b"),normalizeCommission({...valid,status:"void"},"c"),normalizeCommission({...valid,currency:"USD",baseAmount:"100",rate:"10"},"d")];assert.deepEqual(commissionMetrics(items),{total:4,review:1,approved:2,blocked:1,totals:{USD:1000,SAR:9066,EUR:0,SYP:0}})});
test("filters and formats commission records",()=>{const items=[normalizeCommission(valid,"a"),normalizeCommission({...valid,reference:"AG-2",currency:"USD",status:"approved",notes:"International agency"},"b")];assert.deepEqual(filterCommissions(items,{query:"international",currency:"USD",status:"approved"}).map(x=>x.id),["b"]);assert.match(formatMinor(9066,"SAR"),/90\.66/)});

test("excludes incomplete approved commissions for every review requirement",()=>{
 for(const field of ["contractVerified","sourceApproved","calculationReviewed"]){
  for(const value of [false,"false",null,undefined]){
   const item=normalizeCommission({...valid,status:"approved",[field]:value},"blocked");
   const result=commissionMetrics([item]);
   assert.equal(result.totals.SAR,0);
   assert.equal(result.blocked,1);
   assert.equal(result.total,1);
  }
 }
});
test("restored incomplete approvals stay visible without inflating totals",()=>{
 const stored=normalizeCommission({...valid,status:"approved",contractVerified:false},"legacy");
 const restored=safeCommissions([stored]);
 assert.equal(restored.length,1);
 assert.equal(commissionMetrics(restored).totals.SAR,0);
 const reviewed=normalizeCommission({...stored,contractVerified:true},"legacy");
 assert.equal(commissionMetrics([reviewed]).totals.SAR,9066);
});
