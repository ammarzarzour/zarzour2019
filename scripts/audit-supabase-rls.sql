-- Zarzour Travel & Zarzour Soft: read-only Supabase RLS policy inventory.
-- Run in the Supabase SQL editor with a role allowed to inspect pg_catalog.
-- This query does NOT read application records, alter grants, enable policies,
-- create users, or grant access. Do not paste service-role keys into this file.
-- RLS_NO_POLICY means default-deny for ordinary RLS-subject roles, NOT an
-- invitation to add permissive policies. Review each table's access design
-- and tenant isolation before any separate, explicitly authorized migration.
-- POLICIES_PRESENT_REVIEW_REQUIRED is NOT proof that policies are safe.
WITH public_tables AS (
  SELECT n.nspname AS schema_name,
         c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         (SELECT count(*)::int
            FROM pg_policies p
           WHERE p.schemaname = n.nspname
             AND p.tablename = c.relname) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
)
SELECT schema_name,
       table_name,
       rls_enabled,
       policy_count,
       CASE
         WHEN NOT rls_enabled THEN 'RLS_DISABLED'
         WHEN policy_count = 0 THEN 'RLS_NO_POLICY'
         ELSE 'POLICIES_PRESENT_REVIEW_REQUIRED'
       END AS review_status
  FROM public_tables
 ORDER BY review_status, table_name;
