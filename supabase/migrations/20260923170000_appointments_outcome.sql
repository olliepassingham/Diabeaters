-- Structured post-visit outcomes on appointments (HbA1c, eye/foot screening, short note).
-- User-entered educational history — not lab interpretation.

alter table public.appointments
  add column if not exists outcome jsonb;

comment on column public.appointments.outcome is
  'Optional post-visit results: { hba1cPercent, resultDate, eyeResult, footResult, outcomeNote }';
