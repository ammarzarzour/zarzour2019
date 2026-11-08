import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("docs");
const pages = ["index.html", "soft/index.html", "soft/brief.html", "404.html", "request.html", "operations.html", "partners.html", "customers.html", "contracts.html", "campaigns.html"];
const idsByPage = new Map();
for (const file of pages) {
  const html = await readFile(path.join(root, file), "utf8");
  assert.match(html, /<!doctype html>/i, file + ": missing HTML doctype");
  assert.match(html, /<html[^>]*lang=/i, file + ": missing language declaration");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(repeated, [], file + ": duplicate element IDs");
  idsByPage.set(file, new Set(ids));
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter((s) => s.trim());
  for (const [index, script] of scripts.entries()) assert.doesNotThrow(() => new Function(script), file + ": invalid inline script " + (index + 1));
}
for (const file of pages) {
  const html = await readFile(path.join(root, file), "utf8");
  for (const [, href] of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
    if (/^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    const [target, fragment] = href.split("#", 2);
    if (fragment && !target) { assert.ok(idsByPage.get(file).has(decodeURIComponent(fragment)), file + ": broken fragment #" + fragment); continue; }
    if (!target) continue;
    const targetUrl = new URL(target, "https://zarzour.invalid/docs/" + file.replace(/^\//, ""));
    let local = path.join(root, decodeURIComponent(targetUrl.pathname.replace(/^\/docs\/?/, "")));
    if (targetUrl.pathname.endsWith("/")) local = path.join(local, "index.html");
    try { await access(local); } catch { assert.fail(file + ": broken local link " + href); }
    if (fragment) {
      const relative = path.relative(root, local);
      if (idsByPage.has(relative)) assert.ok(idsByPage.get(relative).has(decodeURIComponent(fragment)), file + ": broken fragment " + href);
    }
  }
}
console.log("Static page checks passed: language declarations, unique IDs, local links, and inline JavaScript syntax.");

const migrationDir = path.resolve("supabase/migrations");
const migrationFiles = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
assert.ok(migrationFiles.length > 0, "No Supabase migrations found");
const migrationSql = (await Promise.all(migrationFiles.map((file) => readFile(path.join(migrationDir, file), "utf8")))).join("\n").replace(/--.*$/gm, "");
const createdTables = new Set([...migrationSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase()));
const rlsTables = new Set([...migrationSql.matchAll(/alter\s+table\s+public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map((match) => match[1].toLowerCase()));
assert.ok(createdTables.size > 0, "No public tables found in migrations");
assert.deepEqual([...createdTables].sort(), [...rlsTables].sort(), "Every created public table must enable RLS");
assert.doesNotMatch(migrationSql, /\bcreate\s+policy\b/i, "Client access policies must stay disabled until an authorized access model is added");
console.log(`Supabase migration checks passed: RLS enabled on all ${createdTables.size} public tables; no client policies are defined.`);

