# Phase 2 post-APPLY verify (SELECT only)

Run **one file per Editor execution**. APPLY is still forbidden until separate human GO.

| # | File | Checks |
|---|------|--------|
| 01 | `01-tables-readonly.sql` | 6 Phase 2 tables |
| 02 | `02-indexes-readonly.sql` | 15 indexes |
| 03 | `03-triggers-readonly.sql` | triggers |
| 04 | `04-helper-functions-readonly.sql` | helper/trigger fns |
| 05 | `05-rpc-functions-readonly.sql` | business RPCs |
| 06 | `06-rls-enabled-readonly.sql` | RLS flags |
| 07 | `07-policies-readonly.sql` | policy names |
| 08 | `08-policy-count-readonly.sql` | policy_count=8 |
| 09 | `09-grants-readonly.sql` | grants |
| 10 | `10-security-definer-search-path-readonly.sql` | DEFINER + search_path |
| 11 | `11-legacy-mapping-view-readonly.sql` | mapping view |
| 12 | `12-legacy-guard-readonly.sql` | legacy 4 tables |
