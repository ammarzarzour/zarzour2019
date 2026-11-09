export const journalKinds = ["revenue", "expense", "commission", "refund", "adjustment"];
export const journalStatuses = ["draft", "review", "posted", "void"];
export const journalAccounts = ["cash", "bank", "receivable", "payable", "revenue", "expense", "commission", "tax"];
export const currencies = ["USD", "SAR", "SYP", "EUR"];

export function parseMoney(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function amountMinor(input) {
  return Number.isSafeInteger(input.amountMinor) && input.amountMinor > 0 ? input.amountMinor : parseMoney(input.amount);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function validateJournalEntry(input) {
  const errors = [], reference = String(input.reference || "").trim();
  if (!/^[A-Za-z0-9/_-]{3,40}$/.test(reference)) errors.push("reference");
  if (!validDate(input.entryDate)) errors.push("entryDate");
  if (!journalKinds.includes(input.kind)) errors.push("kind");
  if (!journalStatuses.includes(input.status)) errors.push("status");
  if (!currencies.includes(input.currency)) errors.push("currency");
  if (!journalAccounts.includes(input.debitAccount)) errors.push("debitAccount");
  if (!journalAccounts.includes(input.creditAccount)) errors.push("creditAccount");
  if (input.debitAccount === input.creditAccount) errors.push("accounts");
  if (amountMinor(input) === null) errors.push("amount");
  if (String(input.notes || "").length > 500) errors.push("notes");
  return [...new Set(errors)];
}

export function normalizeJournalEntry(input, id = `entry-${Date.now()}`) {
  return {
    id,
    reference: String(input.reference || "").trim().toUpperCase(),
    entryDate: String(input.entryDate || ""),
    kind: input.kind,
    status: input.status,
    currency: input.currency,
    amountMinor: amountMinor(input),
    debitAccount: input.debitAccount,
    creditAccount: input.creditAccount,
    evidenceChecked: input.evidenceChecked === true || input.evidenceChecked === "on",
    approvedChecked: input.approvedChecked === true || input.approvedChecked === "on",
    notes: String(input.notes || "").trim()
  };
}

export function journalReadiness(item) {
  const required = [];
  if (["review", "posted"].includes(item.status)) required.push("evidenceChecked");
  if (item.status === "posted") required.push("approvedChecked");
  const blockers = required.filter(field => item[field] !== true);
  return { required, blockers, ready: blockers.length === 0 };
}

export function safeJournalEntries(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(), references = new Set();
  return value.filter(item => {
    if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) || validateJournalEntry(item).length) return false;
    const reference = String(item.reference).trim().toUpperCase();
    if (references.has(reference)) return false;
    ids.add(item.id); references.add(reference); return true;
  }).map(item => normalizeJournalEntry(item, item.id));
}

export function journalMetrics(items) {
  const posted = items.filter(item => item.status === "posted" && journalReadiness(item).ready);
  const totals = Object.fromEntries(currencies.map(currency => [currency, posted.filter(item => item.currency === currency).reduce((sum, item) => sum + item.amountMinor, 0)]));
  return {
    total: items.length,
    draft: items.filter(item => item.status === "draft").length,
    review: items.filter(item => item.status === "review").length,
    posted: posted.length,
    blocked: items.filter(item => ["review", "posted"].includes(item.status) && journalReadiness(item).blockers.length > 0).length,
    void: items.filter(item => item.status === "void").length,
    totals
  };
}

export function filterJournalEntries(items, { query = "", kind = "", status = "", currency = "" } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  return items.filter(item => (!kind || item.kind === kind) && (!status || item.status === status) && (!currency || item.currency === currency) && (!needle || `${item.reference} ${item.notes}`.toLocaleLowerCase().includes(needle)));
}

