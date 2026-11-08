export const services = ["travel", "tourism", "visa", "hajj", "umrah"];
export const statuses = ["planning", "documents", "ready", "active", "completed"];
export const readinessFields = ["contractReady", "partnerVerified", "documentsReady", "returnPlanReady"];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isRealDate(value) {
  if (!datePattern.test(value || "")) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateProgram(input, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  if (!services.includes(input.service)) errors.push("service");
  const destination = String(input.destination || "").trim();
  if (!destination || destination.length > 120) errors.push("destination");
  if (!isRealDate(input.departure) || input.departure < today) errors.push("departure");
  const capacity = Number(input.capacity);
  const reserved = Number(input.reserved);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) errors.push("capacity");
  if (!Number.isInteger(reserved) || reserved < 0 || reserved > capacity) errors.push("reserved");
  if (!statuses.includes(input.status)) errors.push("status");
  return [...new Set(errors)];
}

export function normalizeProgram(input, id = `program-${Date.now()}`) {
  return {
    id,
    service: input.service,
    destination: String(input.destination || "").trim(),
    departure: input.departure,
    capacity: Number(input.capacity),
    reserved: Number(input.reserved),
    status: input.status,
    contractReady: input.contractReady === true || input.contractReady === "on",
    partnerVerified: input.partnerVerified === true || input.partnerVerified === "on",
    documentsReady: input.documentsReady === true || input.documentsReady === "on",
    returnPlanReady: input.returnPlanReady === true || input.returnPlanReady === "on"
  };
}

export function requiredReadinessFields(service) {
  const required = ["contractReady", "partnerVerified", "documentsReady"];
  return service === "visa" ? required : [...required, "returnPlanReady"];
}

export function programReadiness(program) {
  const required = requiredReadinessFields(program.service);
  const completed = required.filter((field) => program[field]).length;
  return {
    score: Math.round((completed / required.length) * 100),
    blockers: required.filter((field) => !program[field])
  };
}

export function calculateMetrics(programs, today = new Date().toISOString().slice(0, 10)) {
  const totalCapacity = programs.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
  const totalReserved = programs.reduce((sum, item) => sum + Number(item.reserved || 0), 0);
  const upcoming = programs.filter((item) => item.departure >= today && item.status !== "completed").length;
  const ready = programs.filter((item) => item.status === "ready" && programReadiness(item).blockers.length === 0).length;
  const blocked = programs.filter((item) => ["ready", "active"].includes(item.status) && programReadiness(item).blockers.length).length;
  return {
    programs: programs.length,
    upcoming,
    ready,
    blocked,
    openSeats: Math.max(0, totalCapacity - totalReserved),
    utilization: totalCapacity ? Math.round((totalReserved / totalCapacity) * 100) : 0
  };
}

export function filterPrograms(programs, filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase();
  return programs.filter((item) => {
    if (filters.service && filters.service !== "all" && item.service !== filters.service) return false;
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
    return !query || item.destination.toLocaleLowerCase().includes(query);
  });
}

export function safePrograms(value, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.id === "string" && validateProgram(item, "2000-01-01").length === 0)
    .map((item) => normalizeProgram(item, item.id));
}
