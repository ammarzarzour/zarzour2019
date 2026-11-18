import test from 'node:test';
import assert from 'node:assert/strict';
import {validIsoDate,evaluateReturnStatus,validateReturnTransition} from './return-tracking.mjs';
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
