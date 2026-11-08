import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics, filterPrograms, normalizeProgram, safePrograms, validateProgram } from "../docs/operations-model.mjs";

const valid = {service:"umrah",destination:"Makkah",departure:"2099-02-01",capacity:"50",reserved:"20",status:"documents"};

test("accepts a valid non-personal operating program",()=>{
  assert.deepEqual(validateProgram(valid,"2099-01-01"),[]);
  assert.deepEqual(normalizeProgram(valid,"p-1"),{id:"p-1",service:"umrah",destination:"Makkah",departure:"2099-02-01",capacity:50,reserved:20,status:"documents"});
});

test("rejects invalid capacity, overbooking, dates and enumerations",()=>{
  const errors=validateProgram({...valid,service:"payment",departure:"2020-02-30",capacity:"3",reserved:"4",status:"unknown"},"2099-01-01");
  assert.deepEqual(errors,["service","departure","reserved","status"]);
});

test("calculates operational metrics without financial values",()=>{
  const programs=[normalizeProgram(valid,"p1"),normalizeProgram({...valid,service:"tourism",capacity:"10",reserved:"10",status:"ready"},"p2")];
  assert.deepEqual(calculateMetrics(programs,"2099-01-01"),{programs:2,upcoming:2,ready:1,openSeats:30,utilization:50});
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
