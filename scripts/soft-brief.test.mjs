import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { assessScope, briefSummary, normalizeBrief, validateBrief } from "../docs/soft/brief-model.mjs";

const valid={name:"Operations Hub",type:"internal",goal:"Organize internal workflows",modules:["crm","workflows","reports"],language:"both",phase:"mvp"};

test("validates and normalizes a complete project brief",()=>{
  assert.deepEqual(validateBrief(valid),[]);
  assert.deepEqual(normalizeBrief({...valid,name:"  Operations Hub  ",modules:["crm","crm","reports"]}),{name:"Operations Hub",type:"internal",goal:"Organize internal workflows",modules:["crm","reports"],language:"both",phase:"mvp"});
});

test("rejects missing goals, modules and unknown enumerations",()=>{
  assert.deepEqual(validateBrief({name:"",type:"other",goal:"",modules:[],language:"fr",phase:"later"}),["name","type","goal","modules","language","phase"]);
});

test("assesses foundation, standard and advanced scopes",()=>{
  assert.equal(assessScope({...valid,type:"website",modules:["content"],language:"ar"}).level,"foundation");
  assert.equal(assessScope(valid).level,"standard");
  assert.equal(assessScope({...valid,type:"portal",modules:["content","crm","workflows","reports","integrations","bilingual"]}).level,"advanced");
});

test("advanced scopes include an architecture stage",()=>{
  const result=assessScope({...valid,type:"portal",modules:["content","crm","workflows","reports","integrations","bilingual"]});
  assert.deepEqual(result.recommended,["discovery","prototype","architecture","build","validation"]);
});

test("generates bilingual summaries without price or schedule promises",()=>{
  const ar=briefSummary(valid,"ar"),en=briefSummary(valid,"en");
  assert.match(ar,/اسم المشروع: Operations Hub/);assert.match(ar,/ليس عرض سعر/);
  assert.match(en,/Project: Operations Hub/);assert.match(en,/not a price quote/);
});

test("Soft landing page survives blocked and corrupt browser storage",async()=>{
  const html=await readFile(new URL("../docs/soft/index.html",import.meta.url),"utf8");
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const blocked of [false,true])for(const saved of ["invalid","ar","en"]){
    const nodes=new Map(["lang"].map(id=>[id,{textContent:"",events:{},addEventListener(name,handler){this.events[name]=handler}}]));
    const document={documentElement:{},querySelectorAll(){return[]},getElementById(id){return nodes.get(id)}};
    const localStorage={getItem(){if(blocked)throw Error("blocked");return saved},setItem(){if(blocked)throw Error("blocked")}};
    vm.runInNewContext(script,{document,localStorage,navigator:{language:"en-US"}});
    assert.ok(["ar","en"].includes(document.documentElement.lang));
    nodes.get("lang").events.click();
    assert.ok(["ar","en"].includes(document.documentElement.lang));
  }
});
