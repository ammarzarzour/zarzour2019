export const projectTypes = ["website", "internal", "portal", "automation"];
export const modules = ["content", "crm", "workflows", "reports", "integrations", "bilingual"];
export const languages = ["ar", "en", "both"];
export const phases = ["discovery", "mvp", "growth"];

export function validateBrief(input) {
  const errors = [];
  const name = String(input.name || "").trim();
  const goal = String(input.goal || "").trim();
  const selected = Array.isArray(input.modules) ? input.modules : [];
  if (!name || name.length > 80) errors.push("name");
  if (!projectTypes.includes(input.type)) errors.push("type");
  if (!goal || goal.length > 500) errors.push("goal");
  if (!selected.length || selected.some((item) => !modules.includes(item))) errors.push("modules");
  if (!languages.includes(input.language)) errors.push("language");
  if (!phases.includes(input.phase)) errors.push("phase");
  return [...new Set(errors)];
}

export function normalizeBrief(input) {
  return {
    name: String(input.name || "").trim(),
    type: input.type,
    goal: String(input.goal || "").trim(),
    modules: [...new Set(Array.isArray(input.modules) ? input.modules : [])],
    language: input.language,
    phase: input.phase
  };
}

export function assessScope(input) {
  const brief = normalizeBrief(input);
  const typeWeight = {website:1,internal:3,portal:4,automation:3}[brief.type] || 0;
  const moduleWeight = brief.modules.reduce((score, item) => score + (item === "integrations" ? 2 : 1), 0);
  const languageWeight = brief.language === "both" ? 1 : 0;
  const score = typeWeight + moduleWeight + languageWeight;
  const level = score <= 4 ? "foundation" : score <= 8 ? "standard" : "advanced";
  const recommended = ["discovery", "prototype", "build", "validation"];
  if (level === "advanced") recommended.splice(2, 0, "architecture");
  return {score, level, recommended};
}

const labels = {
  ar:{website:"موقع",internal:"نظام داخلي",portal:"بوابة عملاء",automation:"أتمتة",content:"إدارة المحتوى",crm:"إدارة العملاء",workflows:"سير العمل",reports:"التقارير",integrations:"التكاملات",bilingual:"العربية والإنجليزية",ar:"العربية",en:"الإنجليزية",both:"العربية والإنجليزية",discovery:"الاستكشاف",mvp:"نسخة أولية",growth:"التوسع",foundation:"تأسيسي",standard:"متوسط",advanced:"متقدم",prototype:"نموذج أولي",build:"البناء",architecture:"الهندسة",validation:"الاختبار"},
  en:{website:"Website",internal:"Internal system",portal:"Client portal",automation:"Automation",content:"Content management",crm:"Customer management",workflows:"Workflows",reports:"Reports",integrations:"Integrations",bilingual:"Arabic and English",ar:"Arabic",en:"English",both:"Arabic and English",discovery:"Discovery",mvp:"Minimum viable product",growth:"Growth",foundation:"Foundation",standard:"Standard",advanced:"Advanced",prototype:"Prototype",build:"Build",architecture:"Architecture",validation:"Validation"}
};

export function briefSummary(input, lang="ar") {
  const brief = normalizeBrief(input);
  const assessment = assessScope(brief);
  const t = (key) => labels[lang]?.[key] || key;
  const lines = lang === "ar" ? [
    `اسم المشروع: ${brief.name}`,
    `نوع المنتج: ${t(brief.type)}`,
    `الهدف: ${brief.goal}`,
    `الوحدات: ${brief.modules.map(t).join("، ")}`,
    `اللغة: ${t(brief.language)}`,
    `مرحلة المشروع: ${t(brief.phase)}`,
    `مستوى النطاق: ${t(assessment.level)}`,
    `المراحل المقترحة: ${assessment.recommended.map(t).join(" ← ")}`,
    "ملاحظة: هذا تقدير أولي للنطاق، وليس عرض سعر أو التزاماً زمنياً."
  ] : [
    `Project: ${brief.name}`,
    `Product type: ${t(brief.type)}`,
    `Goal: ${brief.goal}`,
    `Modules: ${brief.modules.map(t).join(", ")}`,
    `Language: ${t(brief.language)}`,
    `Project phase: ${t(brief.phase)}`,
    `Scope level: ${t(assessment.level)}`,
    `Suggested stages: ${assessment.recommended.map(t).join(" → ")}`,
    "Note: this is an initial scope assessment, not a price quote or delivery commitment."
  ];
  return lines.join("\n");
}
