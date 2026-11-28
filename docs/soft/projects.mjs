import {mergeProjectBackup,deliveryReadiness,filterProjects,upsertProject,projectMetrics,safeProjects,statuses,validateProject,localToday,exportProjectBackup,importProjectBackup,PROJECT_BACKUP_MAX_BYTES} from "./projects-model.mjs";const key="zarzour-soft-projects-v1",languageKey="zarzour-soft-language",form=document.getElementById("project-form"),rows=document.getElementById("rows"),message=document.getElementById("message"),empty=document.getElementById("empty");let lang="ar",items=[],editingId=null,editingSnapshot=null;try{lang=localStorage.getItem(languageKey)==="en"?"en":"ar";const saved=localStorage.getItem(key);items=saved?safeProjects(JSON.parse(saved)):[]}catch{items=[]}
const words={website:["موقع","Website"],mobile_app:["تطبيق","Mobile app"],internal_tool:["أداة داخلية","Internal tool"],automation:["أتمتة","Automation"],discovery:["اكتشاف","Discovery"],design:["تصميم","Design"],build:["بناء","Build"],validation:["تحقق","Validation"],release:["إصدار","Release"],maintenance:["صيانة","Maintenance"],planned:["مخطط","Planned"],active:["نشط","Active"],blocked:["متعثر","Blocked"],completed:["مكتمل","Completed"]},t=k=>words[k]?.[lang==="ar"?0:1]||k;function show(x,e=false){message.textContent=x;message.className=e?"message error":"message";message.hidden=false}function save(next=items,formSubmission=false){try{localStorage.setItem(key,JSON.stringify(next));return true}catch{show(formSubmission?(lang==="ar"?"لم يتم الحفظ؛ بقيت مدخلات النموذج متاحة. أعد المحاولة قبل مغادرة الصفحة.":"Not saved; form inputs are preserved. Retry before leaving this page."):(lang==="ar"?"تعذر الحفظ الدائم؛ التغييرات مؤقتة فقط.":"Permanent storage failed; changes are session-only."),true);return false}}
function render(){const m=projectMetrics(items,localToday());for(const k of ["total","active","blocked","overdue","dueSoon","releaseReady"])document.getElementById("m-"+k).textContent=m[k];document.getElementById("m-progress").textContent=m.progress+"%";const shown=filterProjects(items,{query:document.getElementById("search").value,type:document.getElementById("filter-type").value,status:document.getElementById("filter-status").value});rows.replaceChildren();empty.hidden=shown.length>0;for(const item of shown){const ready=deliveryReadiness(item),tr=document.createElement("tr");for(const value of [item.reference,t(item.type),t(item.stage)]){const td=document.createElement("td");td.textContent=value;tr.append(td)}const state=document.createElement("select");state.dataset.statusId=item.id;for(const s of statuses){const o=document.createElement("option");o.value=s;o.textContent=t(s);o.selected=s===item.status;state.append(o)}const sc=document.createElement("td");sc.append(state);tr.append(sc);const rc=document.createElement("td"),badge=document.createElement("span");badge.className="badge"+(ready.blockers.length?" blocked":"");badge.textContent=ready.score+"%";badge.title=ready.blockers.join(", ");rc.append(badge);tr.append(rc);for(const value of [item.tasksDone+" / "+item.tasksTotal,item.targetDate]){const td=document.createElement("td");td.textContent=value;tr.append(td)}const ac=document.createElement("td"),del=document.createElement("button");del.className="danger";del.type="button";del.dataset.deleteId=item.id;del.textContent=lang==="ar"?"حذف":"Delete";const edit=document.createElement("button");edit.type="button";edit.dataset.editId=item.id;edit.textContent=lang==="ar"?"تعديل":"Edit";ac.append(edit,del);tr.append(ac);rows.append(tr)}}
function applyLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ar]").forEach(n=>n.innerHTML=n.dataset[lang]);document.querySelectorAll("[data-ar-placeholder]").forEach(n=>n.placeholder=n.dataset[lang+"Placeholder"]);document.getElementById("language").textContent=lang==="ar"?"English":"العربية";render()}
form.addEventListener("submit",e=>{e.preventDefault();const input=Object.fromEntries(new FormData(form)),errors=validateProject(input);form.querySelectorAll("[aria-invalid]").forEach(n=>n.removeAttribute("aria-invalid"));if(errors.length){for(const id of errors)document.getElementById(id).setAttribute("aria-invalid","true");show(lang==="ar"?"راجع الحقول المحددة.":"Review highlighted fields.",true);return}try{const raw=localStorage.getItem(key),parsed=raw===null?[]:JSON.parse(raw);if(!Array.isArray(parsed))throw Error("Invalid register");const latest=safeProjects(parsed);if(latest.length!==parsed.length)throw Error("Invalid records");items=latest}catch{show(lang==="ar"?"تعذر قراءة سجل كامل وصالح؛ احتفظ بتعديلاتك وأعد المحاولة.":"A complete valid register could not be read; keep your edits and try again.",true);return}const result=upsertProject(items,input,editingId||"soft-project-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),editingId?editingSnapshot:undefined);if(result.errors.includes("conflict")){show(lang==="ar"?"تغير السجل أو حُذف في نافذة أخرى. انسخ تعديلاتك ثم افتح أحدث نسخة.":"Record changed or was deleted in another window. Copy your edits, then reopen the latest version.",true);render();return}if(result.errors.length){const duplicate=result.errors.includes("duplicateReference");if(duplicate){document.getElementById("reference").setAttribute("aria-invalid","true");document.getElementById("reference").focus()}const messages={duplicateReference:["الرمز المرجعي مستخدم لمشروع آخر.","Reference is already used by another project."],duplicateId:["معرّف المشروع مستخدم بالفعل؛ لم يُستبدل المشروع الموجود.","Project ID already exists; the existing project was not overwritten."],projectStore:["سجل المشاريع غير صالح؛ لم تُحفظ التغييرات.","Project register is invalid; changes were not saved."],projectId:["معرّف المشروع غير صالح؛ لم تُحفظ التغييرات.","Project ID is invalid; changes were not saved."],readiness:["لا يمكن إكمال المشروع قبل جاهزية التسليم.","Project cannot complete before delivery readiness."]};const code=result.errors.find(x=>messages[x]);show(code?messages[code][lang==="ar"?0:1]:(lang==="ar"?"راجع بيانات المشروع وحاول مجدداً.":"Review project details and try again."),true);return}if(!save(result.items,true))return;items=result.items;editingId=null;editingSnapshot=null;document.getElementById("cancel-edit").hidden=true;show(lang==="ar"?"تم الحفظ داخل مساحة زرزور سوفت المستقلة.":"Saved in the independent Zarzour Soft workspace.");form.reset();render()});rows.addEventListener("change",e=>{
 const id=e.target.dataset.statusId,status=e.target.value;if(!id||!statuses.includes(status))return;
 changeStoredProject(id,status);
});
function changeStoredProject(id,status){
 const expected=items.find(x=>x.id===id);if(!expected)return false;
 let latest;
 try{const raw=localStorage.getItem(key),parsed=raw===null?[]:JSON.parse(raw);if(!Array.isArray(parsed))throw Error("Invalid register");latest=safeProjects(parsed);if(latest.length!==parsed.length)throw Error("Invalid records")}
 catch{show(lang==="ar"?"تعذر قراءة سجل كامل وصالح؛ لم تُحفظ العملية.":"A complete valid register could not be read; operation was not saved.",true);render();return false}
 // Deletion does not need delivery readiness: historical completed records may be
 // incomplete. Still reject a stale row before removing anything.
 const current=latest.find(x=>x.id===id);
 const conflict=!current||JSON.stringify(current)!==JSON.stringify(expected);
 const result=status===null?{errors:conflict?["conflict"]:[],items:latest}:upsertProject(latest,{...expected,status},id,expected);
 if(result.errors.length){items=latest;show(result.errors.includes("conflict")?(lang==="ar"?"تغير المشروع أو حُذف في نافذة أخرى؛ راجع أحدث نسخة.":"Project changed or was deleted in another window; review the latest version."):(lang==="ar"?"الإكمال محظور حتى اكتمال معايير التسليم.":"Completion blocked until delivery criteria are met."),true);render();return false}
 const next=status===null?latest.filter(x=>x.id!==id):result.items;
 if(!save(next)){items=latest;show(lang==="ar"?"تعذر الحفظ؛ لم تُنفذ العملية. أعد المحاولة.":"Storage failed; operation was not applied. Try again.",true);render();return false}
 items=next;
 if(status===null&&editingId===id)cancelEdit();
 show(lang==="ar"?"تم حفظ العملية محلياً.":"Operation saved locally.");render();return true;
}
rows.addEventListener("click",e=>{const editId=e.target.dataset.editId;if(editId){const item=items.find(x=>x.id===editId);if(!item)return;editingId=editId;editingSnapshot={...item};for(const name of ["reference","type","stage","status","targetDate","tasksTotal","tasksDone","notes"])form.elements.namedItem(name).value=item[name];for(const name of ["acceptanceReady","securityReviewed","bilingualReviewed"])form.elements.namedItem(name).checked=item[name]===true;document.getElementById("cancel-edit").hidden=false;form.elements.namedItem("reference").focus();return}const id=e.target.dataset.deleteId;if(!id)return;const item=items.find(x=>x.id===id);if(!item)return;const question=lang==="ar"?`هل تريد حذف المشروع ${item.reference} من السجل المحلي؟ لا يمكن التراجع عن الحذف.`:`Delete project ${item.reference} from this local register? This cannot be undone.`;if(!window.confirm(question))return;changeStoredProject(id,null)});for(const id of ["search","filter-type","filter-status"])document.getElementById(id).addEventListener(id==="search"?"input":"change",render);document.getElementById("language").addEventListener("click",()=>{lang=lang==="ar"?"en":"ar";try{localStorage.setItem(languageKey,lang)}catch{}applyLanguage()});function cancelEdit(){editingId=null;form.reset();document.getElementById("cancel-edit").hidden=true;form.querySelectorAll("[aria-invalid]").forEach(n=>n.removeAttribute("aria-invalid"));message.hidden=true}document.getElementById("cancel-edit").addEventListener("click",cancelEdit);applyLanguage();


// Other tabs may update the same local register while this board remains open.
// Refresh the displayed snapshot without writing back or discarding an edit form.
if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("storage",event=>{
 if(event.key===languageKey||event.key===null){
  const next=event.newValue==="en"?"en":"ar";
  if(next!==lang){lang=next;applyLanguage()}
  if(event.key===languageKey)return;
 }
 if(event.key!==key&&event.key!==null)return;
 try{
  const parsed=event.newValue===null?[]:JSON.parse(event.newValue);
  if(!Array.isArray(parsed))throw Error("Invalid register");
  const latest=safeProjects(parsed);
  if(latest.length!==parsed.length)throw Error("Incomplete register");
  items=latest;
  render();
  if(editingId)show(lang==="ar"?"تغيّر سجل المشاريع في نافذة أخرى. احتفظ بتعديلاتك وراجع أحدث البيانات قبل الحفظ.":"Projects changed in another tab. Keep your edits and review the latest records before saving.",true);
 }catch{
  show(lang==="ar"?"تغيّر التخزين في نافذة أخرى لكن السجل غير صالح؛ لم تُستبدل البيانات المعروضة.":"Storage changed in another tab but the register is invalid; displayed records were preserved.",true);
 }
});


// Explicit, local-only handoff of the delivery board when Soft moves to a
// separate hosting origin. Never submit a backup to an external endpoint.
function latestProjectsForBackup(){
 const raw=localStorage.getItem(key);
 const parsed=raw===null?[]:JSON.parse(raw);
 if(!Array.isArray(parsed))throw Error("Invalid register");
 const latest=safeProjects(parsed);
 if(latest.length!==parsed.length)throw Error("Incomplete register");
 return {raw,latest};
}
document.getElementById("export-projects").addEventListener("click",()=>{
 let url=null;
 try{
  const {latest}=latestProjectsForBackup();
  if(!latest.length){show(lang==="ar"?"لا توجد مشاريع صالحة لتصديرها.":"No saved projects to export.",true);return}
  const backup=exportProjectBackup(latest);
  const blob=new Blob([backup],{type:"application/json;charset=utf-8"});
  url=URL.createObjectURL(blob);
  const download=document.createElement("a");
  download.href=url;
  download.download="zarzour-soft-projects-"+localToday()+".json";
  document.body.append(download);
  download.click();
  download.remove();
  show(lang==="ar"?"تم تجهيز نسخة احتياطية محلية؛ لا تُرسل لأي خادم.":"Local backup prepared; no data was sent to a server.");
 }catch{
  show(lang==="ar"?"تعذر تصدير سجل المشاريع؛ لم تتغير البيانات.":"Could not export project register; data was unchanged.",true);
 }finally{if(url!==null)URL.revokeObjectURL(url)}
});
const importFile=document.getElementById("import-project-file");
let importBusy=false,importMode="replace";
document.getElementById("import-projects").addEventListener("click",()=>{if(!importBusy){importMode="replace";importFile.click()}});
document.getElementById("merge-projects")?.addEventListener("click",()=>{if(!importBusy){importMode="merge";importFile.click()}});
importFile.addEventListener("change",async()=>{
 if(importBusy)return;
 const file=importFile.files?.[0];
 if(!file)return;
 importBusy=true;
 try{
  if(file.size>PROJECT_BACKUP_MAX_BYTES)throw Error("File too large");
  const restored=importProjectBackup(await file.text());
  const {raw,latest}=latestProjectsForBackup();
  if(importMode==="merge"){
   const merged=mergeProjectBackup(latest,restored);
   if(!merged.added){show(lang==="ar"?"لا توجد مشاريع جديدة؛ السجل لم يتغير.":"No new projects; register unchanged.");return}
   const question=lang==="ar"?"إضافة "+merged.added+" مشروعاً دون استبدال السجلات الحالية؟":"Add "+merged.added+" projects without replacing existing records?";
   if(!window.confirm(question))return;
   if(localStorage.getItem(key)!==raw){show(lang==="ar"?"تغير السجل في نافذة أخرى؛ لم يُنفذ الدمج.":"Register changed in another tab; merge cancelled.",true);return}
   if(!save(merged.items,true))return;
   items=merged.items;
   render();
   show(lang==="ar"?"تم دمج "+merged.added+" مشروعاً دون حذف السجلات الحالية.":"Merged "+merged.added+" projects without deleting existing records.");
   return;
  }
  const warning=lang==="ar"
   ?"سيُستبدل سجل مشاريع زرزور سوفت المحلي بالكامل بـ "+restored.length+" مشروعاً من الملف. لا يمكن التراجع. هل تريد المتابعة؟"
   :"Replace the entire local Zarzour Soft project register with "+restored.length+" projects from this file? This cannot be undone. Continue?";
  if(!window.confirm(warning))return;
  // A second tab may have written new records while the confirmation was open.
  if(localStorage.getItem(key)!==raw){
   show(lang==="ar"?"تغير السجل في نافذة أخرى. لم تُستورد النسخة؛ راجع أحدث البيانات.":"The register changed in another tab. Import was cancelled to protect newer records.",true);
   return;
  }
  if(!save(restored,true))return;
  items=restored;
  if(editingId)cancelEdit();
  render();
  show(lang==="ar"?"تم استيراد "+restored.length+" مشروعاً محلياً بعد التحقق والتأكيد.":"Imported "+restored.length+" verified local projects.");
 }catch{
  show(lang==="ar"?"ملف النسخة الاحتياطية غير صالح، أو غير متاح، أو تجاوز الحد المسموح. لم تتغير المشاريع.":"Backup is invalid, unavailable or too large. Existing projects were not changed.",true);
 }finally{importBusy=false;importFile.value=""}
});
