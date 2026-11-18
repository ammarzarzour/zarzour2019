/** Offline return-tracking rules; no database, PII or payment operations. */
export const RETURN_STATES=Object.freeze(['planned','departed','return_due','returned','follow_up']);
const NEXT={planned:['departed'],departed:['return_due','returned'],return_due:['returned','follow_up'],follow_up:['returned'],returned:[]};
export function validIsoDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=value.split('-').map(Number);
 if(y<2000||y>9999)return false;
 const date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function evaluateReturnStatus({status,expectedReturn,actualReturn=null},today){
 if(!RETURN_STATES.includes(status))return {ok:false,reason:'invalid_status'};
 if(!validIsoDate(expectedReturn)||!validIsoDate(today))return {ok:false,reason:'invalid_date'};
 if(actualReturn!==null&&!validIsoDate(actualReturn))return {ok:false,reason:'invalid_actual_return'};
 if(status==='returned'&&actualReturn===null)return {ok:false,reason:'missing_actual_return'};
 if(status!=='returned'&&actualReturn!==null)return {ok:false,reason:'unexpected_actual_return'};
 const overdue=status!=='returned'&&status!=='planned'&&today>expectedReturn;
 return {ok:true,status,overdue,suggestedStatus:overdue&&status==='departed'?'return_due':status};
}
export function validateReturnTransition(from,to,{expectedReturn,actualReturn=null,today}={}){
 if(!RETURN_STATES.includes(from)||!RETURN_STATES.includes(to))return {ok:false,reason:'invalid_status'};
 if(!NEXT[from].includes(to))return {ok:false,reason:'invalid_transition'};
 if(!validIsoDate(today)||!validIsoDate(expectedReturn))return {ok:false,reason:'invalid_date'};
 if(to==='returned'&&(!validIsoDate(actualReturn)||actualReturn>today))return {ok:false,reason:'invalid_actual_return'};
 if(to!=='returned'&&actualReturn!==null)return {ok:false,reason:'unexpected_actual_return'};
 if(to==='return_due'&&today<=expectedReturn)return {ok:false,reason:'not_overdue'};
 return {ok:true};
}
