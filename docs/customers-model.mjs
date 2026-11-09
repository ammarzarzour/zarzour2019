export const services=["travel","tourism","visa","hajj","umrah"];
export const sources=["direct","website","referral","partner","campaign"];
export const stages=["inquiry","qualified","documents","booked","completed","archived"];

const validDate=value=>{
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split("-").map(Number),date=new Date(Date.UTC(year,month-1,day));
  return year>=2000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
};

export function validateLead(input){
  const errors=[];
  if(typeof input.reference!=="string"||input.reference.trim().length<2||input.reference.trim().length>40)errors.push("reference");
  if(!services.includes(input.service))errors.push("service");
  if(!sources.includes(input.source))errors.push("source");
  if(!stages.includes(input.stage))errors.push("stage");
  if(input.followUp&&!validDate(input.followUp))errors.push("followUp");
  if(typeof input.notes!=="string"||input.notes.length>240)errors.push("notes");
  return errors;
}

export function normalizeLead(input,id=`lead-${Date.now()}`){
  return {id,reference:input.reference.trim(),service:input.service,source:input.source,stage:input.stage,followUp:input.followUp||"",notes:input.notes.trim()};
}

export function safeLeads(value){
  if(!Array.isArray(value))return [];
  const seen=new Set(),result=[];
  for(const item of value){
    if(!item||typeof item!=="object"||Array.isArray(item)||typeof item.id!=="string"||!item.id.trim()||seen.has(item.id)||validateLead(item).length)continue;
    seen.add(item.id);result.push(normalizeLead(item,item.id));
  }
  return result;
}

export function leadMetrics(leads,today){
  const active=leads.filter(item=>!["completed","archived"].includes(item.stage));
  return {total:leads.length,active:active.length,documents:leads.filter(item=>item.stage==="documents").length,booked:leads.filter(item=>item.stage==="booked").length,completed:leads.filter(item=>item.stage==="completed").length,overdue:active.filter(item=>item.followUp&&item.followUp<today).length,dueToday:active.filter(item=>item.followUp===today).length};
}

export function filterLeads(leads,{query="",service="",stage=""}={}){
  const needle=query.trim().toLocaleLowerCase();
  return leads.filter(item=>(!service||item.service===service)&&(!stage||item.stage===stage)&&(!needle||item.reference.toLocaleLowerCase().includes(needle)||item.notes.toLocaleLowerCase().includes(needle)));
}

export function upsertLead(leads,input,id){
  const errors=validateLead(input);
  if(errors.length)return {errors,items:leads};
  const item=normalizeLead(input,id);
  if(leads.some(existing=>existing.id!==id&&existing.reference.trim().toUpperCase()===item.reference.toUpperCase()))return {errors:["duplicateReference"],items:leads};
  return {errors:[],items:leads.some(existing=>existing.id===id)?leads.map(existing=>existing.id===id?item:existing):[item,...leads]};
}
