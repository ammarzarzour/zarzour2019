import test from "node:test";
import assert from "node:assert/strict";
import { filterJournalEntries, journalMetrics, journalReadiness, normalizeJournalEntry, parseMoney, safeJournalEntries, validateJournalEntry } from "../docs/accounting-model.mjs";

const valid = { reference:"JR-301",entryDate:"2026-11-09",kind:"revenue",status:"posted",currency:"USD",amount:"125.50",debitAccount:"receivable",creditAccount:"revenue",evidenceChecked:true,approvedChecked:true,notes:"Synthetic test" };

test("parses decimal amounts exactly",()=>{assert.equal(parseMoney("125.50"),12550);assert.equal(parseMoney("9.5"),950);assert.equal(parseMoney("0"),null);assert.equal(parseMoney("1.234"),null)});
test("validates balanced account selection and fields",()=>{assert.deepEqual(validateJournalEntry(valid),[]);assert.deepEqual(validateJournalEntry({...valid,reference:"!",debitAccount:"revenue"}),["reference","accounts"])});
test("normalizes references and stores minor units",()=>{const item=normalizeJournalEntry({...valid,reference:" jr-301 ",approvedChecked:"on"},"one");assert.equal(item.reference,"JR-301");assert.equal(item.amountMinor,12550);assert.equal(item.approvedChecked,true)});
test("posted entries require evidence and approval",()=>{assert.deepEqual(journalReadiness(normalizeJournalEntry({...valid,evidenceChecked:false,approvedChecked:false})).blockers,["evidenceChecked","approvedChecked"])});
test("sanitizes duplicate and malformed stored entries",()=>{const first=normalizeJournalEntry(valid,"one");assert.deepEqual(safeJournalEntries([first,{...first,id:"two"},{id:"bad"}]).map(item=>item.id),["one"])});
test("calculates posted totals without counting drafts or void entries",()=>{const items=[normalizeJournalEntry(valid,"a"),normalizeJournalEntry({...valid,reference:"JR-302",status:"review",amount:"20",evidenceChecked:false},"b"),normalizeJournalEntry({...valid,reference:"JR-303",status:"void",amount:"500"},"c")];assert.deepEqual(journalMetrics(items),{total:3,draft:0,review:1,posted:1,blocked:1,void:1,totals:{USD:12550,SAR:0,SYP:0,EUR:0}})});
test("filters by kind, status, currency and reference",()=>{const items=[normalizeJournalEntry(valid,"a"),normalizeJournalEntry({...valid,reference:"EX-4",kind:"expense",status:"draft",currency:"SAR"},"b")];assert.deepEqual(filterJournalEntries(items,{query:"ex-4",kind:"expense",status:"draft",currency:"SAR"}).map(item=>item.id),["b"])});


test("excludes unapproved posted entries from posted totals but flags them",()=>{
 const items=[normalizeJournalEntry(valid,"ok"),normalizeJournalEntry({...valid,reference:"JR-999",approvedChecked:false},"blocked")];
 const metrics=journalMetrics(items);
 assert.equal(metrics.total,2);assert.equal(metrics.posted,1);assert.equal(metrics.blocked,1);assert.equal(metrics.totals.USD,12550);
 assert.equal(safeJournalEntries(items).length,2);
});
test("rejects impossible calendar dates",()=>{
 assert.ok(validateJournalEntry({...valid,entryDate:"2026-02-30"}).includes("entryDate"));
 assert.ok(validateJournalEntry({...valid,entryDate:"2026-02-29"}).includes("entryDate"));
 assert.deepEqual(validateJournalEntry({...valid,entryDate:"2028-02-29"}),[]);
});
