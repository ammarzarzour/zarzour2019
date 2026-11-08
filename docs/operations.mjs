import { calculateMetrics, filterPrograms, normalizeProgram, programReadiness, safePrograms, validateProgram } from "./operations-model.mjs";

const storageKey = "zarzour-operations-programs-v1";
const languageKey = "zarzour-language";
const today = new Date().toISOString().slice(0, 10);
const demoPrograms = [
  {id:"demo-umrah",service:"umrah",destination:"مكة والمدينة",departure:"2099-02-15",capacity:48,reserved:31,status:"documents",contractReady:true,partnerVerified:true,documentsReady:false,returnPlanReady:true},
  {id:"demo-tour",service:"tourism",destination:"دمشق ومعلولا",departure:"2099-03-08",capacity:24,reserved:18,status:"ready",contractReady:true,partnerVerified:true,documentsReady:true,returnPlanReady:true},
  {id:"demo-visa",service:"visa",destination:"طلبات تأشيرات",departure:"2099-01-25",capacity:80,reserved:44,status:"planning",contractReady:false,partnerVerified:true,documentsReady:false,returnPlanReady:false}
];
const words = {
  ar:{travel:"سفر",tourism:"سياحة",visa:"تأشيرات",hajj:"حج",umrah:"عمرة",planning:"تخطيط",documents:"تجهيز الوثائق",ready:"جاهز",active:"قيد التنفيذ",completed:"مكتمل",empty:"لا توجد برامج مطابقة.",delete:"حذف",stored:"تم حفظ البرنامج على هذا الجهاز فقط.",reset:"تمت استعادة البيانات التجريبية.",invalid:"راجع الحقول المحددة: ",service:"الخدمة",destination:"الوجهة",departure:"تاريخ الانطلاق",capacity:"السعة",reserved:"المحجوز",status:"الحالة",contractReady:"العقد",partnerVerified:"الشريك الموثق",documentsReady:"الوثائق",returnPlanReady:"خطة العودة",complete:"مكتمل"},
  en:{travel:"Travel",tourism:"Tourism",visa:"Visas",hajj:"Hajj",umrah:"Umrah",planning:"Planning",documents:"Documents",ready:"Ready",active:"Active",completed:"Completed",empty:"No matching programs.",delete:"Delete",stored:"Program saved on this device only.",reset:"Demo data restored.",invalid:"Review these fields: ",service:"service",destination:"destination",departure:"departure",capacity:"capacity",reserved:"reserved",status:"status",contractReady:"contract",partnerVerified:"verified partner",documentsReady:"documents",returnPlanReady:"return plan",complete:"complete"}
};
let lang;
try { lang = localStorage.getItem(languageKey); } catch {}
if (!['ar','en'].includes(lang)) lang = (navigator.language || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
let programs = loadPrograms();

const form = document.getElementById("program-form");
const tbody = document.getElementById("programs-body");
const message = document.getElementById("message");
const fields = ["service","destination","departure","capacity","reserved","status"];
document.getElementById("departure").min = today;

function loadPrograms() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return demoPrograms.map((item) => ({...item}));
    return safePrograms(JSON.parse(raw), today);
  } catch { return demoPrograms.map((item) => ({...item})); }
}
function savePrograms() { try { localStorage.setItem(storageKey, JSON.stringify(programs)); } catch {} }
function t(key) { return words[lang][key] || key; }
function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-ar][data-en]").forEach((node) => { node.textContent = node.dataset[lang]; });
  document.querySelectorAll("[data-ar-placeholder][data-en-placeholder]").forEach((node) => { node.placeholder = node.dataset[`${lang}Placeholder`]; });
  document.getElementById("language").textContent = lang === "ar" ? "English" : "العربية";
  render();
}
function currentFilters() {
  return {query:document.getElementById("search").value,service:document.getElementById("filter-service").value,status:document.getElementById("filter-status").value};
}
function render() {
  const metrics = calculateMetrics(programs, today);
  for (const [key, value] of Object.entries(metrics)) document.getElementById(`metric-${key}`).textContent = key === "utilization" ? `${value}%` : value;
  const visible = filterPrograms(programs, currentFilters());
  tbody.replaceChildren();
  if (!visible.length) {
    const row = document.createElement("tr"); const cell = document.createElement("td");
    cell.colSpan = 8; cell.className = "empty"; cell.textContent = t("empty"); row.append(cell); tbody.append(row); return;
  }
  for (const item of visible) {
    const row = document.createElement("tr");
    const readiness=programReadiness(item); const readinessText=readiness.blockers.length ? `${readiness.score}% · ${readiness.blockers.map(t).join(lang==="ar"?"، ":", ")}` : `100% · ${t("complete")}`;
    const values = [t(item.service), item.destination, item.departure, `${item.reserved} / ${item.capacity}`, `${Math.round(item.reserved / item.capacity * 100)}%`, readinessText, t(item.status)];
    values.forEach((value) => { const cell=document.createElement("td"); cell.textContent=value; row.append(cell); });
    const action=document.createElement("td"); const button=document.createElement("button"); button.type="button"; button.className="delete"; button.textContent=t("delete"); button.dataset.id=item.id; action.append(button); row.append(action); tbody.append(row);
  }
}
function setMessage(text, error=false) { message.textContent=text; message.className=error?"message error":"message"; message.hidden=false; }

document.getElementById("language").addEventListener("click",()=>{lang=lang==="ar"?"en":"ar";try{localStorage.setItem(languageKey,lang)}catch{}applyLanguage();});
for (const id of ["search","filter-service","filter-status"]) document.getElementById(id).addEventListener(id==="search"?"input":"change",render);
tbody.addEventListener("click",(event)=>{const id=event.target.dataset.id;if(!id)return;programs=programs.filter((item)=>item.id!==id);savePrograms();render();});
document.getElementById("reset-demo").addEventListener("click",()=>{programs=demoPrograms.map((item)=>({...item}));savePrograms();setMessage(t("reset"));render();});
form.addEventListener("input",()=>{message.hidden=true;fields.forEach((id)=>document.getElementById(id).removeAttribute("aria-invalid"));});
form.addEventListener("submit",(event)=>{
  event.preventDefault(); const input=Object.fromEntries(new FormData(form)); const errors=validateProgram(input,today);
  if(errors.length){errors.forEach((id)=>document.getElementById(id).setAttribute("aria-invalid","true"));setMessage(t("invalid")+errors.map(t).join(lang==="ar"?"، ":", "),true);document.getElementById(errors[0]).focus();return;}
  programs.unshift(normalizeProgram(input,`program-${Date.now()}-${Math.random().toString(36).slice(2,8)}`));savePrograms();form.reset();document.getElementById("departure").min=today;setMessage(t("stored"));render();
});
applyLanguage();
