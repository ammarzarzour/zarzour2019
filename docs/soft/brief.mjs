import { assessScope, briefSummary, validateBrief } from "./brief-model.mjs";

const languageKey="zarzour-soft-language",draftKey="zarzour-soft-brief-v1";
let lang;try{lang=localStorage.getItem(languageKey)}catch{}
if(!["ar","en"].includes(lang))lang=(navigator.language||"ar").toLowerCase().startsWith("en")?"en":"ar";
const form=document.getElementById("brief-form"),result=document.getElementById("result"),summary=document.getElementById("summary"),error=document.getElementById("error");
const messages={ar:{invalid:"راجع الحقول المحددة وأكمل وحدة واحدة على الأقل.",saved:"تم إعداد النطاق وحفظ المسودة على جهازك.",foundation:"نطاق تأسيسي",standard:"نطاق متوسط",advanced:"نطاق متقدم"},en:{invalid:"Review the highlighted fields and select at least one module.",saved:"Scope prepared and draft saved on your device.",foundation:"Foundation scope",standard:"Standard scope",advanced:"Advanced scope"}};

function applyLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ar][data-en]").forEach(n=>n.textContent=n.dataset[lang]);document.getElementById("language-toggle").textContent=lang==="ar"?"English":"العربية";if(!result.hidden)build();}
function input(){const data=Object.fromEntries(new FormData(form));data.modules=[...form.querySelectorAll('input[name="modules"]:checked')].map(n=>n.value);return data;}
function mark(errors){for(const id of ["name","type","goal","language","phase","modules"]){const node=document.getElementById(id);node?.toggleAttribute("data-invalid",errors.includes(id));}}
function build(){const data=input(),errors=validateBrief(data);mark(errors);if(errors.length){error.textContent=messages[lang].invalid;error.hidden=false;result.hidden=true;return false;}const assessment=assessScope(data);document.getElementById("level").textContent=messages[lang][assessment.level];summary.textContent=briefSummary(data,lang);error.hidden=true;result.hidden=false;try{localStorage.setItem(draftKey,JSON.stringify(data))}catch{}return true;}
function restore(){try{const draft=JSON.parse(localStorage.getItem(draftKey));if(!draft)return;for(const id of ["name","type","goal","language","phase"])if(draft[id]!=null)form.elements[id].value=draft[id];for(const box of form.querySelectorAll('input[name="modules"]'))box.checked=draft.modules?.includes(box.value);}catch{}}
document.getElementById("language-toggle").addEventListener("click",()=>{lang=lang==="ar"?"en":"ar";try{localStorage.setItem(languageKey,lang)}catch{}applyLanguage();});
function updateDraft(){error.hidden=true;result.hidden=true;summary.textContent="";mark([]);try{localStorage.setItem(draftKey,JSON.stringify(input()))}catch{}}
form.addEventListener("input",updateDraft);
form.addEventListener("change",updateDraft);
form.addEventListener("submit",event=>{event.preventDefault();build();});
document.getElementById("download").addEventListener("click",()=>{if(!build())return;const blob=new Blob(["\ufeff"+summary.textContent],{type:"text/plain;charset=utf-8"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=lang==="ar"?"نطاق-المشروع.txt":"project-scope.txt";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);});
document.getElementById("clear").addEventListener("click",()=>{form.reset();result.hidden=true;error.hidden=true;try{localStorage.removeItem(draftKey)}catch{}});
restore();applyLanguage();
