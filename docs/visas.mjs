import { documentFields, filterVisaCases, normalizeVisaCase, safeVisaCases, validateVisaCase, visaMetrics, visaReadiness, visaStatuses, visaTypes } from "./visas-model.mjs";

const storageKey = "zarzour-visa-cases-v1", languageKey = "zarzour-language";
let lang; try { lang = localStorage.getItem(languageKey); } catch {}
if (!["ar", "en"].includes(lang)) lang = (navigator.language || "ar").toLowerCase().startsWith("en") ? "en" : "ar";
const words = {
  ar: { umrah:"عمرة",hajj:"حج",tourism:"سياحية",family:"زيارة عائلية",business:"أعمال",government:"زيارة حكومية",draft:"مسودة",documents:"تجهيز مستندات",submitted:"مقدم",review:"قيد المراجعة",approved:"موافق عليه",rejected:"مرفوض",closed:"مغلق",passportChecked:"جواز السفر",photoChecked:"الصورة",applicationChecked:"النموذج",itineraryChecked:"خطة الرحلة",empty:"لا توجد ملفات مطابقة.",delete:"حذف",saved:"تم حفظ الملف على هذا الجهاز فقط.",invalid:"راجع الحقول المطلوبة وتاريخ التقديم للحالات المقدمة.",ready:"جاهز",blocked:"نواقص" },
  en: { umrah:"Umrah",hajj:"Hajj",tourism:"Tourism",family:"Family visit",business:"Business",government:"Government visit",draft:"Draft",documents:"Documents",submitted:"Submitted",review:"In review",approved:"Approved",rejected:"Rejected",closed:"Closed",passportChecked:"Passport",photoChecked:"Photo",applicationChecked:"Form",itineraryChecked:"Itinerary",empty:"No matching visa cases.",delete:"Delete",saved:"Case saved on this device only.",invalid:"Review required fields and submission date for submitted cases.",ready:"Ready",blocked:"Missing" }
};
let cases = load();
const form = document.getElementById("visa-form"), body = document.getElementById("visa-body"), message = document.getElementById("message");
function t(key) { return words[lang][key] || key; }
function load() { try { return safeVisaCases(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { return []; } }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(cases)); return true; } catch { message.textContent = lang === "ar" ? "تعذر الحفظ المحلي؛ قد تضيع تعديلات هذه الجلسة." : "Local storage failed; changes in this session may be lost."; message.className = "message error"; message.hidden = false; return false; } }
function filters() { return { query: document.getElementById("search").value, type: document.getElementById("filter-type").value, status: document.getElementById("filter-status").value }; }
function input() { return Object.fromEntries(new FormData(form)); }
function applyLanguage() { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; document.querySelectorAll("[data-ar][data-en]").forEach(node => node.textContent = node.dataset[lang]); document.querySelectorAll("[data-ar-placeholder][data-en-placeholder]").forEach(node => node.placeholder = node.dataset[`${lang}Placeholder`]); document.getElementById("language").textContent = lang === "ar" ? "English" : "العربية"; render(); }
function render() {
  const metrics = visaMetrics(cases, new Date().toISOString().slice(0, 10));
  for (const [key, value] of Object.entries(metrics)) { const node = document.getElementById(`metric-${key}`); if (node) node.textContent = value; }
  body.replaceChildren();
  const visible = filterVisaCases(cases, filters());
  if (!visible.length) { const row = document.createElement("tr"), cell = document.createElement("td"); cell.colSpan = 8; cell.className = "empty"; cell.textContent = t("empty"); row.append(cell); body.append(row); return; }
  for (const item of visible) {
    const readiness = visaReadiness(item), row = document.createElement("tr");
    const values = [item.reference, t(item.type), item.destination, t(item.status), item.submittedDate || "—", item.targetDate, readiness.ready ? t("ready") : `${t("blocked")}: ${readiness.blockers.map(t).join(lang === "ar" ? "، " : ", ")}`];
    for (const value of values) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
    const action = document.createElement("td"), button = document.createElement("button"); button.type = "button"; button.className = "delete"; button.dataset.id = item.id; button.textContent = t("delete"); action.append(button); row.append(action); body.append(row);
  }
}
form.addEventListener("submit", event => { event.preventDefault(); const data = input(), errors = validateVisaCase(data); message.hidden = false; if (errors.length) { message.textContent = t("invalid"); message.className = "message error"; return; } cases = [normalizeVisaCase(data, `visa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`), ...cases]; const stored = save(); if (stored) { message.textContent = t("saved"); message.className = "message success"; } form.reset(); render(); });
body.addEventListener("click", event => { const id = event.target.dataset.id; if (!id) return; cases = cases.filter(item => item.id !== id); save(); render(); });
for (const id of ["search", "filter-type", "filter-status"]) { document.getElementById(id).addEventListener("input", render); document.getElementById(id).addEventListener("change", render); }
document.getElementById("language").addEventListener("click", () => { lang = lang === "ar" ? "en" : "ar"; try { localStorage.setItem(languageKey, lang); } catch {} applyLanguage(); });
applyLanguage();

