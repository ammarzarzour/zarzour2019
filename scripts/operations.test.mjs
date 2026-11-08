import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics, filterPrograms, normalizeProgram, programReadiness, requiredReadinessFields, safePrograms, validateProgram } from "../docs/operations-model.mjs";

const valid = {service:"umrah",destination:"Makkah",departure:"2099-02-01",capacity:"50",reserved:"20",status:"documents"};

test("accepts a valid non-personal operating program",()=>{
  assert.deepEqual(validateProgram(valid,"2099-01-01"),[]);
  assert.deepEqual(normalizeProgram(valid,"p-1"),{id:"p-1",service:"umrah",destination:"Makkah",departure:"2099-02-01",capacity:50,reserved:20,status:"documents",contractReady:false,partnerVerified:false,documentsReady:false,returnPlanReady:false});
});

test("rejects invalid capacity, overbooking, dates and enumerations",()=>{
  const errors=validateProgram({...valid,service:"payment",departure:"2020-02-30",capacity:"3",reserved:"4",status:"unknown"},"2099-01-01");
  assert.deepEqual(errors,["service","departure","reserved","status"]);
});

test("calculates operational metrics without financial values",()=>{
  const programs=[normalizeProgram(valid,"p1"),normalizeProgram({...valid,service:"tourism",capacity:"10",reserved:"10",status:"ready"},"p2")];
  assert.deepEqual(calculateMetrics(programs,"2099-01-01"),{programs:2,upcoming:2,ready:0,blocked:1,openSeats:30,utilization:50});
});

test("tracks contracts, verified partners, documents and return planning",()=>{
  const ready=normalizeProgram({...valid,contractReady:"on",partnerVerified:"on",documentsReady:"on",returnPlanReady:"on"},"ready");
  assert.deepEqual(programReadiness(ready),{score:100,blockers:[]});
  const blocked=normalizeProgram({...valid,contractReady:"on",partnerVerified:"on"},"blocked");
  assert.deepEqual(programReadiness(blocked),{score:50,blockers:["documentsReady","returnPlanReady"]});
});

test("visa readiness does not require a travel return plan",()=>{
  assert.deepEqual(requiredReadinessFields("visa"),["contractReady","partnerVerified","documentsReady"]);
  const visa=normalizeProgram({...valid,service:"visa",contractReady:true,partnerVerified:true,documentsReady:true},"visa");
  assert.deepEqual(programReadiness(visa),{score:100,blockers:[]});
});

test("filters by service, state and destination",()=>{
  const programs=[normalizeProgram(valid,"p1"),normalizeProgram({...valid,service:"tourism",destination:"Damascus",status:"ready"},"p2")];
  assert.deepEqual(filterPrograms(programs,{service:"tourism",status:"ready",query:"mas"}).map(x=>x.id),["p2"]);
  assert.equal(filterPrograms(programs,{query:"not-found"}).length,0);
});

test("discards corrupt local records",()=>{
  assert.deepEqual(safePrograms([{...normalizeProgram(valid,"ok")},{id:"bad",service:"other"}],"2099-01-01").map(x=>x.id),["ok"]);
  assert.deepEqual(safePrograms(null),[]);
});

test("ready count excludes incomplete programs and includes fully reviewed programs",()=>{
 const complete=normalizeProgram({...valid,status:"ready",contractReady:true,partnerVerified:true,documentsReady:true,returnPlanReady:true},"complete");
 const incomplete=normalizeProgram({...valid,status:"ready"},"incomplete");
 const metrics=calculateMetrics([complete,incomplete],"2099-01-01");
 assert.equal(metrics.ready,1);
 assert.equal(metrics.blocked,1);
});

test("storage failures warn in both languages across operations and partners", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  for (const page of ["operations", "partners"]) {
    const source = readFileSync(new URL("../docs/" + page + ".mjs", import.meta.url), "utf8");
    const name = page === "operations" ? "savePrograms" : "save";
    const start = source.indexOf("function " + name + "()");
    const end = source.indexOf("function t(key)", start);
    assert.ok(start >= 0 && end > start);
    for (const lang of ["ar", "en"]) {
      const message = {hidden:true};
      const context = {lang, message, programs:[], partners:[], storageKey:"test",
        localStorage:{setItem(){throw new Error("quota");}},
        setMessage(text,error){Object.assign(message,{textContent:text,hidden:false,error});}};
      const code = source.slice(start,end) + "\n" + name + "()";
      assert.equal(runInNewContext(code,context), false);
      assert.equal(message.hidden,false);
      assert.ok(message.textContent.length > 30);
      assert.ok(message.error === true || message.className === "message error");
      context.localStorage.setItem = () => {};
      assert.equal(runInNewContext(code,context), true);
    }
  }
});
