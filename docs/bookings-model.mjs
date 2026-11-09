export const bookingServices = ["flight", "hotel", "transport", "tour", "umrah", "hajj"];
export const bookingStatuses = ["inquiry", "hold", "confirmed", "in_service", "completed", "cancelled"];

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateBooking(input) {
  const errors = [];
  const reference = String(input.reference || "").trim();
  const travelers = Number(input.travelers);
  if (!/^[A-Za-z0-9/_-]{3,40}$/.test(reference)) errors.push("reference");
  if (!bookingServices.includes(input.service)) errors.push("service");
  if (!bookingStatuses.includes(input.status)) errors.push("status");
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 500) errors.push("travelers");
  if (!validDate(input.startDate)) errors.push("startDate");
  if (!validDate(input.endDate) || (validDate(input.startDate) && input.endDate < input.startDate)) errors.push("endDate");
  if (String(input.supplierReference || "").length > 80) errors.push("supplierReference");
  if (String(input.notes || "").length > 500) errors.push("notes");
  return [...new Set(errors)];
}

export function normalizeBooking(input, id = `booking-${Date.now()}`) {
  return {
    id,
    reference: String(input.reference || "").trim().toUpperCase(),
    service: input.service,
    status: input.status,
    travelers: Number(input.travelers),
    startDate: String(input.startDate || ""),
    endDate: String(input.endDate || ""),
    supplierReference: String(input.supplierReference || "").trim(),
    supplierConfirmed: input.supplierConfirmed === true || input.supplierConfirmed === "on",
    documentsChecked: input.documentsChecked === true || input.documentsChecked === "on",
    itineraryIssued: input.itineraryIssued === true || input.itineraryIssued === "on",
    notes: String(input.notes || "").trim()
  };
}

export function bookingReadiness(item) {
  const required = [];
  if (["hold", "confirmed", "in_service"].includes(item.status)) required.push("supplierReference", "supplierConfirmed");
  if (["confirmed", "in_service"].includes(item.status)) required.push("documentsChecked", "itineraryIssued");
  const blockers = required.filter(field => field === "supplierReference" ? !String(item.supplierReference || "").trim() : item[field] !== true);
  return { required, blockers, ready: blockers.length === 0 };
}

export function safeBookings(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(), references = new Set();
  return value.filter(item => {
    if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || validateBooking(item).length) return false;
    const reference = String(item.reference).trim().toUpperCase();
    if (references.has(reference)) return false;
    ids.add(item.id); references.add(reference); return true;
  }).map(item => normalizeBooking(item, item.id));
}

function plusDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function bookingMetrics(items, today) {
  const live = items.filter(item => ["hold", "confirmed", "in_service"].includes(item.status));
  return {
    total: items.length,
    travelers: items.filter(item => item.status !== "cancelled").reduce((sum, item) => sum + item.travelers, 0),
    hold: items.filter(item => item.status === "hold").length,
    confirmed: items.filter(item => item.status === "confirmed").length,
    inService: items.filter(item => item.status === "in_service").length,
    blocked: live.filter(item => bookingReadiness(item).blockers.length > 0).length,
    startingSoon: items.filter(item => ["confirmed", "in_service"].includes(item.status) && item.startDate >= today && item.startDate <= plusDays(today, 7)).length,
    overdue: items.filter(item => item.status === "in_service" && item.endDate < today).length,
    completed: items.filter(item => item.status === "completed").length
  };
}

export function filterBookings(items, { query = "", service = "", status = "" } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  return items.filter(item => (!service || item.service === service) && (!status || item.status === status) && (!needle || `${item.reference} ${item.supplierReference} ${item.notes}`.toLocaleLowerCase().includes(needle)));
}

