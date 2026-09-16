# DuoPet

Next.js App Router app with Supabase authentication, pairing, and persisted daily goals. Read [AUDIT.md](AUDIT.md), [Backend Phase 1](docs/BACKEND_PHASE_1.md), and [Backend Phase 2](docs/BACKEND_PHASE_2.md) for architecture, permissions, and deferred work.

Real: email/password authentication, profiles, duo creation/pairing, goal definitions and assignments, Today check-ins, target snapshots, pause/archive behavior, and realtime duo updates. Challenges, historical Progress charts, task mini-history, Brownie XP, accessories, and room interactions remain explicitly **demo-backed**.

## Set up a new Supabase project

1. Use **Node.js 22 or newer** (`.nvmrc` specifies 22). Install packages:

   ```sh
   npm ci
   ```

2. Create a project in the Supabase Dashboard. Keep the database password private. Copy the **project URL** and **publishable key** from Connect/API settings. No service-role key is needed anywhere in this app.

3. Copy `.env.example` to `.env.local` and replace its placeholders:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   `.env.local` is ignored by Git. Public environment variables are bundled at build time: restart development/rebuild after changing them. Never put a secret or service-role key in a `NEXT_PUBLIC_` variable.

4. Apply **all repository migrations** to the new project. The CLI can run through `npx`; no global installation or Docker is required for a hosted project:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Enter credentials only into CLI prompts. Review the migration list before applying it. `supabase/config.toml` configures optional local development; **hosted Auth settings still need the next step**. Do not create tables manually.

5. In Authentication settings:

   - Enable Email + Password signup and **Confirm email**; set minimum password length to 12. Leave social providers disabled.
   - Set Site URL to `http://localhost:3000` and allow redirect URL `http://localhost:3000/auth/confirm`.
   - In the **Confirm signup** email template, use this link (the app supports this token-hash flow and PKCE):

     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your DuoPet account</a>
     ```

   - Configure SMTP when testing with recipients outside the project's permitted built-in email recipients. Supabase's built-in email service has recipient/rate limits; consult your project's Auth email settings.

6. Run locally:

   ```sh
   npm run dev
   ```

   Open `http://localhost:3000`. Without configuration, protected pages redirect to Login and auth buttons explain that setup is pending.

7. Create Account A at `/signup`, confirm its email, set up a profile, and **Create Duo**. The timezone suggests the browser's IANA timezone. Copy the private invite code. A sees a stable **Waiting for your duo** screen at `/` and `/onboarding`, with invite copy and pairing refresh. The app opens after the second member joins.

8. In a different browser/profile, create and confirm Account B, set up its profile, choose **Join Duo**, and paste A's code. B sees “Your duo is complete 🐾”. A clicks **Check pairing** on `/onboarding` to see the completed pair. Use Profile → duo management to return there. Goal and Today check-in changes sync through narrowly scoped Supabase Realtime channels.

9. Run checks:

   ```sh
   npm test
   npm run typecheck
   npm run build
   ```

   `npm test` runs audited domain checks, goal adapter/realtime merge tests, and the actual migrations/RLS in embedded PostgreSQL (PGlite), with test-only Auth roles. Follow the hosted checklists in the backend phase reports before using real account data.

## Database types

The checked-in `lib/supabase/database.types.ts` is generated from the linked schema. Regenerate it after migrations:

```sh
node scripts/generate-db-types.mjs
npm run typecheck
npm test
```

The script invokes `npx supabase gen types typescript --linked --schema public` and replaces the file only on successful output. Database rows stay inside repositories/adapters; visual components use domain types.

## Optional local Supabase

With Docker installed, use `npx supabase start`, then `npx supabase db reset` **only for the disposable local database**. Reset destroys local data. Use the local URL/public anon key from `npx supabase status` in `.env.local`. Use local mail capture for confirmation emails. Hosted setup does not require this workflow.

Official references: [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [repository migrations](https://supabase.com/docs/guides/local-development/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Confirmation links and onboarding states

Use the **Confirm signup** template shown above: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Keep Confirm email enabled. Site URL, `NEXT_PUBLIC_SITE_URL`, and the browser origin must agree (`http://localhost:3000` locally); add that origin's `/auth/confirm` URL to the redirect allowlist. If running on another port, update all three. Never combine `token_hash` and `code` in one callback URL. Newly sent emails use a changed template; old emails do not change.

The handler also accepts `token_hash` with `type=signup` and existing **PKCE** `?code=...` callbacks. A code callback normally comes from the default `{{ .ConfirmationURL }}` template via Supabase's verification endpoint. It is not evidence of an unsupported handler. PKCE requires the verifier cookie from the **same browser and origin that started signup**. A different browser/device/localhost port, overwritten verifier, expired code, or repeated exchange can fail. If the email was already verified before the code exchange failed, email/password sign-in is the recovery path. Do not disable confirmation.

Token-hash links and codes are single-use. Use the newest email. `otp_expired` means invalid/expired verification, including reused links; it does not uniquely prove age or a template mismatch. Login now explains recovery and offers **Need a new confirmation email?** → **Resend confirmation email** for an unconfirmed account. Supabase rate limits and SMTP restrictions still apply. No automatic resend occurs on page load. Confirmation redirects never forward arbitrary `next` destinations or raw error descriptions.

Authenticated states are explicit:

1. Missing/incomplete profile → profile setup.
2. Completed profile, no duo → Create Duo / Join Duo.
3. One-member duo → waiting screen, invite copy, Check pairing and Sign out. No dashboard initialization or perpetual pairing loader.
4. Two-member duo → normal app; onboarding shows paired success and Enter DuoPet.

The protected layout resolves the account state **outside** its page-loading boundary. Check pairing refreshes authoritative server data; it never invents a partner or polls indefinitely. Database/RLS and timezone rules are unchanged.

See [the fix validation report](docs/ONBOARDING_FIX.md) for actual hosted test results and remaining confirmation-test limits. Supabase references: [PKCE restrictions](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [token-hash confirmation setup](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
