import test from 'node:test';
import assert from 'node:assert/strict';
import {validIsoDate,evaluateReturnStatus,validateReturnTransition,summarizeReturnQueue,summarizeReturnDeadlines,summarizeOverdueEscalations} from './return-tracking.mjs';
const expectedReturn='2026-12-20';
test('strict ISO calendar dates',()=>{
 for(const d of ['2026-02-30','2026-13-01','2026-2-01',null,{},'1999-12-31'])assert.equal(validIsoDate(d),false);
 assert.equal(validIsoDate('2028-02-29'),true);
});
test('late return is a suggestion, never an automatic status update',()=>{
 const record=Object.freeze({status:'departed',expectedReturn});
 assert.deepEqual(evaluateReturnStatus(record,'2026-12-21'),{ok:true,status:'departed',overdue:true,suggestedStatus:'return_due'});
 assert.equal(record.status,'departed');
 assert.equal(evaluateReturnStatus(record,'2026-12-20').overdue,false);
});
test('state transitions require explicit valid evidence',()=>{
 const opts={expectedReturn,today:'2026-12-21'};
 assert.deepEqual(validateReturnTransition('departed','return_due',opts),{ok:true});
 assert.equal(validateReturnTransition('planned','returned',{...opts,actualReturn:'2026-12-21'}).ok,false);
 assert.equal(validateReturnTransition('returned','departed',opts).ok,false);
 assert.equal(validateReturnTransition('departed','return_due',{...opts,today:'2026-12-20'}).ok,false);
 assert.equal(validateReturnTransition('return_due','returned',{...opts,actualReturn:'2026-12-22'}).ok,false);
 assert.deepEqual(validateReturnTransition('return_due','returned',{...opts,actualReturn:'2026-12-21'}),{ok:true});
});
test('inconsistent return records are rejected',()=>{
 assert.equal(evaluateReturnStatus({status:'returned',expectedReturn},'2026-12-21').ok,false);
 assert.equal(evaluateReturnStatus({status:'departed',expectedReturn,actualReturn:'2026-12-21'},'2026-12-21').ok,false);
});

test('completed returns require evidence dated no later than review day',()=>{
 const future=Object.freeze({status:'returned',expectedReturn:'2026-12-20',actualReturn:'2026-12-23'});
 assert.deepEqual(evaluateReturnStatus(future,'2026-12-21'),{ok:false,reason:'future_actual_return'});
 assert.deepEqual(summarizeReturnQueue([future],'2026-12-21'),{ok:false,reason:'invalid_record'});
 assert.equal(future.actualReturn,'2026-12-23');
 assert.equal(evaluateReturnStatus({...future,actualReturn:'2026-12-21'},'2026-12-21').ok,true);
 assert.equal(evaluateReturnStatus({...future,actualReturn:'2026-12-19'},'2026-12-21').ok,true);
});
test('aggregate return queue counts without leaking personal fields',()=>{
 const records=[
  {status:'planned',expectedReturn:'2026-12-20',name:'PRIVATE'},
  {status:'departed',expectedReturn:'2026-12-19',name:'PRIVATE'},
  {status:'follow_up',expectedReturn:'2026-12-19'},
  {status:'returned',expectedReturn:'2026-12-19',actualReturn:'2026-12-19'}
 ];
 const snapshot=JSON.stringify(records);
 const result=summarizeReturnQueue(records,'2026-12-21');
 assert.deepEqual(result,{ok:true,total:4,counts:{planned:1,departed:1,return_due:0,returned:1,follow_up:1},overdue:2,needsReview:2});
 assert.equal(JSON.stringify(records),snapshot);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('reject invalid queues atomically rather than returning partial totals',()=>{
 assert.deepEqual(summarizeReturnQueue([{status:'departed',expectedReturn:'2026-12-19'},null],'2026-12-21'),{ok:false,reason:'invalid_record'});
 assert.deepEqual(summarizeReturnQueue([{status:'returned',expectedReturn:'2026-12-19'}],'2026-12-21'),{ok:false,reason:'invalid_record'});
 assert.deepEqual(summarizeReturnQueue({},'2026-12-21'),{ok:false,reason:'invalid_input'});
 assert.deepEqual(summarizeReturnQueue([],'bad-date'),{ok:false,reason:'invalid_input'});
 assert.equal(summarizeReturnQueue([],'2026-12-21').total,0);
});

test('malformed offline records and transition options return errors, not exceptions',()=>{
 for(const invalid of [null,[],42,'invalid',false]){
  assert.doesNotThrow(()=>evaluateReturnStatus(invalid,'2026-12-21'));
  assert.deepEqual(evaluateReturnStatus(invalid,'2026-12-21'),{ok:false,reason:'invalid_record'});
  assert.doesNotThrow(()=>validateReturnTransition('departed','returned',invalid));
  assert.deepEqual(validateReturnTransition('departed','returned',invalid),{ok:false,reason:'invalid_input'});
 }
 // Omitted options use the documented empty-object default; malformed supplied options do not.
 assert.deepEqual(validateReturnTransition('departed','returned',undefined),{ok:false,reason:'invalid_date'});
 assert.deepEqual(validateReturnTransition('departed','returned'),{ok:false,reason:'invalid_date'});
 assert.deepEqual(evaluateReturnStatus({status:'departed',expectedReturn},'2026-12-21'),{ok:true,status:'departed',overdue:true,suggestedStatus:'return_due'});
});

test('deadline buckets use UTC calendar days and never expose identities',()=>{
 const records=Object.freeze([
  Object.freeze({status:'departed',expectedReturn:'2026-12-30',name:'PRIVATE'}),
  Object.freeze({status:'return_due',expectedReturn:'2026-12-31'}),
  Object.freeze({status:'follow_up',expectedReturn:'2027-01-01'}),
  Object.freeze({status:'departed',expectedReturn:'2027-01-07'}),
  Object.freeze({status:'departed',expectedReturn:'2027-01-08'}),
  Object.freeze({status:'planned',expectedReturn:'2026-12-20'}),
  Object.freeze({status:'returned',expectedReturn:'2026-12-20',actualReturn:'2026-12-30'})
 ]);
 const before=JSON.stringify(records);
 const result=summarizeReturnDeadlines(records,'2026-12-31');
 assert.deepEqual(result,{ok:true,overdue:1,dueToday:1,dueNextSevenDays:2,later:1});
 assert.equal(JSON.stringify(records),before);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('deadline summary rejects invalid batches atomically',()=>{
 assert.deepEqual(summarizeReturnDeadlines([], '2026-12-31'),{ok:true,overdue:0,dueToday:0,dueNextSevenDays:0,later:0});
 assert.deepEqual(summarizeReturnDeadlines({}, '2026-12-31'),{ok:false,reason:'invalid_input'});
 assert.deepEqual(summarizeReturnDeadlines([], '2026-02-30'),{ok:false,reason:'invalid_input'});
 assert.deepEqual(summarizeReturnDeadlines([{status:'departed',expectedReturn:'2026-12-30'},null], '2026-12-31'),{ok:false,reason:'invalid_record'});
 assert.deepEqual(summarizeReturnDeadlines([{status:'returned',expectedReturn:'2026-12-30'}], '2026-12-31'),{ok:false,reason:'invalid_record'});
});

test('overdue escalation tiers respect UTC calendar boundaries and privacy',()=>{
 const records=Object.freeze([
  Object.freeze({status:'departed',expectedReturn:'2026-12-30',name:'PRIVATE'}),
  Object.freeze({status:'return_due',expectedReturn:'2026-12-24'}),
  Object.freeze({status:'follow_up',expectedReturn:'2026-12-23'}),
  Object.freeze({status:'departed',expectedReturn:'2026-12-01'}),
  Object.freeze({status:'departed',expectedReturn:'2026-11-30'}),
  Object.freeze({status:'departed',expectedReturn:'2026-11-01'}),
  Object.freeze({status:'departed',expectedReturn:'2026-10-31'}),
  Object.freeze({status:'planned',expectedReturn:'2026-10-01'}),
  Object.freeze({status:'returned',expectedReturn:'2026-10-01',actualReturn:'2026-12-30'}),
  Object.freeze({status:'departed',expectedReturn:'2026-12-31'})
 ]);
 const before=JSON.stringify(records);
 const result=summarizeOverdueEscalations(records,'2026-12-31');
 assert.deepEqual(result,{ok:true,oneToSevenDays:2,eightToThirtyDays:2,overThirtyDays:3});
 assert.equal(JSON.stringify(records),before);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('overdue escalation refuses malformed batches without partial counts',()=>{
 assert.deepEqual(summarizeOverdueEscalations([], '2026-12-31'),{ok:true,oneToSevenDays:0,eightToThirtyDays:0,overThirtyDays:0});
 assert.deepEqual(summarizeOverdueEscalations([], '2026-02-30'),{ok:false,reason:'invalid_input'});
 assert.deepEqual(summarizeOverdueEscalations({}, '2026-12-31'),{ok:false,reason:'invalid_input'});
 assert.deepEqual(summarizeOverdueEscalations([{status:'departed',expectedReturn:'2026-12-30'},null], '2026-12-31'),{ok:false,reason:'invalid_record'});
 assert.deepEqual(summarizeOverdueEscalations([{status:'returned',expectedReturn:'2026-12-30'}], '2026-12-31'),{ok:false,reason:'invalid_record'});
});
