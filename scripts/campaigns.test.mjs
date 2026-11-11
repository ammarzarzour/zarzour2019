import test from "node:test";import assert from "node:assert/strict";import {campaignMetrics,campaignReadiness,filterCampaigns,normalizeCampaign,safeCampaigns,upsertCampaign,validateCampaign} from "../docs/campaigns-model.mjs";
const valid={reference:"CMP-101",service:"umrah",channel:"social",status:"planned",startDate:"2099-01-01",endDate:"2099-01-31",inquiries:"20",qualified:"5",landingReady:"on",trackingReady:"on",contentReady:"on",notes:"Synthetic campaign"};
test("validates and normalizes a non-financial campaign",()=>{assert.deepEqual(validateCampaign(valid),[]);assert.deepEqual(normalizeCampaign(valid,"c"),{...valid,id:"c",inquiries:20,qualified:5,landingReady:true,trackingReady:true,contentReady:true,notes:valid.notes})});
test("rejects invalid dates, enums and funnel counts",()=>{assert.deepEqual(validateCampaign({...valid,reference:"",service:"payment",channel:"other",status:"unknown",startDate:"2099-02-30",endDate:"2098-01-01",inquiries:"2",qualified:"3",notes:"x".repeat(241)}),["reference","service","channel","status","startDate","qualified","notes"])});
test("requires landing, tracking and content before activation",()=>{assert.deepEqual(campaignReadiness(normalizeCampaign(valid,"ok")),{blockers:[],score:100});assert.deepEqual(campaignReadiness(normalizeCampaign({...valid,trackingReady:false,contentReady:false},"blocked")),{blockers:["trackingReady","contentReady"],score:33})});
test("restores valid unique stored campaigns only",()=>{const one=normalizeCampaign(valid,"same"),other={...one,id:"other"};assert.deepEqual(safeCampaigns([null,{...one,id:" "},one,{...one,reference:"duplicate"},other]).map(x=>x.id),["same","other"])});
test("calculates campaign funnel and ending-soon metrics",()=>{const items=[normalizeCampaign({...valid,status:"active",endDate:"2099-01-05"},"a"),normalizeCampaign({...valid,status:"active",inquiries:"10",qualified:"2",trackingReady:false,endDate:"2099-02-01"},"b"),normalizeCampaign({...valid,status:"completed",inquiries:"10",qualified:"3"},"c")];assert.deepEqual(campaignMetrics(items,"2099-01-01"),{total:3,planned:0,active:2,blocked:1,completed:1,inquiries:40,conversion:25,ending:1})});
test("filters by reference, notes, service and status",()=>{const items=[normalizeCampaign(valid,"a"),normalizeCampaign({...valid,reference:"TOUR-2",service:"tourism",status:"active",notes:"Damascus launch"},"b")];assert.deepEqual(filterCampaigns(items,{query:"damascus",service:"tourism",status:"active"}).map(x=>x.id),["b"])});

test("campaign edits preserve identity, counts and unaffected records",()=>{
 const items=[normalizeCampaign(valid,"a"),normalizeCampaign({...valid,reference:"CMP-102"},"b")];
 const result=upsertCampaign(items,{...valid,inquiries:"30",qualified:"9",status:"active"},"a");
 assert.deepEqual(result.errors,[]);assert.equal(result.items.length,2);assert.equal(result.items[0].qualified,9);
 assert.equal(result.items[0].status,"active");assert.equal(items[0].status,"planned");assert.strictEqual(result.items[1],items[1]);
});
test("duplicate campaign references are rejected on add and edit",()=>{
 const items=[normalizeCampaign(valid,"a"),normalizeCampaign({...valid,reference:"CMP-102"},"b")];
 for(const id of ["new","b"]){const result=upsertCampaign(items,{...valid,reference:" cmp-101 "},id);assert.deepEqual(result.errors,["duplicateReference"]);assert.strictEqual(result.items,items)}
 assert.deepEqual(upsertCampaign(items,valid,"a").errors,[]);
 assert.equal(upsertCampaign(items,{...valid,reference:"CMP-103"},"new").items.length,3);
});
test("editing cannot bypass activation readiness or invalid funnel checks",()=>{
 const items=[normalizeCampaign({...valid,status:"active"},"a")];
 for(const [input,error] of [[{...valid,status:"active",trackingReady:false},"readiness"],[{...valid,qualified:"21"},"qualified"]]){
 const result=upsertCampaign(items,input,"a");assert.deepEqual(result.errors,[error]);assert.strictEqual(result.items,items)}
 const paused=upsertCampaign(items,{...valid,status:"paused",trackingReady:false},"a");
 assert.deepEqual(paused.errors,[]);assert.equal(paused.items[0].trackingReady,false);
});

test("stored funnel counts reject coercible non-numeric values",()=>{
 for(const value of [null,true,false,[],[1],{}, "", " ", "01", "1e2","0x10","+2"," 2"]){
 assert.ok(validateCampaign({...valid,inquiries:value}).includes("inquiries"));
 assert.ok(validateCampaign({...valid,qualified:value}).includes("qualified"));
 }
 for(const value of [0,"0",20,"20"])assert.ok(!validateCampaign({...valid,inquiries:value,qualified:0}).includes("inquiries"));
});
