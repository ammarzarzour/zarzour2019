import test from 'node:test';
import assert from 'node:assert/strict';
test('request errors identify fields, translate and hide outdated summaries', async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const elements=new Map();let focused='';
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,listeners:{},focus(){focused=id},addEventListener(event,fn){this.listeners[event]=fn}});return elements.get(id)};
 const input={service:'umrah',destination:'',departure:'2020-01-01',travelers:'0',notes:'',returnDate:''};
 const source=(await readFile(new URL('../docs/request.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 runInNewContext(source,{validateRequest,requestSummary,Date,FormData:class {constructor(){return Object.entries(input)}},navigator:{language:'ar'},localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:element,querySelectorAll:()=>[],documentElement:{}}});
 element('summary').textContent='outdated';element('request').listeners.submit({preventDefault(){}});
 assert.equal(focused,'destination');assert.equal(element('result').hidden,true);assert.equal(element('summary').textContent,'');
 assert.match(element('error').textContent,/وجهة/);assert.match(element('error').textContent,/200/);
 element('language').listeners.click();assert.match(element('error').textContent,/destination/);assert.match(element('error').textContent,/departure/);
 input.destination='Damascus';input.departure='2099-01-01';input.travelers='2';
 element('request').listeners.submit({preventDefault(){}});assert.equal(element('error').textContent,'');assert.equal(element('result').hidden,false);assert.match(element('summary').textContent,/Damascus/);
});
test('home planner invalidates edits and prevents stale printing', async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const elements=new Map();let prints=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,listeners:{},setAttribute(){},addEventListener(event,fn){this.listeners[event]=fn;}});return elements.get(id);};
 const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
 runInNewContext(script,{Date,navigator:{language:'ar'},localStorage:{getItem:()=>null},window:{print:()=>prints++},document:{getElementById:element,querySelectorAll:()=>[],documentElement:{},addEventListener(){}}});
 element('travelers').value='3';element('trip-days').value='10';element('trip-type').value='umrah';
 for(const event of ['input','change']){
  element('trip-form').listeners.submit({preventDefault(){}});assert.match(element('plan-result').textContent,/3/);assert.equal(element('print-plan').hidden,false);
  element('print-plan').listeners.click();assert.equal(prints,1);
  element('trip-form').listeners[event]();assert.equal(element('plan-result').textContent,'');assert.equal(element('print-plan').hidden,true);
  element('print-plan').listeners.click();assert.equal(prints,1);prints=0;
 }
});
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

test('editing a reviewed request clears stale output and updates return-date minimum', async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return elements.get(id);};
 const source=(await readFile(new URL('../docs/request.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 runInNewContext(source,{validateRequest,requestSummary,Date,navigator:{language:'ar'},localStorage:{getItem:()=>null},document:{getElementById:element,querySelectorAll:()=>[],documentElement:{}}});
 element('summary').textContent='old request';
 element('error').textContent='old error';
 element('departure').value='2027-01-20';
 element('request').listeners.input();
 assert.equal(element('summary').textContent,'');
 assert.equal(element('error').textContent,'');
 assert.equal(element('result').hidden,true);
 assert.equal(element('returnDate').min,'2027-01-20');
 element('departure').value='';
 element('request').listeners.input();
 assert.match(element('returnDate').min,/^\d{4}-\d{2}-\d{2}$/);
});


