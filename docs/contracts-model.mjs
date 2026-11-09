export const contractTypes=["pilgrim_group","partner","agency","supplier","guarantor"];
export const scopes=["travel","tourism","visa","hajj","umrah","multi_service"];
export const statuses=["draft","review","approved","active","completed","cancelled"];
const validDate=value=>{if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split("-").map(Number),date=new Date(Date.UTC(y,m-1,d));return y>=2000&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d};
export function validateContract(input){
 const errors=[];
 if(typeof input.reference!=="string"||input.reference.trim().length<2||input.reference.trim().length>40)errors.push("reference");
 if(!contractTypes.includes(input.type))errors.push("type");
 if(!scopes.includes(input.scope))errors.push("scope");
 if(!statuses.includes(input.status))errors.push("status");
 if(!validDate(input.startDate))errors.push("startDate");
 if(input.endDate&&!validDate(input.endDate))errors.push("endDate");
 if(validDate(input.startDate)&&validDate(input.endDate)&&input.endDate<input.startDate)errors.push("endDate");
 if(typeof input.notes!=="string"||input.notes.length>240)errors.push("notes");
 return errors;
}
export function normalizeContract(input,id="contract-"+Date.now()){
 return {id,reference:input.reference.trim(),type:input.type,scope:input.scope,status:input.status,startDate:input.startDate,endDate:input.endDate||"",returnResponsibility:input.returnResponsibility===true||input.returnResponsibility==="on",guaranteeReady:input.guaranteeReady===true||input.guaranteeReady==="on",penaltyReviewed:input.penaltyReviewed===true||input.penaltyReviewed==="on",notes:input.notes.trim()};
}
export function contractReadiness(item){
 const required=item.type==="pilgrim_group"?["returnResponsibility","guaranteeReady","penaltyReviewed"]:item.type==="guarantor"?["guaranteeReady"]:["penaltyReviewed"];
 const blockers=required.filter(field=>item[field]!==true);
 return {required,blockers,score:Math.round(((required.length-blockers.length)/required.length)*100)};
}
export function safeContracts(value){
 if(!Array.isArray(value))return [];const seen=new Set(),result=[];
 for(const item of value){if(!item||typeof item!=="object"||Array.isArray(item)||typeof item.id!=="string"||!item.id.trim()||seen.has(item.id)||validateContract(item).length)continue;seen.add(item.id);result.push(normalizeContract(item,item.id))}
 return result;
}
export function contractMetrics(items,today){
 const live=items.filter(x=>["approved","active"].includes(x.status));
 const plus30=new Date(Date.parse(today+"T00:00:00Z")+30*86400000).toISOString().slice(0,10);
 return {total:items.length,review:items.filter(x=>x.status==="review").length,active:items.filter(x=>x.status==="active").length,blocked:live.filter(x=>contractReadiness(x).blockers.length>0).length,expired:live.filter(x=>x.endDate&&x.endDate<today).length,expiring:live.filter(x=>x.endDate&&x.endDate>=today&&x.endDate<=plus30).length,completed:items.filter(x=>x.status==="completed").length};
}
export function filterContracts(items,{query="",type="",status="",attention="",today=""}={}){
 const needle=query.trim().toLocaleLowerCase();return items.filter(x=>(!attention||contractAttention(x,today).includes(attention))&&(!type||x.type===type)&&(!status||x.status===status)&&(!needle||x.reference.toLocaleLowerCase().includes(needle)||x.notes.toLocaleLowerCase().includes(needle)));
}

export function upsertContract(items,input,id,expected) {
 if(expected!==undefined){const current=items.find(item=>item.id===id);if(!current||JSON.stringify(normalizeContract(current,id))!==JSON.stringify(normalizeContract(expected,id)))return {errors:["conflict"],items};}
 const errors=validateContract(input);
 if(errors.length) return {errors,items};
 const item=normalizeContract(input,id);
 if(items.some(existing=>existing.id!==id&&existing.reference.trim().toUpperCase()===item.reference.toUpperCase())) return {errors:["duplicateReference"],items};
 if(["approved","active"].includes(item.status)&&contractReadiness(item).blockers.length) return {errors:["obligations"],items};
 return {errors:[],items:items.some(existing=>existing.id===id)?items.map(existing=>existing.id===id?item:existing):[item,...items]};
}

export function contractAttention(item,today){
 if(!["approved","active"].includes(item.status))return [];
 const alerts=[];
 if(contractReadiness(item).blockers.length)alerts.push("blocked");
 if(item.endDate&&item.endDate<today)alerts.push("expired");
 const limit=new Date(Date.parse(today+"T00:00:00Z")+30*86400000).toISOString().slice(0,10);
 if(item.endDate&&item.endDate>=today&&item.endDate<=limit)alerts.push("expiring");
 return alerts;
}
