import {validateRequest,requestSummary} from './request-model.mjs';
let language='ar';
try {language=localStorage.getItem('zarzour-language') || (navigator.language.toLowerCase().startsWith('en')?'en':'ar');} catch {language=navigator.language.toLowerCase().startsWith('en')?'en':'ar';}
if(!['ar','en'].includes(language))language='ar';
const form=document.getElementById('request');
const summary=document.getElementById('summary');
const result=document.getElementById('result');
let reviewed=null;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
document.getElementById('departure').min=today();
const messages={
 ar:{service:'اختر نوع خدمة صالحاً.',destination:'أدخل وجهة من 1 إلى 120 حرفاً.',departure:'اختر تاريخ مغادرة صالحاً، اليوم أو بعده.',travelers:'أدخل عدداً صحيحاً من 1 إلى 200 مسافر.',notes:'يجب ألا تتجاوز المتطلبات 1000 حرف.',returnDate:'اختر تاريخ عودة صالحاً يساوي المغادرة أو يليها.'},
 en:{service:'Choose a valid service.',destination:'Enter a destination of 1 to 120 characters.',departure:'Choose a valid departure date, today or later.',travelers:'Enter a whole number from 1 to 200 travelers.',notes:'Trip requirements must not exceed 1000 characters.',returnDate:'Choose a valid return date on or after departure.'}
};
let fieldErrors=[];
function showErrors(){document.getElementById('error').textContent=fieldErrors.map(field=>messages[language][field]).join(' ');}
function apply(){
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
 document.querySelectorAll('[data-ar][data-en]').forEach(el=>el.textContent=el.dataset[language]);
 document.getElementById('language').textContent=language==='ar'?'English':'العربية';
 document.title=language==='ar'?'خطط رحلتك | زرزور':'Plan your trip | Zarzour';
 showErrors();
 if(reviewed)summary.textContent=requestSummary(reviewed,language);
}
document.getElementById('language').addEventListener('click',()=>{language=language==='ar'?'en':'ar';try{localStorage.setItem('zarzour-language',language);}catch{}apply();});
form.addEventListener('input',()=>{
 reviewed=null;result.hidden=true;summary.textContent='';
 fieldErrors=[];showErrors();
 document.getElementById('returnDate').min=document.getElementById('departure').value || today();
});
form.addEventListener('submit',event=>{event.preventDefault();const input=Object.fromEntries(new FormData(form));const errors=validateRequest(input,today());fieldErrors=errors;showErrors();if(errors.length){reviewed=null;result.hidden=true;summary.textContent='';document.getElementById(errors[0]).focus();return;}reviewed=input;document.getElementById('error').textContent='';summary.textContent=requestSummary(input,language);result.hidden=false;result.focus();});
document.getElementById('download').addEventListener('click',()=>{if(!reviewed)return;const blob=new Blob(['\uFEFF'+requestSummary(reviewed,language)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='zarzour-trip-request.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.getElementById('print').addEventListener('click',()=>{if(reviewed)window.print();});
apply();
