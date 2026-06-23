-- P1: transaction_rooms contact / service bridge columns (idempotent ensure)
-- Prerequisite: transaction_rooms (TALK)

alter table public.transaction_rooms
  add column if not exists contact_id text,
  add column if not exists source text,
  add column if not exists service_type text,
  add column if not exists service_ref_id text;

create unique index if not exists transaction_rooms_contact_id_uidx
  on public.transaction_rooms (contact_id)
  where contact_id is not null and contact_id <> '';

create index if not exists transaction_rooms_service_ref_idx
  on public.transaction_rooms (service_type, service_ref_id)
  where service_type is not null and service_ref_id is not null;

comment on column public.transaction_rooms.contact_id is
  'listing-contact-requests contact_id — idempotent room ensure key (P1)';
