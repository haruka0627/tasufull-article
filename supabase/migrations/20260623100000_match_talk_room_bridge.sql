-- MATCH ↔ TASFUL TALK bridge helpers (linked ref)
-- Prerequisite: match_pairs (L10) · transaction_rooms (TALK)
-- Ref: reports/match-talk-room-integration-report.md
--
-- Scope:
--   - Index for idempotent match room lookup via listing_type + listing_id
--   - Optional match_pair_id on transaction_rooms (reverse link for ops)
--   - NO changes to MATCH RLS policies

-- ---------------------------------------------------------------------------
-- transaction_rooms — reverse link (optional · nullable)
-- ---------------------------------------------------------------------------

alter table public.transaction_rooms
  add column if not exists match_pair_id uuid;

create unique index if not exists transaction_rooms_match_pair_id_uidx
  on public.transaction_rooms (match_pair_id)
  where match_pair_id is not null;

create index if not exists transaction_rooms_listing_match_idx
  on public.transaction_rooms (listing_type, listing_id)
  where listing_type = 'match';

comment on column public.transaction_rooms.match_pair_id is
  'Optional reverse link to match_pairs.id for MATCH DM rooms.';

-- ---------------------------------------------------------------------------
-- match_pairs.talk_room_id FK (optional · deferred until TALK env stable)
-- ---------------------------------------------------------------------------
-- alter table public.match_pairs
--   add constraint match_pairs_talk_room_id_fkey
--   foreign key (talk_room_id) references public.transaction_rooms (id) on delete set null;
