# Backend Phase 1 — design and verification

**Follow-up:** [Onboarding fix](ONBOARDING_FIX.md) supersedes the original one-member entry behavior: a one-member duo now receives an explicit waiting screen before dashboard entry.

## Architecture and scope

`app/(app)/layout.tsx` protects the existing routes without changing their URLs. It verifies the user through Supabase Auth, loads their profile and duo, and redirects unfinished accounts to `/onboarding`. Root layout keeps the existing theme. Auth and onboarding do not instantiate goal/challenge providers. The protected layout retains shared audited providers and keys SessionProvider by the real user ID to prevent state leaking across account changes.

`lib/supabase/{client,server}.ts` separate browser and server clients. Next 16 `proxy.ts` refreshes SSR cookies and validates claims. Server layouts/actions independently verify the Auth user; proxy alone is not an authorization boundary. Cookies persist sessions. Logout ends the current device session. Repositories use the public key plus the user's cookies/JWT, so RLS also applies to server actions. No service-role client exists.

`lib/repositories/{profile,duo,adapters}.ts` form the small database-to-domain boundary. Components never receive raw Supabase error objects. `lib/auth/domain.ts` carries real IDs and onboarding guards. Bootstrap database types cover the whole schema; regenerate against the linked project with the provided script.

Login/signup use the existing oxblood/champagne palette, theme control, glass materials, and Brownie artwork. Forms have visible labels, pending states and announced errors. Auth MotionConfig respects reduced motion; pairing success is text, with no extra animation. Existing navigation, routes, page hierarchy and Brownie visuals are retained.

## Schema

| Tables | Ownership / purpose |
| --- | --- |
| `profiles` | Auth user PK; profile trigger creates an empty row; display name completes setup; nickname/avatar/initials/encouragement |
| `duos`, `duo_members` | One shared IANA timezone; private invite; fixed slots 1/2; one duo per user |
| `duo_pets` | One pet per duo; **canonical Brownie name**, equipped accessory; no duplicate name in `duos` |
| `pet_unlocks`, `pet_room_items` | Normalized unlocks and selected room items; static catalog stays in application code |
| `goals` | Shared/personal definitions with actual owner/creator/duo IDs, tracking metadata and archival |
| `goal_assignments` | Per-user targets with effective date intervals; exclusion constraint prevents overlaps |
| `goal_checkins` | Unique goal/user/logical-date value with database-owned assignment and target/unit snapshots |
| `challenges` | References a shared goal in the same duo; definition only, no mutable progress |
| `challenge_results`, `challenge_result_members` | Immutable final outcome and per-user scores with calculation version |
| `pet_xp_events` | Idempotent source event ledger; reversals retain event identity |

Migrations contain all tables, checks, FKs, indexes, grants, RLS, triggers and RPCs. No dashboard table creation is required. Existing history has restrictive foreign keys; normal client grants cannot hard-delete it. Accounts cannot currently leave/switch duos; membership lifecycle and account deletion require a later explicit retention policy.

## RLS / write authorization

All 13 user/duo-owned tables enable RLS. Explicit grants restrict mutable columns in addition to row policies. Anonymous clients have no table access. Private helper schema is not exposed through PostgREST.

- Profiles: own row only. Partner details come from `get_duo_context()` with only ID, display name, initials, avatar and membership date; nickname and encouragement remain private.
- Duo-owned records: membership required for reads. Changing an ID never grants membership. Personal goal definitions remain visible to the duo, but only their owner can manage them; either member can manage a shared goal.
- Membership: no client inserts, updates or deletes. Duo creation and joining use authenticated security-definer RPCs with fixed empty search paths.
- Goals: creator must be caller; personal owner must be caller; all participant/creator IDs must belong to the goal's duo. Definition identity, scope, units and tracking are immutable to clients. Name, icon, notes and status are editable. Archive preserves history.
- Check-ins: only caller's rows can be inserted/updated. The database chooses snapshots. The client supplies only goal/user/date/value; cannot rewrite a friend's record or snapshot.
- Challenges: members can create in their duo and edit active name/reward. Clients cannot write final status/results or scores.
- Pet: members can update shared name/equipment and select unlocked room items. Clients cannot mint unlocks or XP.
- Trusted future finalization/XP workers may use service-role access in server infrastructure only. There are no such endpoints or credentials in this phase. Privileged access bypasses RLS but still encounters database constraints/triggers.

## Pairing and concurrency

`create_duo` locks the caller's identity transactionally, requires a completed profile and no existing membership, then inserts duo, slot 1, pet and starter customization in one transaction. `join_duo` locks the caller and target duo, validates code and capacity, and inserts slot 2. A user PK enforces one membership; unique `(duo_id,slot)` with slots restricted to 1/2 enforces maximum two even under racing requests. `(duo_id,user_id)` is also unique.

Invites use **16 cryptographically random bytes (128 bits)** encoded as 32 hexadecimal characters; presentation groups them with hyphens. Codes are not sequential IDs. Possession grants the ability to occupy the remaining slot after authentication and profile setup. Invalid/full/already-paired errors have safe UI messages. Codes are visible only to members; never searchable by clients. Rotation, expiration, leaving and re-pairing are deferred. Hosted Auth rate limits remain relevant; no unauthenticated invite-lookup endpoint exists.

## Goal targets, snapshots, and dates

Scope is `personal`/`shared`; status `active`/`paused`/`archived`. Tracking is `boolean` or `measured`; measured kind is `number` or `duration`. Custom numeric units are text; durations use **canonical seconds**, with display conversion belonging to a future adapter. Existing mock UI duration representation remains unchanged.

Boolean check-ins use **value 0 or 1**. `completed` is a stored generated column: value=1 for boolean, value>=target_snapshot for measured. Numeric checks reject negative/nonfinite values and nonpositive targets. Each dated check-in references its exact assignment version. Insert triggers copy authoritative target, unit and tracking metadata; updates cannot change those snapshots. Duplicate day rows are rejected; future persistence should upsert the value using the unique key.

Assignment intervals are `[active_from, active_until)`; an open interval has no end. Initial assignments start today or later. `replace_goal_assignment` atomically closes the open interval and inserts a successor effective **tomorrow or later**, preserving today's denominator. Clients cannot retroactively edit targets or assignment intervals. Historical check-ins continue using their captured target even after a future change. Later imports/backfills require a deliberately designed trusted migration path.

`duoDateKey(duo.timezone, instant)` uses `Intl.DateTimeFormat(...).formatToParts()` for the client's logical date. PostgreSQL uses `(now() AT TIME ZONE duo.timezone)::date`. Event timestamps are `timestamptz`; habit days and challenge boundaries are `date`. No business date is obtained by splitting a UTC ISO timestamp. Duo timezone is fixed after creation in this phase to avoid shifting existing day boundaries; no India-specific assumption. Existing demo providers intentionally keep audited device-local mock dates until their Phase 2 migration.

Paused/archived goals cannot receive check-in writes. Normal Delete migration is deferred; future goal repository delete must update status to archived. Tracking/unit changes need a new definition (or a designed versioning migration), not a retroactive unit rewrite.

## Challenges and immutable history

Modes: `together`, `head_to_head`; metrics: `completion_count`, `target_days`, `streak`. Dates are inclusive challenge boundaries. Progress is derived from linked goal check-ins and their snapshots. For measured goals, compare capped `value / target_snapshot` per user, not raw unlike targets/units. A target day means generated completion is true; streaks count consecutive logical dates and break on a missing/incomplete eligible day. Together counts aggregate eligible completions; Head-to-Head compares each member's score. There is no second progress counter.

A future trusted finalizer must calculate the versioned result from authoritative check-ins, insert both participant scores and result, and set completed in **one transaction**. Deferred constraints require the result, valid duo members, and an outcome compatible with mode. Result rows cannot subsequently be updated/deleted; finalized challenge definitions cannot be edited. Source check-ins may later be corrected without rewriting a completed challenge result. A future finalizer must implement the scoring/eligibility policy and tests; no endpoint pretends to do this yet. `winner_user_id` resides on the immutable result, avoiding two winner fields that could disagree.

## XP ledger policy

Examples of canonical event keys for the future trusted award engine:

- `goal:{goal_id}:user:{user_id}:date:{date}:complete`
- `duo_goal:{goal_id}:date:{date}:both_complete`
- `perfect_day:{duo_id}:{date}`

Unique `(duo_id,event_key)` prevents duplicate issuance. `source_id` is the goal UUID for completion events, duo UUID for perfect days. A trusted writer must verify source eligibility and construct the canonical key; clients have **no ledger writes**, and the generic source UUID is not itself a cross-table FK. No award engine is implemented. The later engine must update the check-in and associated awards/reversals atomically or use a transactional queue, with retries keyed by event_key.

Undo sets `reversed_at`; re-completion reactivates **the same event** by clearing it. Never create a second award or erase source history. Source, actor, amount and event identity are immutable. Award amount remains the originally assigned amount on reactivation. Total XP is `sum(xp_amount) where reversed_at is null`; level is deterministic from that total. Mood and duo energy derive from today's goals/check-ins, never stored. Existing UI XP remains the audited demo calculation, explicitly separate from this ledger.

## Hosted integration checklist

Run against a new/disposable configured Supabase project. PGlite tests execute actual PostgreSQL migrations and RLS with test-only Auth roles; they do **not** exercise Supabase Auth email, JWT refresh, HTTP/PostgREST or multi-connection concurrency.

- [ ] A signs up, confirms email, reloads and finishes profile. Incomplete profile cannot access app routes.
- [ ] B signs up in a separate browser, confirms and finishes profile. No duo redirects to onboarding.
- [ ] A creates duo with timezone suggestion and optional names; exactly one membership and one pet exist.
- [ ] B joins formatted code; both see their real profiles and paired success after refresh.
- [ ] C attempts full duo and is rejected. Invalid well-formed code is rejected. A/B cannot create another duo or join another one. Repeated submissions never duplicate membership.
- [ ] On a fresh one-member duo, race B and C joins from separate sessions; exactly one succeeds and membership stays at two. Also race create vs join for the same user.
- [ ] Use authenticated public-key clients (not SQL editor/service role) to read/update another profile ID; rows remain inaccessible. Partner projection excludes private preferences.
- [ ] Create another duo C/D; A cannot read/update its duo, pet, goals, assignments, check-ins, challenges, results, room state or XP by supplying its IDs.
- [ ] Direct client membership insert/delete, timezone/invite edits, target snapshot edits, friend check-in writes, XP/unlock writes and result finalization are denied.
- [ ] Create goal/assignments via authenticated API; each member writes own value. Tomorrow's target version leaves today's snapshot unchanged. Overlap, future check-in, nonfinite values and wrong personal assignment are rejected.
- [ ] Archiving leaves check-ins/results intact; ordinary hard delete denied.
- [ ] Reload, close/reopen browser and wait through access-token refresh; session persists. Logout prevents direct app access, including Back/reload. Another account cannot inherit prior mock state.
- [ ] Signup/login errors and email delivery failures are understandable; invalid confirmation links return a safe message. No raw DB errors reach UI.
- [ ] Exercise Today, Tasks, Manage Goals, Progress, Pet, Challenges, Profile after pairing on mobile and desktop, all themes and reduced motion. Goal/challenge/pet edits remain demo-only; profile/encouragement persist.

## Verification in this repository

Automated checks: original audit domain regressions; adapter/guard/invite-format/date/DST tests; all migrations executed in PGlite with explicit authenticated roles and adversarial SQL assertions. Production build and TypeScript are checked separately. Browser checks cover public auth UI and unauthenticated route guards without credentials. Live account pairing/email/session-refresh tests remain pending setup of the new hosted project.

## Next phase (not implemented)

Introduce per-user/domain goal adapters and repositories, replace mock goal check-ins using duo dates, query actual history, then migrate challenges and transactional XP. Keep domain models independent of generated database shapes. Realtime, notifications, social login, password recovery, PWA and deployment remain outside this phase.

## Files introduced or changed in Phase 1

- `.env.example`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`: environment, Node 22+ requirement, runtime dependencies and test commands.
- `supabase/config.toml`, `supabase/migrations/202609150001_identity_and_pairing.sql`, `202609150002_goals_and_checkins.sql`, `202609150003_challenges_and_xp.sql`: complete database foundation.
- `lib/supabase/{config,client,server,database.types}.ts`, `proxy.ts`: typed SSR integration and session refresh.
- `lib/auth/{domain,session,actions}.ts`, `lib/repositories/{profile,duo,adapters}.ts`: verified account access, actions and domain boundary.
- `app/login/page.tsx`, `app/signup/page.tsx`, `app/onboarding/page.tsx`, `app/auth/confirm/route.ts`, `app/error.tsx`, `app/loading.tsx`, `components/auth/*`: auth/onboarding states.
- `app/layout.tsx`, `app/(app)/layout.tsx`: provider and route protection boundary. Existing `/`, `/tasks`, `/tasks/manage`, `/progress`, `/pet`, `/challenges`, `/profile` page files moved beneath `(app)` with URLs unchanged.
- `components/SessionProvider.tsx`, `components/profile/ProfileDashboard.tsx`, `components/PetCard.tsx`, `components/pet/PetDashboard.tsx`: real profile/duo context and pet name; feature tracking stays mocked.
- `lib/date.ts`: duo-timezone date helper.
- `backend.test.cjs`, `database.test.mjs`, `scripts/generate-db-types.mjs`, `README.md`, this report: tests, type regeneration and setup documentation.

Earlier uncommitted frontend/audit changes were retained. Git was neither initialized nor reset; the listed old route deletions in an unstaged Git status correspond to the route-group moves.

Final local results: `npm test` passed (including **46** database security/invariant assertions), `npm run typecheck` passed, production build passed. Tests used bundled Node 24 because the machine's default Node 20 is older than the installed Supabase SDK requirement. Login/signup visually checked at 430×932 and 1440×900 with Light/Dark themes; public auth console had no warnings/errors. HTTP responses from all seven protected app paths plus onboarding contained the expected login redirect. A browser automation timeout prevented completing the browser route sweep; authenticated screens, email delivery, refresh persistence and true concurrent joins await hosted setup. Reduced-motion support was inspected in code; no claim of full OS-level motion emulation.
