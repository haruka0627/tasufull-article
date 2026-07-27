-- SELECT only · gen_random_uuid() usability (Phase 2 defaults depend on it)

select
  gen_random_uuid() is not null as gen_random_uuid_callable,
  pg_typeof(gen_random_uuid())::text as return_type;
