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



test('rejects ambiguous traveler formats and non-text destination or notes',()=>{
 for(const travelers of ['', ' ', ' 2', '2 ', '02', '2e0', '0x2', '+2', '2.0', true, null, [], {}])
  assert.ok(validateRequest({...valid,travelers},'2026-11-08').includes('travelers'),String(travelers));
 for(const destination of [2,{},[],true])
  assert.ok(validateRequest({...valid,destination},'2026-11-08').includes('destination'));
 for(const notes of [[],{},42])
  assert.ok(validateRequest({...valid,notes},'2026-11-08').includes('notes'));
 assert.deepEqual(validateRequest({...valid,travelers:'200'},'2026-11-08'),[]);
});


test('malformed date types never crash validation or produce a reviewed trip',()=>{
 for(const departure of [null, 20261220, true, [], {}, '2026-13-01', '2026-02-30']) {
  assert.doesNotThrow(()=>validateRequest({...valid,departure},'2026-11-08'));
  assert.ok(validateRequest({...valid,departure},'2026-11-08').includes('departure'));
 }
 for(const returnDate of [20261225, true, [], {}, '2026-13-01', '2026-02-30']) {
  assert.doesNotThrow(()=>validateRequest({...valid,returnDate},'2026-11-08'));
  assert.ok(validateRequest({...valid,returnDate},'2026-11-08').includes('returnDate'));
 }
});


test('missing or non-object trip payloads are rejected without exceptions',()=>{
 for(const payload of [null, undefined, false, 0, '', 'not a request', []]) {
  assert.doesNotThrow(()=>validateRequest(payload,'2026-11-08'));
  assert.deepEqual(validateRequest(payload,'2026-11-08'),['service','destination','departure','travelers']);
 }
 assert.deepEqual(validateRequest({},'2026-11-08'),['service','destination','departure','travelers']);
 assert.deepEqual(validateRequest(valid,'2026-11-08'),[]);
});

// Keep offline return-status rules in the existing CI test entrypoint.
import './return-tracking.test.mjs';


test('reviewed travel brief copies locally and never copies stale edits',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const html=await readFile(new URL('../docs/request.html',import.meta.url),'utf8');
 assert.match(html,/<button id="copy"[^>]*data-ar="نسخ الملخص"[^>]*data-en="Copy summary"/);
 assert.match(html,/<p[^>]*id="copy-status"[^>]*role="status"/);
 const source=(await readFile(new URL('../docs/request.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 const elements=new Map(),written=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,listeners:{},focus(){},addEventListener(type,fn){this.listeners[type]=fn}});return elements.get(id)};
 const input={service:'tourism',destination:'Damascus',departure:'2099-01-01',travelers:'3',returnDate:'2099-01-08',notes:'Family trip'};
 const navigator={language:'en-US',clipboard:{writeText:async value=>written.push(value)}};
 const document={documentElement:{},getElementById:el,querySelectorAll:()=>[]};
 runInNewContext(source,{validateRequest,requestSummary,Date,FormData:class{constructor(){return Object.entries(input)}},navigator,localStorage:{getItem:()=>null,setItem(){}},document});
 el('request').listeners.submit({preventDefault(){}});
 await el('copy').listeners.click();
 assert.equal(written.length,1);
 assert.match(written[0],/Travel planning request — not a confirmed booking/);
 assert.match(el('copy-status').textContent,/clipboard only/);
 el('request').listeners.input();
 await el('copy').listeners.click();
 assert.equal(written.length,1,'editing invalidates the reviewed brief, so no stale summary is copied');
 assert.equal(el('copy-status').textContent,'');
 el('request').listeners.submit({preventDefault(){}});
 navigator.clipboard.writeText=async()=>{throw new Error('Denied')};
 await el('copy').listeners.click();
 assert.match(el('copy-status').textContent,/download the summary instead/);
 let finish;
 navigator.clipboard.writeText=()=>new Promise(resolve=>{finish=resolve});
 const pending=el('copy').listeners.click();
 el('request').listeners.input();
 finish();
 await pending;
 assert.equal(el('copy-status').textContent,'','late clipboard completion cannot claim success after changes');
});

test('trip planner follows safe device language and cross-tab preference updates',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const source=(await readFile(new URL('../docs/request.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 const make=(device,savedValue)=>{
  const elements=new Map(),listeners={},writes=[],store={value:savedValue};
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn}});return elements.get(id)};
  const document={documentElement:{},getElementById:el,querySelectorAll:()=>[]};
  const localStorage={getItem:()=>store.value,setItem:(key,value)=>{store.value=value;writes.push([key,value])}};
  runInNewContext(source,{validateRequest,requestSummary,Date,navigator:{language:device},localStorage,document,window:{addEventListener:(name,fn)=>{listeners[name]=fn}}});
  return {document,store,writes,listeners,el};
 };
 const a=make('en-US','invalid-preference');
 assert.equal(a.document.documentElement.lang,'en','invalid stored preference must use browser language');
 a.store.value='ar';a.listeners.storage({key:'zarzour-language'});
 assert.equal(a.document.documentElement.dir,'rtl');
 assert.equal(a.writes.length,0,'cross-tab updates must not echo writes');
 a.listeners.storage({key:'unrelated'});
 assert.equal(a.document.documentElement.lang,'ar');
 a.store.value=null;a.listeners.storage({key:null});
 assert.equal(a.document.documentElement.lang,'en');
 a.el('language').listeners.click();
 assert.equal(a.document.documentElement.lang,'ar');
 assert.deepEqual(a.writes,[['zarzour-language','ar']]);
 const noDevice=make(undefined,null);
 assert.equal(noDevice.document.documentElement.lang,'ar','missing navigator language safely defaults to Arabic');
});
