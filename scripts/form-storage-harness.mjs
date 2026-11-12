import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

// Execute the real submit handler with a storage quota failure, then retry.
export function verifyStorageRetry(path, collection, valid, model, editing) {
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  const listener=source.slice(source.indexOf('form.addEventListener("submit"'),source.indexOf('rows.addEventListener("change"'));
  const save=source.slice(source.indexOf("function save("),source.indexOf(";return false}}",source.indexOf("function save("))+15);
  const initial={...valid,id:"existing"};
  let stored=JSON.stringify(editing?[initial]:[]),fail=true,resets=0,handler;
  const cancel={hidden:!editing};
  const form={addEventListener:(_,fn)=>handler=fn,querySelectorAll:()=>[],reset:()=>resets++};
  const context=vm.createContext({...model,form,lang:"en",editingId:editing?"existing":null,
    editingSnapshot:editing?initial:null,[collection]:editing?[initial]:[],
    key:"test",storageKey:"test",show:()=>{},render:()=>{},
    document:{getElementById:()=>cancel},
    localStorage:{getItem:()=>stored,setItem:(_,value)=>{if(fail)throw Error("QuotaExceededError");stored=value}},
    FormData:class{constructor(){return Object.entries({...valid,notes:"Revised synthetic record"})}}
  });
  vm.runInContext(save+";"+listener,context);
  handler({preventDefault(){}});
  assert.equal(resets,0,"failed save must preserve form inputs");
  assert.equal(context.editingId,editing?"existing":null,"editing identity must survive failure");
  assert.equal(cancel.hidden,!editing);
  assert.deepEqual(JSON.parse(stored),editing?[initial]:[],"failure must not report a persisted candidate");
  fail=false;
  handler({preventDefault(){}});
  assert.equal(resets,1);
  assert.equal(context.editingId,null);
  assert.equal(JSON.parse(stored).length,1,"retry must update rather than duplicate");
  assert.equal(JSON.parse(stored)[0].notes,"Revised synthetic record");
}
