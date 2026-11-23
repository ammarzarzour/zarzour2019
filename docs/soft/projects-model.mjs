export const projectTypes=["website","mobile_app","internal_tool","automation"];export const stages=["discovery","design","build","validation","release","maintenance"];export const statuses=["planned","active","blocked","completed"];
const dateOk=v=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d));return y>=2000&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d};const count=v=>(typeof v==="number"||typeof v==="string"&&/^(0|[1-9]\d*)$/.test(v))&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=10000;
export function validateProject(input){if(!input||typeof input!=="object"||Array.isArray(input))return ["project"];const e=[];if(typeof input.reference!=="string"||input.reference.trim().length<2||input.reference.trim().length>50)e.push("reference");if(!projectTypes.includes(input.type))e.push("type");if(!stages.includes(input.stage))e.push("stage");if(!statuses.includes(input.status))e.push("status");if(!dateOk(input.targetDate))e.push("targetDate");if(!count(input.tasksTotal)||Number(input.tasksTotal)<1)e.push("tasksTotal");if(!count(input.tasksDone)||count(input.tasksTotal)&&Number(input.tasksDone)>Number(input.tasksTotal))e.push("tasksDone");if(typeof input.notes!=="string"||input.notes.length>240)e.push("notes");for(const flag of ["acceptanceReady","securityReviewed","bilingualReviewed"]){if(input[flag]!==undefined&&input[flag]!==true&&input[flag]!==false&&input[flag]!=="on")e.push(flag)}return [...new Set(e)]}
export function normalizeProject(input,id="soft-project-"+Date.now()){return {id,reference:input.reference.trim(),type:input.type,stage:input.stage,status:input.status,targetDate:input.targetDate,tasksTotal:Number(input.tasksTotal),tasksDone:Number(input.tasksDone),acceptanceReady:input.acceptanceReady===true||input.acceptanceReady==="on",securityReviewed:input.securityReviewed===true||input.securityReviewed==="on",bilingualReviewed:input.bilingualReviewed===true||input.bilingualReviewed==="on",notes:input.notes.trim()}}
export function deliveryReadiness(item){const fields=["acceptanceReady","securityReviewed","bilingualReviewed"],blockers=fields.filter(x=>item[x]!==true);if(item.tasksDone!==item.tasksTotal)blockers.push("tasksComplete");return {blockers,score:Math.round((4-blockers.length)/4*100)}}
export function safeProjects(value){if(!Array.isArray(value))return [];const seen=new Set(),references=new Set(),out=[];for(const item of value){if(!item||typeof item!=="object"||Array.isArray(item)||typeof item.id!=="string"||!item.id.trim()||item.id.length>120||seen.has(item.id)||validateProject(item).length)continue;const normalized=normalizeProject(item,item.id),reference=normalized.reference.toUpperCase();
// A completed project must satisfy the same release-readiness rule as a new edit.
// Otherwise a restored backup can display an incomplete project as completed.
if(normalized.status==="completed"&&deliveryReadiness(normalized).blockers.length)continue;
if(references.has(reference))continue;seen.add(item.id);references.add(reference);out.push(normalized)}return out}
export function localToday(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`}
const plus=(today,days)=>new Date(Date.parse(today+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
export function projectMetrics(items,today){const open=items.filter(x=>x.status!=="completed"||deliveryReadiness(x).blockers.length>0),taskTotal=items.reduce((n,x)=>n+x.tasksTotal,0),taskDone=items.reduce((n,x)=>n+x.tasksDone,0);return {total:items.length,active:items.filter(x=>x.status==="active").length,blocked:items.filter(x=>x.status==="blocked").length,overdue:open.filter(x=>x.targetDate<today).length,dueSoon:open.filter(x=>x.targetDate>=today&&x.targetDate<=plus(today,7)).length,releaseReady:items.filter(x=>["active","completed"].includes(x.status)&&["release","maintenance"].includes(x.stage)&&!deliveryReadiness(x).blockers.length).length,progress:taskTotal?Math.round(taskDone/taskTotal*100):0}}
export function filterProjects(items,{query="",type="",status=""}={}){const needle=query.trim().toLocaleLowerCase();return items.filter(x=>(!type||x.type===type)&&(!status||x.status===status)&&(!needle||x.reference.toLocaleLowerCase().includes(needle)||x.notes.toLocaleLowerCase().includes(needle)))}


// Require canonical, real UTC instants for portable backup metadata.
function validBackupTimestamp(value){
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(value))return false;
 const time=Date.parse(value);
 return Number.isFinite(time)&&new Date(time).toISOString()===value;
}
export const PROJECT_BACKUP_SCHEMA="zarzour-soft-projects";
export const PROJECT_BACKUP_MAX_BYTES=262144;
export const PROJECT_BACKUP_MAX_ITEMS=500;
function intactProjects(value){
 if(!Array.isArray(value)||value.length>PROJECT_BACKUP_MAX_ITEMS)return false;
 return safeProjects(value).length===value.length;
}
// A deterministic, portable export; never includes Travel data, browser tokens or credentials.
export function exportProjectBackup(items, exportedAt=new Date().toISOString()){
 if(!intactProjects(items)||items.length===0)throw new Error("Invalid or empty project register");
 if(!validBackupTimestamp(exportedAt))throw new Error("Invalid export timestamp");
 const text=JSON.stringify({schema:PROJECT_BACKUP_SCHEMA,version:1,exportedAt,projects:safeProjects(items)},null,2);
 if(new TextEncoder().encode(text).byteLength>PROJECT_BACKUP_MAX_BYTES)throw new Error("Project backup exceeds safe size");
 return text;
}
export function importProjectBackup(text){
 if(typeof text!=="string"||new TextEncoder().encode(text).byteLength>PROJECT_BACKUP_MAX_BYTES)throw new Error("Project backup exceeds safe size");
 let data;
 try{data=JSON.parse(text)}catch{throw new Error("Invalid project backup JSON")}
 if(!data||typeof data!=="object"||Array.isArray(data)||data.schema!==PROJECT_BACKUP_SCHEMA||data.version!==1||
    !validBackupTimestamp(data.exportedAt)||!Array.isArray(data.projects)||
    !["exportedAt","projects","schema","version"].every(key=>Object.hasOwn(data,key))||
    Object.keys(data).length!==4)throw new Error("Unsupported project backup format");
 if(data.projects.length===0||!intactProjects(data.projects))throw new Error("Invalid, empty or duplicated project backup");
 return safeProjects(data.projects);
}

export function upsertProject(items,input,id,expected){
 if(typeof id!=="string"||!id.trim()||id.length>120)return {errors:["projectId"],items};
 if(!Array.isArray(items)||items.some(x=>!x||typeof x!=="object"||Array.isArray(x)||typeof x.id!=="string"||!x.id.trim()||x.id.length>120||validateProject(x).length||(x.status==="completed"&&deliveryReadiness(normalizeProject(x,x.id)).blockers.length)))return {errors:["projectStore"],items};
 const ids=new Set(),references=new Set();
 for(const existing of items){const ref=existing.reference.trim().toUpperCase();if(ids.has(existing.id)||references.has(ref))return {errors:["projectStore"],items};ids.add(existing.id);references.add(ref);}
 if(expected!==undefined){const current=items.find(x=>x.id===id);if(!current||!expected||typeof expected!=="object"||expected.id!==id||validateProject(current).length||validateProject(expected).length||JSON.stringify(normalizeProject(current,id))!==JSON.stringify(normalizeProject(expected,id)))return {errors:["conflict"],items:items};}
 // A create operation must never silently overwrite an existing ID. Edits pass an expected snapshot.
 if(expected===undefined&&ids.has(id))return {errors:["duplicateId"],items};
 const errors=validateProject(input);if(errors.length)return {errors,items};
 const item=normalizeProject(input,id);
 if(items.some(x=>x.id!==id&&x.reference.trim().toUpperCase()===item.reference.toUpperCase()))return {errors:["duplicateReference"],items};
 if(item.status==="completed"&&deliveryReadiness(item).blockers.length)return {errors:["readiness"],items};
 return {errors:[],items:items.some(x=>x.id===id)?items.map(x=>x.id===id?item:x):[item,...items]};
}
