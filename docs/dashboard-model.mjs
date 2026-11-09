import { contractReadiness } from "./contracts-model.mjs";

export const dashboardModuleIds = ["operations", "bookings", "visas", "customers", "campaigns", "groups", "contracts", "guarantees", "accounting", "commissions", "partners", "directory"];

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function normalizeSnapshot(value) {
  if (!value || !dashboardModuleIds.includes(value.id)) return null;
  const href = String(value.href || "");
  return {
    id: value.id,
    total: count(value.total),
    alerts: count(value.alerts),
    ready: count(value.ready),
    href: /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/i.test(href) ? href : "#"
  };
}

export function moduleHealth(snapshot) {
  if (snapshot.alerts > 0) return "attention";
  if (snapshot.total > 0) return "active";
  return "empty";
}

export function summarizeModules(value) {
  const seen = new Set();
  const modules = (Array.isArray(value) ? value : []).map(normalizeSnapshot).filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map(item => ({ ...item, health: moduleHealth(item) }))
    .sort((a, b) => b.alerts - a.alerts || b.total - a.total || a.id.localeCompare(b.id));
  return {
    modules,
    totals: {
      modules: modules.length,
      active: modules.filter(item => item.total > 0).length,
      records: modules.reduce((sum, item) => sum + item.total, 0),
      alerts: modules.reduce((sum, item) => sum + item.alerts, 0),
      ready: modules.reduce((sum, item) => sum + item.ready, 0)
    }
  };
}


export function contractSnapshot(items, today) {
 const live = items.filter(item => ["approved", "active"].includes(item.status));
 const limit = new Date(Date.parse(today + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
 return {
  total: items.length,
  alerts: live.filter(item => contractReadiness(item).blockers.length > 0 || (item.endDate && item.endDate <= limit)).length,
  ready: live.filter(item => item.status === "active" && !contractReadiness(item).blockers.length && (!item.endDate || item.endDate >= today)).length
 };
}
