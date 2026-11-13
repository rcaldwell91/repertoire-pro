-- Robert, 13 Nov (his answer to the 4 Nov plan's question 4): Match the
-- note's "how close it settles", kept with the result. One number that can
-- be left empty, in hundredths of a half step (cents), like the existing
-- "cents" column. No change to who can read or write results: the table's
-- rules (rs_ins, rs_read) are exactly as they were.
alter table public.results add column if not exists settle_cents integer;
