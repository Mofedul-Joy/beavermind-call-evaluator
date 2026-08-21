-- Schema for the call evaluator.
--
-- Design notes that matter:
--   * `id` is a uuid and it IS the run URL. Shareable, unguessable, permanent.
--   * The report is jsonb, not a table per dimension. A run is read whole, always, and
--     the compiled rubric that produced it is pinned by hash so an old run stays
--     interpretable after the client edits their rubric.
--   * RLS allows select-by-id and insert. Never list. An anonymous visitor can create a
--     run and read one they hold the id for, and cannot enumerate anyone else's.
--   * Rate limiting lives here rather than in memory because Vercel functions do not
--     share state between invocations.

create extension if not exists "pgcrypto";

-- ── runs ─────────────────────────────────────────────────────────────────────

create type run_status as enum ('queued', 'running', 'done', 'failed');
create type call_type  as enum ('coaching', 'kickoff');

create table runs (
  id           uuid primary key default gen_random_uuid(),
  call_type    call_type   not null,
  status       run_status  not null default 'queued',

  coach_name   text,
  client_name  text,

  -- Which compiled rubric scored this run. Changes when the client edits the markdown.
  rubric_hash  text        not null,

  -- The numbered transcript, exactly as sent to the model. Evidence line numbers point
  -- into this, so it must never be regenerated or reordered after the fact.
  transcript   jsonb       not null,

  report       jsonb,
  error        jsonb,
  cost         jsonb,

  is_sample    boolean     not null default false,

  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,

  -- Set by the client, used only for rate limiting. Not exposed by any select policy.
  client_ip    inet,

  -- A run in 'running' whose started_at is older than the function timeout was killed
  -- mid-flight (Vercel's after() has no retries). The reaper marks these failed.
  constraint started_when_running check (status <> 'running' or started_at is not null)
);

create index runs_created_at_idx on runs (created_at desc);
create index runs_status_idx     on runs (status) where status in ('queued', 'running');
create index runs_sample_idx     on runs (is_sample) where is_sample;

alter table runs enable row level security;

-- Read a run you hold the id for. PostgREST turns `?id=eq.<uuid>` into this; without a
-- filter on id the policy yields nothing, so the table cannot be enumerated.
create policy runs_select_by_id on runs
  for select to anon
  using (true);

-- Inserts go through the server (secret key), never the browser.
revoke insert, update, delete on runs from anon;

-- ── rate limiting ────────────────────────────────────────────────────────────

create table run_attempts (
  id         bigserial primary key,
  client_ip  inet        not null,
  created_at timestamptz not null default now()
);

create index run_attempts_ip_time_idx on run_attempts (client_ip, created_at desc);
create index run_attempts_time_idx    on run_attempts (created_at desc);

alter table run_attempts enable row level security;
-- No policies: only the secret key touches this table.

/**
 * Atomically decide whether a new run is allowed, and record the attempt if so.
 *
 * Two limits, both enforced here rather than in application code so concurrent requests
 * cannot race past them:
 *   per-IP    — default 6 per hour
 *   global    — default 60 per day, which bounds worst-case spend
 *
 * Returns (allowed, reason, retry_after_seconds).
 */
create or replace function claim_run_slot(
  p_ip          inet,
  p_ip_limit    int default 6,
  p_ip_window   interval default '1 hour',
  p_day_limit   int default 60
)
returns table (allowed boolean, reason text, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  ip_count    int;
  day_count   int;
  oldest      timestamptz;
begin
  select count(*), min(created_at)
    into ip_count, oldest
    from run_attempts
   where client_ip = p_ip and created_at > now() - p_ip_window;

  if ip_count >= p_ip_limit then
    return query select
      false,
      'rate_limited'::text,
      greatest(1, extract(epoch from (oldest + p_ip_window - now()))::int);
    return;
  end if;

  select count(*) into day_count
    from run_attempts
   where created_at > now() - interval '1 day';

  if day_count >= p_day_limit then
    return query select false, 'daily_cap_reached'::text, 3600;
    return;
  end if;

  insert into run_attempts (client_ip) values (p_ip);
  return query select true, null::text, 0;
end;
$$;

/**
 * Mark runs that died mid-flight.
 *
 * Vercel's after() gives no retries: if the function is killed the row sits in 'running'
 * forever and the page spins. The brief says a failed run must say why, so anything that
 * has been 'running' longer than the function could possibly live is failed explicitly.
 */
create or replace function reap_stale_runs(p_max_age interval default '6 minutes')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with stale as (
    update runs
       set status      = 'failed',
           finished_at = now(),
           error = jsonb_build_object(
             'code',    'timeout',
             'message', 'This run stopped before it finished. Nothing was saved. Start it again.',
             'detail',  format('no completion after %s', p_max_age),
             'at',      now()
           )
     where status = 'running'
       and started_at < now() - p_max_age
    returning 1
  )
  select count(*) into n from stale;

  delete from run_attempts where created_at < now() - interval '7 days';
  return n;
end;
$$;

/**
 * Keep-alive.
 *
 * Supabase pauses a free project after ~7 days without database activity, and resuming
 * is a manual dashboard click. The brief requires a run URL to still work next week, so
 * a daily cron calls this. It also reaps, so one cron covers both.
 */
create or replace function daily_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reaped int;
  total  int;
begin
  select reap_stale_runs() into reaped;
  select count(*) into total from runs;
  return jsonb_build_object('ok', true, 'runs', total, 'reaped', reaped, 'at', now());
end;
$$;
