-- Robert, 22 Nov (his answer to the 21 Nov report): the level a result was
-- sung at, in its own column, so a coach can sort by it. 1 Beginner,
-- 2 Intermediate, 3 Advanced; it can be left empty, and results saved
-- before it existed stay without one. No change to who can read or write
-- results: the table's rules (rs_ins, rs_read) are exactly as they were.
alter table public.results add column if not exists level smallint
  check (level is null or level between 1 and 3);
