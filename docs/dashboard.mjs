import { calculateMetrics, safePrograms } from "./operations-model.mjs";
import { visaMetrics, safeVisaCases } from "./visas-model.mjs";
import { leadMetrics, safeLeads } from "./customers-model.mjs";
import { campaignMetrics, safeCampaigns } from "./campaigns-model.mjs";
import { groupMetrics, safeGroups } from "./pilgrim-groups-model.mjs";
import { contractMetrics, safeContracts } from "./contracts-model.mjs";
import { guaranteeMetrics, safeGuarantees } from "./guarantees-model.mjs";
import { commissionMetrics, safeCommissions } from "./commissions-model.mjs";
import { partnerMetrics, safePartners } from "./partners-model.mjs";
import { directoryMetrics, safeDirectory } from "./directory-model.mjs";
import { summarizeModules } from "./dashboard-model.mjs";

const today = new Date().toISOString().slice(0, 10);
const definitions = [
  { id: "operations", key: "zarzour-operations-programs-v1", href: "operations.html", safe: safePrograms, metrics: items => { const m = calculateMetrics(items, today); return { total: m.programs, alerts: m.blocked, ready: m.ready }; } },
  { id: "visas", key: "zarzour-visa-cases-v1", href: "visas.html", safe: safeVisaCases, metrics: items => { const m = visaMetrics(items, today); return { total: m.total, alerts: m.blocked + m.overdue + m.dueSoon, ready: m.ready }; } },
  { id: "customers", key: "zarzour-customer-pipeline-v1", href: "customers.html", safe: safeLeads, metrics: items => { const m = leadMetrics(items, today); return { total: m.total, alerts: m.overdue, ready: m.booked }; } },
  { id: "campaigns", key: "zarzour-campaigns-v1", href: "campaigns.html", safe: safeCampaigns, metrics: items => { const m = campaignMetrics(items, today); return { total: m.total, alerts: m.blocked + m.ending, ready: Math.max(0, m.active - m.blocked) }; } },
  { id: "groups", key: "zarzour-pilgrim-groups-v1", href: "pilgrim-groups.html", safe: safeGroups, metrics: items => { const m = groupMetrics(items, today); return { total: m.total, alerts: m.blocked + m.returnDue + m.returnMissing, ready: m.ready }; } },
  { id: "contracts", key: "zarzour-contracts-v1", href: "contracts.html", safe: safeContracts, metrics: items => { const m = contractMetrics(items, today); return { total: m.total, alerts: m.blocked + m.expiring, ready: Math.max(0, m.active - m.blocked) }; } },
  { id: "guarantees", key: "zarzour-guarantees-v1", href: "guarantees.html", safe: safeGuarantees, metrics: items => { const m = guaranteeMetrics(items, today); return { total: m.total, alerts: m.blocked + m.expiredOpen + m.releasePending, ready: Math.max(0, m.active - m.blocked) }; } },
  { id: "commissions", key: "zarzour-commissions-v1", href: "commissions.html", safe: safeCommissions, metrics: items => { const m = commissionMetrics(items); return { total: m.total, alerts: m.blocked, ready: Math.max(0, m.approved - m.blocked) }; } },
  { id: "partners", key: "zarzour-partners-v1", href: "partners.html", safe: safePartners, metrics: items => { const m = partnerMetrics(items); return { total: m.total, alerts: m.inReview, ready: m.verified }; } },
  { id: "directory", key: "zarzour-verified-directory-v1", href: "directory.html", safe: safeDirectory, metrics: items => { const m = directoryMetrics(items, today); return { total: m.total, alerts: m.dueReview + m.expired, ready: m.public }; } }
];

const words = {
  ar: { operations: "الرحلات", visas: "التأشيرات", customers: "العملاء", campaigns: "الحملات", groups: "المعتمرون", contracts: "العقود", guarantees: "الكفلاء", commissions: "العمولات", partners: "الشركاء", directory: "الدليل الموثق", attention: "يحتاج متابعة", active: "نشط", empty: "لا توجد بيانات", total: "إجمالي السجلات", alerts: "تنبيهات", ready: "جاهز", open: "فتح الوحدة", unavailable: "تعذر قراءة البيانات المحلية لهذه الوحدة." },
  en: { operations: "Trips", visas: "Visas", customers: "Customers", campaigns: "Campaigns", groups: "Pilgrims", contracts: "Contracts", guarantees: "Guarantees", commissions: "Commissions", partners: "Partners", directory: "Verified directory", attention: "Needs attention", active: "Active", empty: "No data", total: "Total records", alerts: "Alerts", ready: "Ready", open: "Open module", unavailable: "Local data for this module could not be read." }
};
let lang;
try { lang = localStorage.getItem("zarzour-language"); } catch {}
if (!["ar", "en"].includes(lang)) lang = (navigator.language || "ar").toLowerCase().startsWith("en") ? "en" : "ar";

function read(definition) {
  try {
    const items = definition.safe(JSON.parse(localStorage.getItem(definition.key) || "[]"));
    return { id: definition.id, href: definition.href, ...definition.metrics(items) };
  } catch {
    return { id: definition.id, href: definition.href, total: 0, alerts: 1, ready: 0, unavailable: true };
  }
}

function render() {
  const summary = summarizeModules(definitions.map(read));
  const t = words[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-ar][data-en]").forEach(node => node.textContent = node.dataset[lang]);
  document.getElementById("language").textContent = lang === "ar" ? "English" : "العربية";
  for (const [key, value] of Object.entries(summary.totals)) {
    const node = document.getElementById(`metric-${key}`);
    if (node) node.textContent = value;
  }
  const board = document.getElementById("module-board");
  board.replaceChildren();
  for (const item of summary.modules) {
    const card = document.createElement("article"); card.className = `module ${item.health}`;
    const heading = document.createElement("h2"); heading.textContent = t[item.id];
    const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = t[item.health];
    const stats = document.createElement("div"); stats.className = "module-stats";
    for (const [label, value] of [[t.total, item.total], [t.alerts, item.alerts], [t.ready, item.ready]]) {
      const stat = document.createElement("span"); const strong = document.createElement("b"); strong.textContent = value;
      stat.append(strong, document.createTextNode(label)); stats.append(stat);
    }
    const link = document.createElement("a"); link.className = "open"; link.href = item.href; link.textContent = t.open;
    card.append(badge, heading, stats);
    if (item.unavailable) { const message = document.createElement("p"); message.className = "error"; message.textContent = t.unavailable; card.append(message); }
    card.append(link); board.append(card);
  }
}

document.getElementById("language").addEventListener("click", () => { lang = lang === "ar" ? "en" : "ar"; try { localStorage.setItem("zarzour-language", lang); } catch {} render(); });
document.getElementById("refresh").addEventListener("click", render);
render();

