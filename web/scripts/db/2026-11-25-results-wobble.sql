-- Robert, 25 Nov (his answer to the 24 Nov report): Vibrato's speed and
-- width saved to the account, so they follow the singer to a new phone and
-- a linked coach can read them. Over the held notes that wobbled: how fast
-- (cycles a second, to two places) and how wide (cents, top to bottom).
-- Both can be left empty: a session with no wobble, every other exercise,
-- and results saved before these existed stay without them. No change to
-- who can read or write results: the table's rules (rs_ins, rs_read) are
-- exactly as they were.
alter table public.results add column if not exists wobble_rate numeric(4,2)
  check (wobble_rate is null or (wobble_rate > 0 and wobble_rate < 20));
alter table public.results add column if not exists wobble_width smallint
  check (wobble_width is null or (wobble_width > 0 and wobble_width <= 1200));
