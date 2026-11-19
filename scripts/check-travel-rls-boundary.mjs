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
  if (/\bcreate\s+policy\b/i.test(clean)) violations.push('RLS policy requires explicit authorization review');
  if (/\balter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?travel_[a-z_]+\s+disable\s+row\s+level\s+security\b/i.test(clean)) {
    violations.push('Travel table RLS must remain enabled');
  }
  if (/\bgrant\s+(?:all(?:\s+privileges)?|select|insert|update|delete|truncate|references|trigger)(?:\s*,\s*(?:select|insert|update|delete))*\s+on\s+(?:table\s+|all\s+tables\s+in\s+schema\s+)?(?:public\.)?(?:travel_[a-z_]+|public)\b[\s\S]*?\bto\s+(?:anon|authenticated|public)\b/i.test(clean)) {
    violations.push('Browser-role grants on Travel data are not approved');
  }
  return violations;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['create table public.travel_bookings(id uuid); alter table public.travel_bookings enable row level security;', 0],
    ['-- create policy demo on public.travel_bookings\nselect 1;', 0],
    ['create policy open_access on public.travel_bookings for select using (true);', 1],
    ['alter table public.travel_bookings disable row level security;', 1],
    ['grant select on public.travel_bookings to anon;', 1],
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
