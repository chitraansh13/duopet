# DuoPet frontend audit

Date: 2026-09-15

**Backend readiness: Good — a sound frontend integration foundation, with the production data policies below still required.**

## 1. Architecture assessment

The App Router structure is small and practical. Server route wrappers render interactive client dashboards; `/tasks/manage` reads search parameters on the server. The existing `/[section]` route accepts only Profile and returns not-found for other sections. Keeping that route is reasonable; a dedicated `/profile` folder would be cosmetic here.

GoalProvider and ChallengeProvider belong above route transitions because Today, Tasks, Challenges, Pet, and Profile consume shared information. Their state is independent; neither imports the other provider. The new SessionProvider holds cross-route profile/preferences/customization state, with no dependency on either provider. Composition happens in consumers and pure selectors. Progress continues receiving isolated historical fixtures. No Redux, fetching abstraction, backend, authentication, database client, or API was added.

Layouts, palette, floating navigation, and Brownie's drawing were preserved. Global focus outlines are the only intentional general styling addition.

## 2. Important findings and fixes

| Finding | Targeted correction |
| --- | --- |
| Current values were embedded in undated goal definitions | Added serializable GoalRecord and GoalCheckIn shapes. The provider owns definitions and dated per-user check-ins; existing components receive a projected GoalDefinition view. Repeated updates replace the same goal/user/day entry. Local midnight/visibility refresh changes the viewed day without overwriting yesterday's entries. |
| Identity was encoded as `you` and `friend` | Introduced one mock identity module with user and duo IDs. Goal ownership, targets, updates, and challenge creator IDs use identifiers. User-facing labels remain unchanged. |
| Brownie mood/energy/XP differed between Today and Pet | Shared deriveToday selector now supplies Today, Pet, and Profile; Pet's activity list derives from completed goals instead of contradictory static events. |
| Profile/preferences/accessory/room changes reset on navigation | Moved those values into the root session provider. Encouragement now affects Today and Pet status messages. |
| Pet levels/unlocks could disagree | Level display is deterministic under an explicitly documented demo XP rule; level-based item availability follows structured requirements. Removed unused duplicated level/activity fixtures. |
| Challenge progress included today outside its date range or after completion | Guarded date windows, paused/missing goals, completed challenges, and snapshots that already include the date. Added historical cutoff dates and streak gap reset. |
| Challenge creation used UTC date conversion and counted an extra day | Uses local calendar keys and inclusive duration boundaries; checks valid dates and a currently eligible linked goal. |
| Summary totals and featured previews drifted | Challenge totals derive from the current list; missing featured goals no longer suppress another available preview. Profile's challenge count uses the shared list. |
| Goal edits could retain values in incompatible units | Reset today's value when tracking kind/unit changes; retain the original personal owner. Reject blank names, duplicate participants, non-finite/invalid values, and invalid measured targets at the state boundary. |
| Selection stored stale copies of data | Task selection stores an ID; heatmap selection stores a date and resolves the current supplied record. |
| Task history changed with current target edits; pending boolean goals appeared completed | Extracted fixed dated history snapshots from the component and uses actual completion for Today. New goals have no invented prior records. |
| Progress period ignored selected perfect-day count | Uses the selected period's count. Fixed Diet's mismatched goal ID, empty insight crashes, and the incorrect “today” flag on a historical date. |
| Modal semantics lacked keyboard behavior | Shared Escape, Tab/Shift+Tab trapping, scroll locking, and focus restoration for challenge/profile/delete dialogs. Task details receive focus and support Escape while retaining their desktop side-panel behavior. |
| Animation coverage was inconsistent | Root MotionConfig honors reduced motion; existing CSS media query remains. Cleaned repeated interaction timers; SVG definition IDs are unique across Brownie instances. |
| Theme storage could throw | Storage failures no longer prevent theme selection. System preference still uses CSS media queries. |

## 3. Intentionally retained

- Existing component/layout structure and interaction-heavy client boundaries. A large form alone was not a reason to fragment it.
- Independent providers and small context values. No broad memoization or store library was justified by this data volume.
- Frontend-only, in-memory state. Reloading resets mock session data; theme remains browser-local.
- Historical Progress percentages, habit rates, streaks, and six-week fixtures. These are presentation snapshots, not authoritative records derived from today's session.
- Decorative Brownie illustrations in Progress/Challenges and their static editorial copy.
- The current goal component view shape, including optional measured fields, icon, increment, and reward metadata. Runtime guards and the definition/check-in split solve the immediate data-ownership problem without a full model rewrite.
- Package versions. All declared runtime dependencies have a purpose; no duplicate-purpose state/date/UI dependency was found. No dependencies were added or removed. `npm ls --depth=0` reports existing extraneous `@emnapi/runtime` and `@img/sharp-wasm32` installations; these were left alone rather than pruning an existing environment. Review them during a clean lockfile-based install.

## 4. Backend integration recommendations — documentation only

Use separate records for:

- **Profiles:** user ID, display name, initials/avatar, nickname, created timestamp. Account-backed.
- **Duos and members:** duo ID plus membership rows keyed by user ID. Store the pairing date as a date/timestamp, not “Sep 2026.”
- **Goal definitions and assignments:** goal ID, duo/owner ID, scope, tracking kind, measurement unit, status, creator, plus one assignment/target per participant. Constrain measured targets to positive finite values. Keep duration storage in one agreed canonical unit.
- **Daily check-ins:** unique `(goal_id, user_id, local_date)` with numeric value and update timestamp. Preserve the target/unit applicable that day or version assignments so goal edits do not rewrite historical percentages.
- **Challenges:** IDs referencing existing goals, participants, mode, metric, target, start/end local dates, reward, status/result. Compute progress from the same daily check-ins; do not persist a second editable copy of goal progress.
- **Activity:** event IDs, actor user ID (or explicit duo event), goal/challenge ID, event kind, and real timestamp. Format labels such as “Yesterday” only in views.
- **Pet:** one duo pet record, customization IDs, and an idempotent XP event ledger. Level/mood/energy should be selectors. Define whether a shared completion rewards each participant or the pair, and what undo/deletion does to earned XP.
- **Preferences:** profile, encouragement, shared pet name, accessory, and room choices should be account/duo-backed. Theme and device reduced-motion preference can remain local-only.

Realtime integration should apply updates by entity ID/check-in key to the existing state boundary and selectors. Avoid replacing whole stale goal objects when receiving a progress update. Authentication/authorization, row access policies, transactions, retries, and conflict handling belong to the later backend task.

## 5. Remaining risks / decisions

1. **History is still mock data.** Progress aggregates are not internally reconstructed from a complete daily check-in dataset. Hardcoded denominators, illustrative streak success flags, and some view-shaped `you`/`friend` summary fields remain in fixture projections. They should be mapped from ID-keyed historical queries during integration.
2. **Challenge history is a snapshot, not an event history.** Cutoff guards fix immediate counting errors, but multiple elapsed days cannot be reconstructed from aggregate baselines. Define streak success, deadline/tie/finalization rules, and whether a challenge started today includes earlier check-ins that day.
3. **Deletion policy remains unresolved.** Deleting a linked goal currently leaves its challenge record in local state and excludes it from active displays. Before persistence, choose archival/tombstones or explicit cancellation; preserve completed history and do not silently cascade away records.
4. **XP is explicitly a reversible demo projection.** It compares current completions against seeded completions, with 500 XP per level starting from the level-4 fixture. It is not a durable lifetime reward ledger; deletion, changed targets, and day rollover need the agreed event policy. Perfect-day unlocks still use a mock count.
5. **Calendar policy:** local browser keys are now explicit and DST-safe day arithmetic is isolated. Agree on a duo/account IANA timezone before integration. Cross-timezone SSR and open-at-midnight challenge labels still need production testing; the UI is not a server-authoritative clock.
6. **Model constraints:** the current UI goal view permits optional measured metadata. A backend adapter must validate all incoming records and enforce scope/membership rules. No frontend check substitutes for account authorization.
7. **Preferences/name scope:** Brownie's name remains a shared fixture field; there was no existing name editor to preserve. The encouragement preference affects Today/Pet messages, not every decorative illustration's copy.
8. **Accessibility/animation coverage:** keyboard smoke tests and source review passed. Full screen-reader testing, physical iOS Safari testing, and OS-level Reduce Motion toggling were not performed. MotionConfig disables transform/layout animation; opacity and some size transitions may remain.

## 6. Validation

- `npm run typecheck`: passed.
- `git diff --check`: passed (only existing line-ending notices).
- `npm run build`: passed; all seven requested routes built successfully.
- `node audit.test.cjs`: passed. Covers progress normalization, invalid targets/values, paused goals, challenge dates/completed snapshots, duplicate-day guards, streak gaps, inclusive calendar arithmetic, shared XP projection, serializable state, check-in isolation/idempotence, day rollover, historical target snapshots, and level unlocks.
- No test suite existed at the start; the new check uses Node assertions and the installed TypeScript compiler, without a new dependency.
- Production browser smoke tests on port 3001: Today, Tasks, Manage Goals, Progress, Pet, Challenges, Profile.
- Exercised boolean completion, measured input, cross-route XP/energy, custom units with separate targets, pause/resume, deletion, Together and Head-to-Head creation/details, Brownie reactions, accessory/room persistence, profile edit persistence, encouragement, all theme choices, period selection, and heatmap selection.
- Verified Tab and Shift+Tab trapping, Escape dismissal, profile focus return, and keyboard task details.
- Responsive checks at 430×932 and 1440×900: no page-level horizontal overflow; screenshots inspected for phone Today, desktop Today, and light desktop Profile.
- Browser captured no warning/error logs in the tested flows. Runtime checks are Chromium-based, not physical iPhone/MacBook certification.

## 7. Files changed by this audit

New: `audit.test.cjs`, `components/SessionProvider.tsx`, `components/useDialog.ts`, `lib/identity.ts`, `lib/date.ts`, `lib/goal-state.ts`, `lib/goal-history.ts`, `lib/today.ts`, `AUDIT.md`.

Updated:

- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `components/BrowniePet.tsx`, `components/PetCard.tsx`, `components/ThemeControl.tsx`
- `components/goals/GoalProvider.tsx`, `TodayGoalRow.tsx`, `ActiveChallengePreview.tsx`
- `components/tasks/GoalForm.tsx`, `ManageGoals.tsx`, `TasksDashboard.tsx`, `TaskRow.tsx`, `TaskDetail.tsx`, `DeleteGoalDialog.tsx`
- `components/challenges/ChallengeSheet.tsx`, `ChallengeDetail.tsx`, `ChallengesDashboard.tsx`
- `components/pet/PetDashboard.tsx`, `PetCustomization.tsx`, `PetOverview.tsx`
- `components/profile/ProfileDashboard.tsx`
- `components/progress/DuoHeatmap.tsx`, `ProgressDashboard.tsx`, `ProgressInsights.tsx`
- `lib/goal-data.ts`, `challenge-data.ts`, `mock-data.ts`, `pet-data.ts`, `profile-data.ts`, `progress-data.ts`

The repository already contained modified/untracked work, including Profile and Challenge files. This audit built on that work without reverting it. Git already existed; no repository was initialized and no commit was created. The ownership warning was handled with a command-scoped safe-directory setting, without changing global Git configuration.
