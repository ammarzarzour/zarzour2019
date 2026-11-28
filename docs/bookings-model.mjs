export const bookingServices = ["flight", "hotel", "transport", "tour", "umrah", "hajj"];
export const bookingStatuses = ["inquiry", "hold", "confirmed", "in_service", "completed", "cancelled"];

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateBooking(input) {
  // Malformed browser storage or programmatic callers must fail closed, not crash.
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["booking"];
  const errors = [];
  // Validate primitive types before coercion; malformed restored records must not become valid references or throw.
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  const rawTravelers = input.travelers;
  const travelersFormatValid = (typeof rawTravelers === "number" && Number.isInteger(rawTravelers)) ||
    (typeof rawTravelers === "string" && /^[0-9]+$/.test(rawTravelers.trim()));
  const travelers = travelersFormatValid ? Number(rawTravelers) : NaN;
  if (!/^[A-Za-z0-9/_-]{3,40}$/.test(reference)) errors.push("reference");
  if (!bookingServices.includes(input.service)) errors.push("service");
  if (!bookingStatuses.includes(input.status)) errors.push("status");
  if (!travelersFormatValid || !Number.isInteger(travelers) || travelers < 1 || travelers > 500) errors.push("travelers");
  // Only explicit checkbox values are valid; never silently coerce malformed stored flags.
  for (const field of ["supplierConfirmed", "documentsChecked", "itineraryIssued"]) {
    if (input[field] !== undefined && input[field] !== null &&
        input[field] !== true && input[field] !== false &&
        input[field] !== "on") errors.push(field);
  }
  if (!validDate(input.startDate)) errors.push("startDate");
  if (!validDate(input.endDate) || (validDate(input.startDate) && input.endDate < input.startDate)) errors.push("endDate");
  // Reject structured values instead of silently persisting "[object Object]" or array text.
  if (input.supplierReference != null && typeof input.supplierReference !== "string" ||
      (String(input.supplierReference || "").length > 80 || /[\u0000-\u001F\u007F]/.test(input.supplierReference || ""))) errors.push("supplierReference");
  if (input.notes != null && typeof input.notes !== "string" ||
      String(input.notes || "").length > 500) errors.push("notes");
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

// Reject noncanonical identifiers before they enter storage or edit paths.
function validBookingId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 120 &&
    id === id.trim() && !/[\u0000-\u001F\u007F]/.test(id);
}

export function safeBookings(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(), references = new Set();
  return value.filter(item => {
    if (!item || !validBookingId(item.id) || ids.has(item.id) || validateBooking(item).length) return false;
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


export function upsertBooking(items, input, id, expected) {
  // Each modification must be based on the exact booking that was opened.
  // Creation cannot silently overwrite an existing local record with the same ID.
  if (!validBookingId(id)) return { errors: ["bookingId"], items };
  if (!Array.isArray(items) || safeBookings(items).length !== items.length) return { errors: ["bookingStore"], items };
  const current = items.find(item => item.id === id);
  if (expected !== undefined) {
    if (!current || !expected || typeof expected !== "object" || Array.isArray(expected) ||
        expected.id !== id || validateBooking(expected).length ||
        JSON.stringify(normalizeBooking(current, id)) !== JSON.stringify(normalizeBooking(expected, id))) {
      return { errors: ["conflict"], items };
    }
  } else if (current) {
    return { errors: ["duplicateId"], items };
  }
  const errors = validateBooking(input);
  if (errors.length) return { errors, items };
  const normalized = normalizeBooking(input, id);
  if (items.some(item => item.id !== id && item.reference.trim().toUpperCase() === normalized.reference)) errors.push("duplicateReference");
  if (errors.length) return { errors, items };
  return { errors: [], items: current ? items.map(item => item.id === id ? normalized : item) : [normalized, ...items] };
}
