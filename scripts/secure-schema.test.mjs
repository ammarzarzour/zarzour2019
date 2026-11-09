import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/migrations/20261109075909_secure_visa_booking_accounting_operations.sql", import.meta.url), "utf8");

test("creates the visa case and double-entry journal tables", () => {
  assert.match(sql, /create table if not exists public\.travel_visa_cases/i);
  assert.match(sql, /create table if not exists public\.travel_accounting_journal/i);
});

test("enables RLS on every newly created table", () => {
  for (const table of ["travel_visa_cases", "travel_accounting_journal"]) {
    assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security", "i"));
  }
});

test("does not open client access before authorization is approved", () => {
  assert.doesNotMatch(sql, /\bcreate\s+policy\b/i);
  assert.doesNotMatch(sql, /\bgrant\s+(?:select|insert|update|delete|all)\b/i);
});

test("extends booking operations with constrained readiness fields", () => {
  for (const column of ["travelers", "supplier_reference", "supplier_confirmed", "documents_checked", "itinerary_issued"]) assert.match(sql, new RegExp("add column if not exists " + column, "i"));
  assert.match(sql, /travelers between 1 and 500/i);
});

test("stores accounting amounts in minor units and enforces distinct accounts", () => {
  assert.match(sql, /amount_minor bigint not null check \(amount_minor > 0\)/i);
  assert.match(sql, /check \(debit_account <> credit_account\)/i);
  assert.match(sql, /status <> 'posted' or \(evidence_checked and approved_checked\)/i);
});

