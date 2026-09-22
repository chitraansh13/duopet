# Backend Phase 2 — persisted goals and Today

## Architecture

The protected server layout verifies the account, idempotently ensures starter goals, and loads the duo-timezone goal snapshot before rendering. `GoalProvider` receives that serializable state and remains the visual components’ API. Raw Supabase rows stop at `lib/repositories/goals.ts` and `goal-adapters.ts`.

The domain projection remains goal definitions plus dated check-ins. Real UUIDs come from the authenticated profile and paired member; “You” and “Friend” are presentation labels only. Production runtime data now comes from Supabase; fixtures are available only through the explicit server-side demo mode.

## Persistence behavior

- Shared and personal goals are created transactionally with their assignments.
- Duration targets/values use canonical seconds in PostgreSQL and retain `min`/`hrs` as display metadata.
- Shared measured goals retain independent per-member targets.
- Metadata and own-user targets update atomically. A target can take effect today when selected explicitly, including a deliberate update of the caller's current-day snapshot, or tomorrow while today's snapshot remains unchanged.
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

Each member controls only their own target. If no check-in exists today, an edit takes effect today. With a current-day check-in, the form offers Today or Starting tomorrow.

## Realtime

Hosted Realtime publishes `goals`, `goal_assignments`, `goal_checkins`, and `pet_xp_events`. The client filters check-ins to the duo logical date, validates goal/user relevance, and merges them by `(goal_id,user_id,local_date)`. Definition/assignment events trigger a fresh authoritative goal snapshot rather than merging stale projected objects. XP events refresh the shared companion snapshot.

## Security

Phase 1 RLS remains intact. Clients update only their own check-ins. Personal definitions are manageable only by the owner; either duo member can manage shared definitions. The transactional creation/update/bootstrap functions validate authenticated membership and participant sets. The private insertion helper has no authenticated execute privilege.

PGlite exercises the full migration chain with authenticated roles, personal-goal negative tests, cross-duo denial, snapshot retention, archive retention, and RPC privilege checks. Hosted migrations were applied to the linked project and the existing complete duo seed ran idempotently. The available automated browser was signed out and no account credentials were stored, so a fresh two-session hosted realtime UI replay was not claimed.

## Production data boundary

Production Progress, challenge lists, Brownie XP, levels, streaks, perfect days, and pet activity are loaded from Supabase. Missing rows produce zero or empty states. `DUOPET_DATA_MODE=demo` is the only fixture entry point and is intended for an explicit local preview.

Challenge creation and challenge progress derivation remain deferred. Task mini-history is an honest empty state until its dedicated query is added. Accessory and room selection interactions remain local-only; production uses persisted/default selections and real level-based locking on reload. Notifications remain outside this phase.
