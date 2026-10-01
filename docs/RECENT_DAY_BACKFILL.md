# Recent-day backfill

Tasks and Food permit owner corrections until the end of the selected duo-local date plus **36 elapsed hours**. The end is the next midnight resolved in the duo's IANA timezone, not the device timezone. PostgreSQL then adds 36 hours, including across daylight-saving transitions. The cutoff is exclusive: Sep 30 in Asia/Kolkata is editable at Oct 2 11:59 AM, and read-only at Oct 2 12:00 PM.

## One trusted window

`private.day_edit_deadline` and `private.day_is_editable` define the rule. Write RPCs lock the duo, read database time, then validate the selected day. Future dates are rejected. Clients cannot execute either helper, submit a clock, forge mutation timestamps, or write check-ins/diary entries directly.

`get_editable_days` authenticates the caller and returns only their duo's eligible dates, deadlines, and server time. Tasks/Food share one hook and selector. The UI advances returned server time by elapsed monotonic time and refreshes periodically/on reconnect/visibility. Lookup failures disable editing. Every write independently checks the database cutoff.

The quick selector includes Today, Yesterday, and, while eligible, the day before yesterday. Historical selection shows an editing banner and deadline in the duo timezone. A selected day stays visible after expiration, with disabled controls and “Editing window closed.” Food's existing 14-day History permits viewing older dates and entering the edit view for eligible own dates. Partner views stay read-only. Task details retain bounded recent history with no editable controls on expired rows.

## Tasks and historical targets

`set_goal_checkin` derives the user from `auth.uid()`, verifies membership, their applicable assignment, and the goal's historical active status. Boolean, numeric, and duration/manual goals use the same RPC. Food-derived goals remain read-only and link to the selected Food date.

Existing check-ins keep their target/unit/direction/tolerance/input-rule snapshots. New historical check-ins use the assignment effective on that date, never today's target. Goals archived or paused later remain correctable for dates on which they were active, within grace. Future/paused/archived-date contributions are rejected.

## Food and timestamps

The existing `save_food_log` RPC accepts optional `p_local_date`; omitted dates mean today for additions and the entry's own date for quantity edits. Its old three-argument signature is replaced by the defaulted four-argument signature, avoiding ambiguous REST overloads. `delete_food_log` validates the entry's actual date. Both enforce caller ownership and the same window. No partner user ID is accepted.

Nutrition/serving/name snapshots are unchanged during quantity edits. New entries snapshot the selected catalog definition. `local_date` is the chosen habit day; `created_at` and `updated_at` remain actual database mutation timestamps, including for backfill. Catalog archival does not delete diary history.

## Atomic reconciliation

A finalized day is provisionally closed, not permanently immutable during grace. An eligible RPC changes canonical data and **re-evaluates the still-closed day in the same transaction**. It preserves original `finalized_at` rather than exposing an intermediate open state. Newly inserted historical check-ins are immediately closed. Today's end-of-day goals remain pending.

Existing food aggregation, generated completion fields, `sync_checkin_xp`, and `set_xp_event` reconcile goal XP, shared bonuses, and Perfect Duo Day. Deterministic event keys reverse/reactivate the same ledger row. Eligible legacy 5/10-XP outcomes may correct the amount on that row; expired XP identity/amount stays frozen. The migration performs no history backfill, XP rewrite, or other user-data DML.

Current required-input Calories succeeds on a closed day only if real food entries exist and calories are at most its historical target plus saved upper tolerance (normally 200). No input fails; no lower failure bound or partial reward applies. Food removal can revoke calorie XP/Perfect Duo Day, and re-addition restores each once. Today's Calories never gains early completion XP.

Actual positive manual or food input records the selected logical date in existing `user_activity_days`. Current/best activity streaks and Progress derive from those records and refresh after corrections. Partner input/background finalization never adds the caller's activity. Undo does not erase the fact that the user genuinely interacted; completion achievements reverse independently.

## Dormant challenges and scheduling

The existing challenge scorer stays canonical. Its result calculation is extracted into one private helper used by the existing finalizer and backfill reconciliation. Completed challenges containing the corrected date recompute outcome, winner/tie, and member scores while their end date remains editable. Unchanged results are not rewritten. After that deadline results freeze. Only trusted owner code can revise eligible results; no client result/write grants exist, and identity stays immutable. Active challenge scores already derive from check-ins.

The existing `private.run_scheduled_finalization()` and hourly Cron job are retained without schedule changes. Retries cannot duplicate goal/shared/perfect-day rewards. No second scheduler or XP system is introduced.

## Realtime and privacy

The existing goal subscription accepts authorized check-ins across dates, merges only today's rows into Today's state, and invalidates historical Tasks/runtime views. Own mutation results reconcile immediately. Existing food/day-update and XP/activity subscriptions refresh Food, partner aggregates, Progress, and Brownie. Challenge results join the existing realtime publication/runtime subscription. No channel is created for every selectable date; cleanup cancels subscriptions/timers and late date-query responses are ignored.

RLS/share preferences are unchanged. Historic personal goal and nutrition reads obey owner settings. Revocation filters cached task/history displays before refetch. Browsers cannot choose partner ownership, manufacture activity/XP/results, submit food-derived values, or bypass expiry with timestamps.

## Migration and validation

Additive migration: `20261001044027_recent_day_backfill.sql`. Apply after reviewing the linked CLI dry run using `db push --linked --skip-vault --yes`. Do not edit applied migrations or reset data.

`backfill.test.mjs` applies the full migration chain to disposable PGlite. Controlled-clock tests cover exact Kolkata cutoff, DST elapsed-hour deadlines, boolean/numeric/duration corrections, historical targets, archived-definition history, food snapshots/timestamps, expired/future/partner/cross-duo denial, calorie 1200+500 success and 1700+250 failure, unlogged-to-logged transitions, XP undo/redo, Perfect Duo Day reversal/restoration, activity-gap bridging/best streak, challenge winner/tie correction/freeze, and scheduled retries. UI helper/daily-state merge tests ensure expiry and historical updates do not overwrite Today.

Hosted verification uses migration metadata, definition/grant checks, aggregate fingerprints, Cron/publication inspection, and read-only deadline checks. No real diaries/targets/XP are modified for tests. Browser smoke checks should select each eligible day in Tasks/Food, confirm the banner and own controls, correct an entry, observe partner-permitted updates, and confirm an expired selected day becomes read-only.

Hosted verification on 2026-10-01: migration `20261001044027` applied successfully and the linked dry run reports no pending migrations. Before/after fingerprints match for every public production table, including 52 check-ins, 28 diary entries, 53 XP events, and 21 target assignments. Policy fingerprints and the active `duopet-finalize-due-days` job (`17 * * * *`, existing private wrapper) are unchanged. Hosted cutoff checks return true at Oct 2 11:59 AM Kolkata and false at noon. A read-only authenticated transaction returned the correct three current editable dates and confirmed denied direct writes/scheduler execution; it was rolled back. Private helpers are non-executable by browser roles, search paths are pinned, and result/XP helper ownership matches the guarded tables. Challenge results and existing check-in/food/XP/activity signals are published. Database types were regenerated from this schema.

Security advisors flag the intentionally authenticated, caller-validated [SECURITY DEFINER RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains outside this focused change. No auth setting was altered. The browser connection had no signed-in tab, so a live account/browser correction and two-session smoke test were not performed. Frontend deployment remains a release step; production user data was not changed for testing.
