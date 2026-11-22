-- Zarzour Travel & Zarzour Soft: read-only Supabase RLS policy inventory.
-- Run with a role permitted to inspect pg_catalog and pg_policies.
-- Inspects metadata only; never reads application rows or changes privileges.
-- RLS_NO_POLICY means default-deny for RLS-subject roles, not a request
-- to add broad policies. Owners and BYPASSRLS roles can bypass ordinary RLS.
-- POLICIES_PRESENT_REVIEW_REQUIRED does not prove policies are secure.
-- Includes ordinary and partitioned tables; FORCE RLS is reported separately.
WITH public_tables AS (
  SELECT n.nspname AS schema_name,
         c.relname AS table_name,
         c.relkind = 'p' AS is_partitioned,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS force_rls,
         count(p.policyname)::int AS policy_count,
         count(p.policyname) FILTER (WHERE p.cmd = 'SELECT')::int AS select_policy_count,
         count(p.policyname) FILTER (WHERE p.cmd = 'INSERT')::int AS insert_policy_count,
         count(p.policyname) FILTER (WHERE p.cmd = 'UPDATE')::int AS update_policy_count,
         count(p.policyname) FILTER (WHERE p.cmd = 'DELETE')::int AS delete_policy_count,
         count(p.policyname) FILTER (WHERE p.cmd = 'ALL')::int AS all_command_policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
   GROUP BY n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
)
SELECT *,
       CASE
         WHEN NOT rls_enabled THEN 'RLS_DISABLED'
         WHEN policy_count = 0 THEN 'RLS_NO_POLICY'
         ELSE 'POLICIES_PRESENT_REVIEW_REQUIRED'
       END AS review_status
  FROM public_tables
 ORDER BY review_status, table_name;
