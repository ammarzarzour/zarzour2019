export const partnerTypes=["company","agency","agent","transport","hotel"];
export const partnerScopes=["syrian","international"];
export const partnerServices=["travel","tourism","visa","hajj","umrah"];
export const verificationFields=["registrationChecked","contactChecked","serviceEvidenceChecked","agreementChecked"];

export function validatePartner(input){
  const errors=[];
  const name=String(input.legalName||"").trim(),country=String(input.country||"").trim();
  const services=Array.isArray(input.services)?input.services:[];
  if(!name||name.length>120)errors.push("legalName");
  if(!partnerTypes.includes(input.type))errors.push("type");
  if(!partnerScopes.includes(input.scope))errors.push("scope");
  if(!country||country.length>80)errors.push("country");
  if(!services.length||services.some(service=>!partnerServices.includes(service)))errors.push("services");
  return [...new Set(errors)];
}

export function normalizePartner(input,id=`partner-${Date.now()}`){
  return {id,legalName:String(input.legalName||"").trim(),type:input.type,scope:input.scope,country:String(input.country||"").trim(),services:[...new Set(Array.isArray(input.services)?input.services:[])],registrationChecked:input.registrationChecked===true||input.registrationChecked==="on",contactChecked:input.contactChecked===true||input.contactChecked==="on",serviceEvidenceChecked:input.serviceEvidenceChecked===true||input.serviceEvidenceChecked==="on",agreementChecked:input.agreementChecked===true||input.agreementChecked==="on"};
}

export function verification(partner){
  const complete=verificationFields.filter(field=>partner[field]===true).length;
  return {score:complete*25,status:complete===4?"verified":complete?"in_review":"pending",missing:verificationFields.filter(field=>partner[field]!==true)};
}

export function partnerMetrics(partners){
  return {total:partners.length,syrian:partners.filter(p=>p.scope==="syrian").length,international:partners.filter(p=>p.scope==="international").length,verified:partners.filter(p=>verification(p).status==="verified").length,inReview:partners.filter(p=>verification(p).status==="in_review").length};
}

export function filterPartners(partners,filters={}){
  const query=String(filters.query||"").trim().toLocaleLowerCase();
  return partners.filter(partner=>(!query||`${partner.legalName} ${partner.country}`.toLocaleLowerCase().includes(query))&&(!filters.scope||filters.scope==="all"||partner.scope===filters.scope)&&(!filters.status||filters.status==="all"||verification(partner).status===filters.status));
}

export function safePartners(value){
  if(!Array.isArray(value))return[];
  return value.filter(item=>item&&typeof item.id==="string"&&!validatePartner(item).length).map(item=>normalizePartner(item,item.id));
}
