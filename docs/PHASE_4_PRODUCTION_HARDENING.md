# Phase 4 production hardening

## Installability and iPhone UI

`app/manifest.ts` serves `/manifest.webmanifest` with the DuoPet name, standalone display, warm ivory background, oxblood theme, and the existing 192/512 Brownie PNGs. Root metadata explicitly points iOS to `/apple-touch-icon.png` (180×180) and enables the Apple web app title/status bar. There is no service worker: the app needs live authenticated Supabase data, so an offline shell would misleadingly imply that writes are saved.

The application already reserves the bottom safe area for its floating navigation, uses `dvh` for onboarding, scrollable goal/challenge/food sheets, visible keyboard focus, and reduced-motion styles. Phase 4 adds bottom safe-area padding to auth and profile/food sheets and sets mobile form controls to at least 16px to prevent Safari focus zoom. At a 390×844 desktop-browser viewport, the deployed login had no horizontal overflow; this is not a physical iPhone Safari test. Recheck Today, Tasks, Food, Pet, Progress, Profile, and onboarding on an iPhone after deployment, including keyboard-open sheets and Home Screen icon. Remove any old Home Screen shortcut before reinstalling if iOS cached an older icon.

Public auth routes and icon/manifest assets bypass the session-refresh proxy. This keeps sign-in and recovery usable when Supabase is temporarily unreachable; protected routes still require server-side authentication. The local production build served `/manifest.webmanifest` with HTTP 200 and loaded `/login` at 390×844 without horizontal overflow or sub-16px form controls.

## Loading, errors, and network recovery

The protected App Router layout displays a loading state while account/runtime data resolves; an initial server failure reaches the retryable error boundary. Runtime and goal refresh failures now show a retry action while keeping the last authoritative state. Food and food-history query failures no longer render invented empty/zero results. Mutation forms keep draft input on failure and report a safe inline message. `online` is only a retry signal, not proof of connectivity. Realtime resubscription refetches authoritative state; visible-tab refresh covers sleep/background gaps. Failed writes never receive optimistic success.

`lib/diagnostics.ts` logs only a stable area and bounded error code. It never logs request bodies, emails, tokens, passwords, food entries, or Supabase error objects. App render errors, auth failures, critical refresh/mutation failures, and realtime channel errors go to browser/Vercel logs. For incident diagnosis, correlate the area/code with Supabase Auth, Postgres, Realtime, and `cron.job_run_details`. No external monitoring key or service was added.

## Scheduled finalization

`202609260001_scheduled_daily_finalization.sql` adds a database-owner-only wrapper. It selects one existing member per duo, invokes the *existing* authenticated `finalize_due_goal_days()` and `finalize_due_challenges()` functions, and restores the temporary database claim. The wrapper has a pinned `search_path`, rejects non-`postgres` sessions, and has no client execute grant. It does not create another XP or challenge-calculation path. The existing finalizers use each duo's IANA timezone and idempotent check-in/result/XP constraints. Hourly Cron at minute 17 closes each due duo day within roughly an hour of local midnight; retries are safe. Client-load/day-rollover finalization remains available.

Enable **Supabase Dashboard → Integrations → Cron (`pg_cron`)** before `npx supabase db push`. If the extension was unavailable during migration, the function is still installed and a notice is emitted. After enabling it, run once as the database owner in SQL Editor:

```sql
select cron.schedule('duopet-finalize-due-days', '17 * * * *',
  'select private.run_scheduled_finalization()');
```

Verify the job and recent runs:

```sql
select jobid, jobname, schedule, command from cron.job
where jobname = 'duopet-finalize-due-days';
select status, return_message, start_time, end_time from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'duopet-finalize-due-days')
order by start_time desc limit 10;
```

The embedded PostgreSQL test invokes the wrapper twice after advancing the duo day: first invocation finalizes due rows, second returns zero, and an authenticated client cannot execute the wrapper. The hosted Cron extension/job and its first run still require direct hosted verification.

## Authentication and email

Signup, resend, and password-reset links resolve to `https://duopet-pi.vercel.app` when `VERCEL_ENV=production`; localhost remains a local-development default. Keep hosted Supabase Auth **Site URL** at that production origin, and allow `/auth/confirm` plus `/auth/confirm?flow=recovery` there. The confirmation handler accepts supported signup and recovery token-hash links and PKCE `code` callbacks. It exchanges/validates the link before establishing a session; expired/reused links get recoverable copy. The new login recovery form requests a reset email without revealing account existence, and `/reset-password` requires a verified session before `updateUser`. Successful reset signs out the local session and returns to login. No email-confirmation bypass was added.

For iPhone cross-browser email opening, use token-hash templates. **Confirm signup**:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your DuoPet account</a>
```

**Reset password**:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&flow=recovery">Reset your DuoPet password</a>
```

The default `{{ .ConfirmationURL }}` template is also supported, but PKCE code exchange needs the initiating browser's verifier. The repository cannot read the hosted SMTP toggle. Supabase's default email sender is intended for testing, has restricted recipients/rates, and is not reliable for production. Configure custom SMTP in **Supabase Auth → SMTP Settings** with your provider's host, port, username, password, verified From address, and appropriate rate limits. Keep credentials out of Git/Vercel public variables. See [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

## Realtime and performance

Each domain has a bounded channel and removes it on unmount. Goal subscriptions now avoid resubscribing when only check-ins change. Runtime, goals, sharing, Food, and food history refetch after reconnect; sharing changes clear previously rendered private partner data before authoritative reload. Food catalog and Today diary load independently so a diary outage does not falsely produce “No saved foods.”

The hot runtime fetch uses bounded 90-day check-ins and parallel reads; Food history is date-bounded. There is no per-food-row channel or lifetime-history fetch. Initial layout still loads current goals separately from the historical runtime snapshot, so it does duplicate some small goal/assignment reads. Retain that until hosted timings show it matters. No speculative index or broad provider rewrite was introduced.

## Security, environment, and deployment checks

All public data tables in the migration-backed embedded database have RLS enabled. Tests cover profile/duo isolation, partner write rejection, food privacy, food-derived check-in spoofing, XP/unlock restrictions, and challenge result spoofing. SECURITY DEFINER functions in public/private schemas have pinned search paths. The new Cron wrapper has no authenticated/anon execute grant. No service-role key is used in browser code. `.gitignore` excludes `.env`, `.env.*` except `.env.example`; only the example file is tracked. This is a repository audit, not direct proof of hosted policy drift or Vercel environment values.

The Vercel deployment already exists; no new deployment infrastructure was created. Set/verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://duopet-pi.vercel.app`, and `DUOPET_DATA_MODE=production` in Vercel Production. Verify Supabase Auth Site URL and allowed redirects separately. Apply migrations with `npx supabase link --project-ref YOUR_PROJECT_REF` then `npx supabase db push`; never use `db reset` on production. Check `/manifest.webmanifest`, `/apple-touch-icon.png`, `/icon-192.png`, and `/icon-512.png` on the released URL.

## Hosted smoke checklist and limits

The public deployment was inspected at 390×844: login displayed without horizontal overflow and served the existing Apple touch icon, but it was still the earlier release without a manifest. The current workspace changes have **not** been deployed or exercised against the live paired users. After deployment, verify both users' sign-in/session persistence; A→B goal/food/XP/pet updates; privacy OFF/ON redaction; Progress history; offline retry/reconnect; password reset and expired link recovery; Cron job runs and finalization; then install on an actual iPhone. Do not reset or delete the real duo. Hosted Supabase SMTP and Cron settings, Vercel environment values, and two-user behavior cannot be certified from repository tests alone.

## Optional later work

Push notifications are deferred. If added, use per-user opt-in preferences and quiet hours in the duo timezone for goal, nutrition, partner, and end-of-day reminders. Keep reminders independent of authoritative goal/XP finalization and avoid repeated nudges.
