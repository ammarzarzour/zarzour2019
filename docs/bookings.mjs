import { bookingMetrics, bookingReadiness, filterBookings, normalizeBooking, safeBookings, validateBooking, upsertBooking } from "./bookings-model.mjs";
const storageKey="zarzour-bookings-v1",languageKey="zarzour-language";let lang;try{lang=localStorage.getItem(languageKey)}catch{}if(!["ar","en"].includes(lang))lang=(navigator.language||"ar").toLowerCase().startsWith("en")?"en":"ar";
const words={ar:{flight:"تذاكر طيران",hotel:"فندق",transport:"نقل",tour:"برنامج سياحي",umrah:"عمرة",hajj:"حج",inquiry:"استفسار",hold:"حجز مبدئي",confirmed:"مؤكد",in_service:"قيد التنفيذ",completed:"مكتمل",cancelled:"ملغى",supplierReference:"مرجع المورد",supplierConfirmed:"تأكيد المورد",documentsChecked:"المستندات",itineraryIssued:"إصدار البرنامج",empty:"لا توجد حجوزات مطابقة.",edit:"تعديل",cancelEdit:"إلغاء التعديل",duplicate:"المرجع مستخدم في حجز آخر.",delete:"حذف",ready:"جاهز",blocked:"نواقص",saved:"تم حفظ الحجز على هذا الجهاز فقط.",invalid:"راجع الحقول المطلوبة والتواريخ وعدد المسافرين."},en:{flight:"Flight",hotel:"Hotel",transport:"Transport",tour:"Tour",umrah:"Umrah",hajj:"Hajj",inquiry:"Inquiry",hold:"On hold",confirmed:"Confirmed",in_service:"In service",completed:"Completed",cancelled:"Cancelled",supplierReference:"Supplier reference",supplierConfirmed:"Supplier confirmation",documentsChecked:"Documents",itineraryIssued:"Issued itinerary",empty:"No matching bookings.",edit:"Edit",cancelEdit:"Cancel edit",duplicate:"Reference already exists in another booking.",delete:"Delete",ready:"Ready",blocked:"Missing",saved:"Booking saved on this device only.",invalid:"Review required fields, dates and traveler count."}};
let editingId=null,editingSnapshot=null;let bookings=load();const form=document.getElementById("booking-form"),body=document.getElementById("booking-body"),message=document.getElementById("message");
function t(key){return words[lang][key]||key}
function error(text){message.textContent=text;message.className="message error";message.hidden=false}
function readLatest(){
 const raw=localStorage.getItem(storageKey),parsed=raw===null?[]:JSON.parse(raw);
 if(!Array.isArray(parsed))throw new Error("Invalid booking register");
 const latest=safeBookings(parsed);
 if(latest.length!==parsed.length)throw new Error("Incomplete booking register");
 return latest;
}
function load(){try{return readLatest()}catch{return[]}}
function save(next){try{localStorage.setItem(storageKey,JSON.stringify(next));bookings=next;return true}catch{error(lang==="ar"?"تعذر الحفظ المحلي؛ بقيت المدخلات متاحة للمحاولة مجدداً.":"Local storage failed; inputs remain available to retry.");return false}}
function showStoreError(){error(lang==="ar"?"سجل الحجوزات غير صالح أو غير متاح. لم تُحفظ التغييرات.":"Booking register is invalid or unavailable. Changes were not saved.")}
function showConflict(){error(lang==="ar"?"تغيّر الحجز أو حُذف في نافذة أخرى. راجع أحدث نسخة قبل إعادة المحاولة.":"Booking changed or was deleted in another tab. Review the latest version before retrying.")}function filters(){return{query:document.getElementById("search").value,service:document.getElementById("filter-service").value,status:document.getElementById("filter-status").value}}function applyLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ar][data-en]").forEach(node=>node.textContent=node.dataset[lang]);document.querySelectorAll("[data-ar-placeholder][data-en-placeholder]").forEach(node=>node.placeholder=node.dataset[`${lang}Placeholder`]);document.getElementById("language").textContent=lang==="ar"?"English":"العربية";render()}
function render(){if(typeof cancel!=="undefined")cancel.textContent=t("cancelEdit");const metrics=bookingMetrics(bookings,new Date().toISOString().slice(0,10));for(const[key,value]of Object.entries(metrics)){const node=document.getElementById(`metric-${key}`);if(node)node.textContent=value}body.replaceChildren();const visible=filterBookings(bookings,filters());if(!visible.length){const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=9;cell.className="empty";cell.textContent=t("empty");row.append(cell);body.append(row);return}for(const item of visible){const readiness=bookingReadiness(item),row=document.createElement("tr"),values=[item.reference,t(item.service),t(item.status),item.travelers,item.startDate,item.endDate,item.supplierReference||"—",readiness.ready?t("ready"):`${t("blocked")}: ${readiness.blockers.map(t).join(lang==="ar"?"، ":", ")}`];for(const value of values){const cell=document.createElement("td");cell.textContent=value;row.append(cell)}const action=document.createElement("td"),button=document.createElement("button");button.type="button";button.className="delete";button.dataset.id=item.id;button.textContent=t("delete");const edit=document.createElement("button");edit.type="button";edit.dataset.editId=item.id;edit.textContent=t("edit");action.append(edit,button);row.append(action);body.append(row)}}

const cancel=document.createElement("button");cancel.type="button";cancel.hidden=true;form.append(cancel);
function stopEditing(){editingId=null;editingSnapshot=null;form.reset();cancel.hidden=true;}
cancel.addEventListener("click",stopEditing);
form.addEventListener("submit",event=>{
 event.preventDefault();const data=Object.fromEntries(new FormData(form));
 let latest;
 try{latest=readLatest()}catch{showStoreError();return}
 const id=editingId||`booking-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
 const result=upsertBooking(latest,data,id,editingId?editingSnapshot:undefined);
 message.hidden=false;
 if(result.errors.length){
   bookings=latest;
   if(result.errors.includes("conflict"))showConflict();
   else if(result.errors.includes("bookingStore"))showStoreError();
   else if(result.errors.includes("duplicateId"))error(lang==="ar"?"معرّف الحجز مستخدم؛ لم يُستبدل الحجز الموجود.":"Booking ID already exists; existing booking was not overwritten.");
   else if(result.errors.includes("duplicateReference"))error(t("duplicate"));
   else error(t("invalid"));
   render();return;
 }
 if(!save(result.items)){bookings=latest;render();return}
 message.textContent=t("saved");message.className="message success";
 stopEditing();render();
});
body.addEventListener("click",event=>{
 const editId=event.target.dataset.editId;
 if(editId){
  const item=bookings.find(item=>item.id===editId);if(!item)return;
  editingId=editId;editingSnapshot={...item};
  for(const field of form.elements){if(!field.name)continue;if(field.type==="checkbox")field.checked=item[field.name]===true;else field.value=item[field.name]??"";}
  cancel.textContent=t("cancelEdit");cancel.hidden=false;form.scrollIntoView({behavior:"smooth",block:"start"});return;
 }
 const id=event.target.dataset.id;if(!id)return;
 const expected=bookings.find(item=>item.id===id);if(!expected)return;
 const question=lang==="ar"?"هل تريد حذف هذا الحجز المحلي؟ لا يمكن التراجع عن الحذف.":"Delete this local booking? This cannot be undone.";
 if(!window.confirm(question))return;
 let latest;
 try{latest=readLatest()}catch{showStoreError();return}
 const current=latest.find(item=>item.id===id);
 if(!current||JSON.stringify(current)!==JSON.stringify(expected)){bookings=latest;showConflict();render();return}
 const next=latest.filter(item=>item.id!==id);
 if(!save(next)){bookings=latest;render();return}
 if(editingId===id)stopEditing();
 message.textContent=lang==="ar"?"حُذف الحجز المحلي.":"Local booking deleted.";
 message.className="message success";message.hidden=false;render();
});
for(const id of["search","filter-service","filter-status"]){document.getElementById(id).addEventListener("input",render);document.getElementById(id).addEventListener("change",render)}document.getElementById("language").addEventListener("click",()=>{lang=lang==="ar"?"en":"ar";try{localStorage.setItem(languageKey,lang)}catch{}applyLanguage()});
if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("storage",event=>{
 if(event.storageArea&&event.storageArea!==localStorage)return;
 if(event.key!==storageKey&&event.key!==null)return;
 try{
  bookings=readLatest();render();
  if(editingId)showConflict();
 }catch{showStoreError()}
});
applyLanguage();

