import test from 'node:test';
import assert from 'node:assert/strict';
import {validIsoDate,evaluateReturnStatus,validateReturnTransition,summarizeReturnQueue} from './return-tracking.mjs';
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
 for(const invalid of [null,undefined,[],42,'invalid',false]){
  assert.doesNotThrow(()=>evaluateReturnStatus(invalid,'2026-12-21'));
  assert.deepEqual(evaluateReturnStatus(invalid,'2026-12-21'),{ok:false,reason:'invalid_record'});
  assert.doesNotThrow(()=>validateReturnTransition('departed','returned',invalid));
  assert.deepEqual(validateReturnTransition('departed','returned',invalid),{ok:false,reason:'invalid_input'});
 }
 assert.deepEqual(validateReturnTransition('departed','returned'),{ok:false,reason:'invalid_date'});
 assert.deepEqual(evaluateReturnStatus({status:'departed',expectedReturn},'2026-12-21'),{ok:true,status:'departed',overdue:true,suggestedStatus:'return_due'});
});
