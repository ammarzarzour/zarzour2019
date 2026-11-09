export const visaTypes = ["umrah", "hajj", "tourism", "family", "business", "government"];
export const visaStatuses = ["draft", "documents", "submitted", "review", "approved", "rejected", "closed"];
export const documentFields = ["passportChecked", "photoChecked", "applicationChecked", "itineraryChecked"];

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateVisaCase(input) {
  const errors = [];
  const reference = String(input.reference || "").trim();
  const destination = String(input.destination || "").trim();
  if (!/^[A-Za-z0-9/_-]{3,40}$/.test(reference)) errors.push("reference");
  if (!visaTypes.includes(input.type)) errors.push("type");
  if (!destination || destination.length > 80) errors.push("destination");
  if (!visaStatuses.includes(input.status)) errors.push("status");
  if (!validDate(input.targetDate)) errors.push("targetDate");
  if (input.submittedDate && !validDate(input.submittedDate)) errors.push("submittedDate");
  if (["submitted", "review", "approved", "rejected", "closed"].includes(input.status) && !validDate(input.submittedDate)) errors.push("submittedDate");
  if (String(input.notes || "").length > 500) errors.push("notes");
  return [...new Set(errors)];
}

export function normalizeVisaCase(input, id = `visa-${Date.now()}`) {
  return {
    id,
    reference: String(input.reference || "").trim().toUpperCase(),
    type: input.type,
    destination: String(input.destination || "").trim(),
    status: input.status,
    targetDate: String(input.targetDate || ""),
    submittedDate: String(input.submittedDate || ""),
    passportChecked: input.passportChecked === true || input.passportChecked === "on",
    photoChecked: input.photoChecked === true || input.photoChecked === "on",
    applicationChecked: input.applicationChecked === true || input.applicationChecked === "on",
    itineraryChecked: input.itineraryChecked === true || input.itineraryChecked === "on",
    notes: String(input.notes || "").trim()
  };
}

export function visaReadiness(item) {
  const required = ["passportChecked", "photoChecked", "applicationChecked"];
  if (["umrah", "hajj", "tourism"].includes(item.type)) required.push("itineraryChecked");
  const blockers = required.filter(field => item[field] !== true);
  return { required, blockers, ready: blockers.length === 0 };
}

export function safeVisaCases(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(), references = new Set();
  return value.filter(item => {
    if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || validateVisaCase(item).length) return false;
    const reference = String(item.reference).trim().toUpperCase();
    if (references.has(reference)) return false;
    ids.add(item.id); references.add(reference); return true;
  }).map(item => normalizeVisaCase(item, item.id));
}

function plusDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function visaMetrics(items, today) {
  const live = items.filter(item => ["documents", "submitted", "review"].includes(item.status));
  return {
    total: items.length,
    submitted: items.filter(item => ["submitted", "review"].includes(item.status)).length,
    approved: items.filter(item => item.status === "approved").length,
    rejected: items.filter(item => item.status === "rejected").length,
    blocked: live.filter(item => visaReadiness(item).blockers.length > 0).length,
    overdue: live.filter(item => item.targetDate < today).length,
    dueSoon: live.filter(item => item.targetDate >= today && item.targetDate <= plusDays(today, 7)).length,
    ready: items.filter(item => !["approved", "rejected", "closed"].includes(item.status) && visaReadiness(item).ready).length
  };
}

export function filterVisaCases(items, { query = "", type = "", status = "" } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  return items.filter(item => (!type || item.type === type) && (!status || item.status === status) && (!needle || `${item.reference} ${item.destination} ${item.notes}`.toLocaleLowerCase().includes(needle)));
}

