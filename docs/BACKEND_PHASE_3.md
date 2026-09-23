# Backend Phase 3

## What is authoritative

- Challenges store definitions in `challenges` and frozen outcomes in `challenge_results` / `challenge_result_members`. They never store an editable progress counter.
- `get_challenge_scores(duo_id)` calculates active scores from `goal_checkins.completed`. A measured check-in's generated completion uses its saved `target_snapshot`, so each member's historical target is respected. Boolean goals use `value = 1`.
- `completion_count` counts member completions. Together uses their sum; Head-to-Head shows each member separately. `target_days` counts days both members completed for Together, and each member's completed days for Head-to-Head. `streak` is the longest consecutive completed run in the challenge window, shared for Together and per member for Head-to-Head.
- `finalize_due_challenges()` locks due challenge rows and freezes scores once after the duo-local end date. Together succeeds when its shared score meets the target; Head-to-Head picks the higher score or a tie. The RPC checks `auth.uid()` membership and is idempotent. It runs on runtime load and after duo day rollover while the app is open. If both members are offline, finalization occurs on the next authenticated load.
- A challenge can last at most 90 duo-local days. Its target cannot exceed the number of possible member completions (Together completion count can earn two per day; the other modes can earn one per day). Existing challenge rows are not rewritten.

## Progress and task history

- The application reads at most the latest 90 duo-local days of check-ins for the existing Week/Month/3 Months views, paging through that bounded date range. The six-week grid starts on Monday and leaves future dates empty.
- A day's denominator consists of participant assignments effective on that date and goal definitions active on that date. A goal with a check-in before being paused/archived on the same day remains applicable for that historical day. `goal_status_events` records status transitions going forward. Existing goals receive an initial active event and known archive/current-pause boundaries. Earlier pause intervals were not recorded by the old schema and cannot be reconstructed accurately.
- Weekly summary means the current Monday-through-today calendar week. The comparison chart remains the last seven days. A perfect duo day is the active, unreversed `perfect_day` XP event produced when all applicable assignments are completed. The lifetime current/best perfect-day streak and total XP come from `get_pet_stats`; the recent calendar uses the same ledger events.
- Habit performance keeps definition IDs distinct. An archived definition remains in the historical dataset, but stops contributing after its archive boundary. A replacement goal definition has a new ID and is not merged with its predecessor.
- Insights require at least seven distinct days with recorded progress in the last 14 days, recent activity, and two habits. The week-over-week improvement sentence appears only when the actual count improved.
- Task Detail requests at most 28 recent check-in rows for one goal. It renders each row with its stored `target_snapshot` and `unit_snapshot`, including archived-goal rows when requested by ID. No lifetime history is fetched for each task card.

## Brownie

- `pet_xp_events` remains the canonical, reversible activity ledger. Today with Brownie shows active current-day ledger events using their real `created_at` timestamps. Reversed events disappear. No client can mint XP or activity.
- `duo_pets` owns the name and equipped accessory; `pet_room_items` owns selected room items. Both users share these rows. Mutations use RLS and the accessory/room entitlement checks, then update local state from the successful write.
- `pet_unlocks` stores permanent earned entitlements. The XP trigger awards the catalog's level/perfect-day unlocks idempotently and serializes threshold checks per duo. If XP later falls below a threshold, a legitimately earned unlock remains available. Old seed unlock rows retain `legacy` origin and cannot authorize equipment until earned. Default items remain available.
- Mood and level are derived, never stored. Static catalog art and labels remain application configuration.

## Realtime and security

- GoalProvider owns today's goal/check-in/assignment subscription. SessionProvider owns one debounced duo runtime subscription covering XP, pet, room, unlock, and challenge rows. Each channel is removed on unmount. The current user's mutation updates its own state immediately; partner events trigger an authoritative refetch.
- RLS is enabled on `goal_status_events`, with duo-only read access and no client write grant. Challenge score and pet-stat RPCs explicitly verify `auth.uid()` membership. Challenge definitions still require same-duo active shared goals and complete duo membership. Clients cannot submit scores, winners, results, XP, or unlocks.
- Migrations `202609230003` through `202609230005` are additive and contain no truncation or deletion of live records. The separate manual reset script was updated only so its disposable PGlite test can include the new foreign-key table; never run it against production users.

## Hosted validation

The linked Supabase project accepted migrations `202609230003` through `202609230005`. Local PGlite tests exercise authenticated same-duo and cross-duo policies, current scores, winner/tie/together finalization, idempotence, locked equipment, earned unlock persistence, and undo. The production UI was not deployed as part of this phase; its two-account, cross-browser realtime behavior still requires validation after deploying this frontend build. Do not infer that a successful database migration proves browser-to-browser realtime delivery.

Suggested two-session check after deployment: sign in as each paired member, create a challenge, complete and undo its goal, compare both scorecards, equip a default accessory and toggle a room item, then verify the partner sees goal, XP, challenge, activity, and customization changes without reload. For an ended challenge, verify the frozen winner/tie with the trusted RPC and deny direct result writes. Verify task history shows the old target after a target edit.

## Remaining Phase 4 work

Production observability, scheduled off-session challenge finalization, deeper query profiling, push notifications, deployment/PWA work, and broader security review remain separate. Phase 3 uses lazy trusted finalization rather than a scheduler.
