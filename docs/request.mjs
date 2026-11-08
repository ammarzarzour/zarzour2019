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
function apply(){
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
 document.querySelectorAll('[data-ar][data-en]').forEach(el=>el.textContent=el.dataset[language]);
 document.getElementById('language').textContent=language==='ar'?'English':'العربية';
 document.title=language==='ar'?'خطط رحلتك | زرزور':'Plan your trip | Zarzour';
 document.getElementById('error').textContent='';
 if(reviewed)summary.textContent=requestSummary(reviewed,language);
}
document.getElementById('language').addEventListener('click',()=>{language=language==='ar'?'en':'ar';try{localStorage.setItem('zarzour-language',language);}catch{}apply();});
form.addEventListener('input',()=>{reviewed=null;result.hidden=true;});
form.addEventListener('submit',event=>{event.preventDefault();const input=Object.fromEntries(new FormData(form));const errors=validateRequest(input,today());if(errors.length){document.getElementById('error').textContent=language==='ar'?'يرجى مراجعة الحقول والتاريخ وعدد المسافرين.':'Please review the fields, date and traveler count.';document.getElementById(errors[0]).focus();return;}reviewed=input;document.getElementById('error').textContent='';summary.textContent=requestSummary(input,language);result.hidden=false;result.focus();});
document.getElementById('download').addEventListener('click',()=>{if(!reviewed)return;const blob=new Blob(['\uFEFF'+requestSummary(reviewed,language)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='zarzour-trip-request.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.getElementById('print').addEventListener('click',()=>{if(reviewed)window.print();});
apply();
