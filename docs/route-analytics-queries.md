# Route analytics — SQL Editor queries

Diabeaters records one row per signed-in screen view in `public.app_route_views`
(normalised path only — no query strings, no clinical data). App users can insert
rows but cannot read them; you read everything here as project owner.

First apply the migration `supabase/migrations/20261022130000_app_route_views.sql`
(paste it into the SQL Editor and Run), then use the queries below.

## Top routes — last 7 days

```sql
select
  route,
  count(*) as views,
  count(distinct user_id) as users
from public.app_route_views
where created_at >= now() - interval '7 days'
group by route
order by views desc
limit 50;
```

## Top routes — last 30 days

```sql
select
  route,
  count(*) as views,
  count(distinct user_id) as users,
  round(count(*)::numeric / nullif(count(distinct user_id), 0), 1) as views_per_user
from public.app_route_views
where created_at >= now() - interval '30 days'
group by route
order by views desc
limit 50;
```

## Daily active users (DAU)

```sql
select
  date_trunc('day', created_at)::date as day,
  count(distinct user_id) as active_users,
  count(*) as total_views
from public.app_route_views
where created_at >= now() - interval '30 days'
group by 1
order by 1;
```

## New vs returning users per day

A user counts as "new" on the first day they ever appear in the table.

```sql
with first_seen as (
  select user_id, date_trunc('day', min(created_at))::date as first_day
  from public.app_route_views
  group by user_id
),
daily as (
  select distinct user_id, date_trunc('day', created_at)::date as day
  from public.app_route_views
  where created_at >= now() - interval '30 days'
)
select
  d.day,
  count(*) filter (where f.first_day = d.day) as new_users,
  count(*) filter (where f.first_day < d.day) as returning_users
from daily d
join first_seen f on f.user_id = d.user_id
group by d.day
order by d.day;
```

## One user's journey (support debugging)

Replace the UUID with the user's id from `public.profiles`.

```sql
select created_at, route
from public.app_route_views
where user_id = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 200;
```

## Routes a specific feature area gets (example: scenarios/guides)

```sql
select
  route,
  count(*) as views,
  count(distinct user_id) as users
from public.app_route_views
where created_at >= now() - interval '30 days'
  and route like '/scenarios%'
group by route
order by views desc;
```

## Housekeeping — prune rows older than 90 days (optional, run occasionally)

```sql
delete from public.app_route_views
where created_at < now() - interval '90 days';
```

## Notes

- Routes are normalised in the app: `/community/profile/<uuid>` is stored as
  `/community/profile/:id` and `/community/u/<handle>` as `/community/u/:handle`,
  so counts aggregate per screen rather than per person/post.
- Data starts accumulating only after the migration is applied and a build with
  route tracking is in users' hands. Until the table exists, the app quietly
  skips sending (no errors shown to users).
