import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest, requestSummary} from '../docs/request-model.mjs';
const valid = {service:'umrah', destination:'مكة', departure:'2026-12-20', travelers:'2', notes:'برنامج مناسب للعائلة'};
test('accepts each supported service and both group boundaries',()=>{
  for(const service of ['travel','tourism','visa','hajj','umrah']) for(const travelers of [1,200]) assert.deepEqual(validateRequest({...valid,service,travelers},'2026-11-08'),[]);
});
test('rejects past and impossible dates, blank destinations and invalid groups',()=>{
  for(const departure of ['2026-01-01','2026-02-30','invalid']) assert.ok(validateRequest({...valid,departure},'2026-11-08').includes('departure'));
  for(const travelers of [0,201,1.5,'abc']) assert.ok(validateRequest({...valid,travelers},'2026-11-08').includes('travelers'));
  assert.ok(validateRequest({...valid,destination:'  '},'2026-11-08').includes('destination'));
  assert.ok(validateRequest({...valid,service:'other'},'2026-11-08').includes('service'));
});
test('limits note length and generates bilingual summaries without booking confirmation',()=>{
  assert.ok(validateRequest({...valid,notes:'x'.repeat(1001)},'2026-11-08').includes('notes'));
  assert.match(requestSummary(valid,'en'),/not a confirmed booking/);
  assert.match(requestSummary(valid,'ar'),/ليس حجزاً مؤكداً/);
  assert.match(requestSummary(valid,'ar'),/مكة/);
});

test('return dates allow one-way and same-day trips but reject reversed or impossible dates',()=>{
 assert.deepEqual(validateRequest({...valid,returnDate:'2026-12-20'},'2026-11-08'),[]);
 for(const returnDate of ['2026-12-19','2027-02-30','invalid']) assert.ok(validateRequest({...valid,returnDate},'2026-11-08').includes('returnDate'));
 assert.match(requestSummary({...valid,returnDate:'2026-12-25'},'en'),/Expected return: 2026-12-25/);
 assert.match(requestSummary({...valid,returnDate:'2026-12-25'},'ar'),/العودة المتوقعة/);
});
