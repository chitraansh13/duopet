# Backend Phase 2 — persisted goals and Today

## Architecture

The protected server layout verifies the account, idempotently ensures starter goals, and loads the duo-timezone goal snapshot before rendering. `GoalProvider` receives that serializable state and remains the visual components’ API. Raw Supabase rows stop at `lib/repositories/goals.ts` and `goal-adapters.ts`.

The domain projection remains goal definitions plus dated check-ins. Real UUIDs come from the authenticated profile and paired member; “You” and “Friend” are presentation labels only. Challenges intentionally use their isolated demo fixtures until their own persistence phase.

## Persistence behavior

- Shared and personal goals are created transactionally with their assignments.
- Duration targets/values use canonical seconds in PostgreSQL and retain `min`/`hrs` as display metadata.
- Shared measured goals retain independent per-member targets.
- Metadata and future targets update atomically. Target changes take effect tomorrow; today and history keep their captured denominator.
- Tracking, scope, measurement-kind, or display-unit changes create a replacement definition and archive the old definition in one transaction.
- Pause/resume changes status without touching history. “Delete” archives; no goal/check-in history is hard-deleted.
- Boolean undo stores value `0`; measured values are not capped.
- The own-user check-in RPC explicitly verifies duo membership, active goal, applicable assignment, and logical date before its trigger captures immutable snapshots.

## Starter goals

Existing complete duos with no goals are seeded once by migration. Future complete duos call the idempotent bootstrap RPC. The temporary defaults are:

- Gym and 8K Steps: shared boolean.
- Study: slot 1 = 4 hours, slot 2 = 3 hours.
- Diet: slot 1 = 2200 kcal, slot 2 = 1700 kcal.
- Protein Intake: slot 1 = 150 g, slot 2 = 95 g.

Targets can be edited immediately; changed targets become effective the next duo day.

## Realtime

Hosted Realtime publishes only `goals`, `goal_assignments`, and `goal_checkins`. The client filters check-ins to the duo logical date, validates goal/user relevance, and merges them by `(goal_id,user_id,local_date)`. Definition/assignment events trigger a fresh authoritative goal snapshot rather than merging stale projected objects.

## Security

Phase 1 RLS remains intact. Clients update only their own check-ins. Personal definitions are manageable only by the owner; either duo member can manage shared definitions. The transactional creation/update/bootstrap functions validate authenticated membership and participant sets. The private insertion helper has no authenticated execute privilege.

PGlite exercises the full migration chain with authenticated roles, personal-goal negative tests, cross-duo denial, snapshot retention, archive retention, and RPC privilege checks. Hosted migrations were applied to the linked project and the existing complete duo seed ran idempotently. The available automated browser was signed out and no account credentials were stored, so a fresh two-session hosted realtime UI replay was not claimed.

## Still demo-backed

Challenges and their history, Progress history/charts, Task mini-history before today, Brownie XP ledger/level persistence, accessories/room persistence, and notifications remain outside Phase 2. Brownie mood and Duo Energy now derive from real current-day goal completion; displayed XP remains an explicitly non-ledger projection.
