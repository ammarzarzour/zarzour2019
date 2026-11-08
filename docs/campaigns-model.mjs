export const services=["travel","tourism","visa","hajj","umrah","multi_service"];
export const channels=["website","social","whatsapp","email","partner","offline"];
export const statuses=["planned","active","paused","completed","cancelled"];
const validDate=value=>{if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split("-").map(Number),date=new Date(Date.UTC(y,m-1,d));return y>=2000&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d};
const integer=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=1000000;
export function validateCampaign(input){
 const errors=[];
 if(typeof input.reference!=="string"||input.reference.trim().length<2||input.reference.trim().length>50)errors.push("reference");
 if(!services.includes(input.service))errors.push("service");
 if(!channels.includes(input.channel))errors.push("channel");
 if(!statuses.includes(input.status))errors.push("status");
 if(!validDate(input.startDate))errors.push("startDate");
 if(!validDate(input.endDate)||validDate(input.startDate)&&input.endDate<input.startDate)errors.push("endDate");
 if(!integer(input.inquiries))errors.push("inquiries");
 if(!integer(input.qualified)||integer(input.inquiries)&&Number(input.qualified)>Number(input.inquiries))errors.push("qualified");
 if(typeof input.notes!=="string"||input.notes.length>240)errors.push("notes");
 return [...new Set(errors)];
}
export function normalizeCampaign(input,id="campaign-"+Date.now()){return {id,reference:input.reference.trim(),service:input.service,channel:input.channel,status:input.status,startDate:input.startDate,endDate:input.endDate,inquiries:Number(input.inquiries),qualified:Number(input.qualified),landingReady:input.landingReady===true||input.landingReady==="on",trackingReady:input.trackingReady===true||input.trackingReady==="on",contentReady:input.contentReady===true||input.contentReady==="on",notes:input.notes.trim()}}
export function campaignReadiness(item){const fields=["landingReady","trackingReady","contentReady"],blockers=fields.filter(x=>item[x]!==true);return {blockers,score:Math.round(((fields.length-blockers.length)/fields.length)*100)}}
export function safeCampaigns(value){if(!Array.isArray(value))return [];const seen=new Set(),out=[];for(const item of value){if(!item||typeof item!=="object"||Array.isArray(item)||typeof item.id!=="string"||!item.id.trim()||seen.has(item.id)||validateCampaign(item).length)continue;seen.add(item.id);out.push(normalizeCampaign(item,item.id))}return out}
export function campaignMetrics(items,today){const active=items.filter(x=>x.status==="active"),inquiries=items.reduce((n,x)=>n+x.inquiries,0),qualified=items.reduce((n,x)=>n+x.qualified,0);return {total:items.length,planned:items.filter(x=>x.status==="planned").length,active:active.length,blocked:active.filter(x=>campaignReadiness(x).blockers.length).length,completed:items.filter(x=>x.status==="completed").length,inquiries,conversion:inquiries?Math.round(qualified/inquiries*100):0,ending:active.filter(x=>x.endDate>=today&&x.endDate<=todayPlus(today,7)).length}}
const todayPlus=(today,days)=>new Date(Date.parse(today+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
export function filterCampaigns(items,{query="",service="",status=""}={}){const needle=query.trim().toLocaleLowerCase();return items.filter(x=>(!service||x.service===service)&&(!status||x.status===status)&&(!needle||x.reference.toLocaleLowerCase().includes(needle)||x.notes.toLocaleLowerCase().includes(needle)))}
