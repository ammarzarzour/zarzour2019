#!/usr/bin/env node
// Fail closed: Travel data remains inaccessible to browser roles until a
// separately reviewed authorization design is approved and deployed.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export function checkBoundary(sql) {
  // Strip comments to avoid false positives from migration documentation.
  const clean = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ');
  const violations = [];
  if (/\b(?:create|alter|drop)\s+policy\b/i.test(clean)) violations.push('RLS policy creation, modification or removal requires explicit authorization review');
  // Guard every table in the Travel database, not just travel_* tables.
  const table = '(?:"?public"?\\.)?"?[a-z_][a-z_0-9]*"?';
  if (new RegExp('\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?' + table + '\\s+disable\\s+row\\s+level\\s+security\\b', 'i').test(clean)) {
    violations.push('Travel database table RLS must remain enabled');
  }
  // Match individual GRANT statements to handle multiple grantees safely.
  const grants = clean.match(/\bgrant\b[\s\S]*?(?:;|$)/gi) ?? [];
  for (const grant of grants) {
    if (!/\bgrant\s+(?:all(?:\s+privileges)?|select|insert|update|delete|truncate|references|trigger)\b/i.test(grant)) continue;
    const target = new RegExp('\\bon\\s+(?:all\\s+tables\\s+in\\s+schema\\s+"?public"?|(?:table\\s+)?' + table + ')(?=\\s|;|$)', 'i');
    if (!target.test(grant)) continue;
    const grantees = grant.split(/\bto\b/i).slice(1).join(' to ').split(/\bwith\s+grant\s+option\b/i)[0];
    if (/\b(?:anon|authenticated|public)\b/i.test(grantees)) {
      violations.push('Browser-role grants on Travel data are not approved');
    }
  }
  // Future-table privileges bypass ordinary GRANT ... ON public.table checks.
  const defaultGrants = clean.match(/\balter\s+default\s+privileges\b[^;]*;/gi) ?? [];
  for (const statement of defaultGrants) {
    if (!/\bgrant\s+(?:all(?:\s+privileges)?|select|insert|update|delete|truncate|references|trigger)\b/i.test(statement)) continue;
    if (!/\bon\s+tables\s+to\s+[^;]*\b(?:anon|authenticated|public)\b/i.test(statement)) continue;
    violations.push('Default privileges must not grant future Travel tables to browser roles');
  }
  return violations;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['create table public.travel_bookings(id uuid); alter table public.travel_bookings enable row level security;', 0],
    ['-- create policy demo on public.travel_bookings\nselect 1;', 0],
    ['create policy open_access on public.travel_bookings for select using (true);', 1],
    ['alter policy existing_read on public.travel_bookings using (true);', 1],
    ['alter policy existing_read on public.travel_bookings to authenticated;', 1],
    ['drop policy existing_read on public.travel_bookings;', 1],
    ['drop policy if exists existing_read on public.pilgrims;', 1],
    ['-- drop policy existing_read on public.travel_bookings\nselect 1;', 0],
    ['-- alter policy existing_read on public.travel_bookings\nselect 1;', 0],
    ['alter table public.travel_bookings disable row level security;', 1],
    ['alter table only public.travel_bookings disable row level security;', 1],
    ['alter table if exists only "public"."pilgrims" disable row level security;', 1],
    ['alter table only public.travel_bookings enable row level security;', 0],
    ['grant select on public.travel_bookings to anon;', 1],
    ['alter table public.pilgrims disable row level security;', 1],
    ['alter table "public"."marketing_campaigns" disable row level security;', 1],
    ['grant select on public.pilgrims to authenticated;', 1],
    ['grant select on all tables in schema public to service_role, authenticated;', 1],
    ['grant select on public.travel_bookings to service_role;', 0],
    ['alter default privileges in schema public grant select on tables to authenticated;', 1],
    ['alter default privileges for role postgres in schema public grant all privileges on tables to anon;', 1],
    ['alter default privileges in schema public grant select on tables to service_role;', 0],
    ['alter default privileges in schema public grant usage on sequences to authenticated;', 0],
  ];
  for (const [sql, expected] of cases) {
    if ((checkBoundary(sql).length > 0 ? 1 : 0) !== expected) throw new Error('Boundary self-test failed: ' + sql);
  }
  console.log('Travel RLS boundary self-tests passed');
} else {
  const root = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
  let failed = false;
  for (const file of readdirSync(root).filter(name => name.endsWith('.sql'))) {
    const violations = checkBoundary(readFileSync(join(root, file), 'utf8'));
    for (const message of violations) {
      console.error(file + ': ' + message);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log('Travel migrations retain deny-by-default client access');
}
