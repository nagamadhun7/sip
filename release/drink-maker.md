# Drink maker

Implemented in `src/app/drink-maker.tsx`, with shared deterministic rules in `src/drink-maker/core.ts`, an Estimated catalog in `src/data/ingredients.json`, and the Cloudflare Worker in `backend/`. Lab is fully offline. Recipes, amounts, volume, nutrients, completeness flags and icon choices persist in SQLite. Log uses a snapshot, so later recipe edits do not rewrite history.

## Service setup

This checkout has no production credentials. Goal reports a configuration error rather than returning a dummy recipe. The automated tests inject provider output into the real service logic; they do not call a paid model. Live AI and real store transactions have not been verified.

1. Create/configure Supabase Auth with anonymous sign-ins enabled. Enable its abuse controls/rate limits. The app uses its public publishable key; never ship a service-role key. Tokens are stored in SecureStore, refreshed under the same user ID, and verified by the worker through `/auth/v1/user`.
2. In `backend/wrangler.jsonc`, set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Keep the `MAKER_USERS` Durable Object binding/migration. Install with `npm ci --prefix backend`.
3. From `backend/`, run `npx wrangler secret put OPENAI_API_KEY`. The default small model is `gpt-4.1-mini` using Responses strict structured output. Configure an OpenAI project budget. The provider request sets `store:false`; this does not disable provider abuse monitoring retention.
4. Configure Apple/Google subscription products in RevenueCat and an entitlement named `pro`. RevenueCat must use the Supabase user ID as its app user ID (the client already does this). Set `REVENUECAT_SECRET_KEY` using `wrangler secret put`; never put it in app environment variables. A missing server billing key grants only free access. Set RevenueCat restore/transfer behavior for a fresh anonymous installation and test it.
5. Deploy with `npm run deploy --prefix backend` after authenticating Wrangler. Do not deploy credentials in source. Use `backend/.dev.vars.example` as the local-only secret template.
6. Copy `.env.example` to an ignored `.env.local` and fill the worker HTTPS URL, Supabase public values and platform-specific **public** RevenueCat SDK keys. Set the same public variables for EAS builds. Run a new native build for purchases (`npm run ios` / `npm run android` or EAS). Expo Go can exercise Lab but cannot make store purchases.
7. Host the public privacy policy/support information, reconcile store privacy declarations with the configured providers and verify sandbox purchases before submitting. Store credentials, products and public policy URLs are publisher setup, not bundled substitutes.

Official references: [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs), [Supabase anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous), [RevenueCat React Native](https://www.revenuecat.com/docs/getting-started/installation/reactnative), [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/).

## Server behavior

POST `/drink-maker` accepts `{request,size_ml,filters,context}` and a Supabase bearer token. The verified user ID selects a Durable Object; client-supplied IDs or Pro flags are never trusted. Requests for each user serialize through the full quota/check/cache/provider sequence. Free defaults: 3 monthly and 3 daily attempts; Pro: 10 daily attempts. UTC day/month boundaries apply. Cached repeats consume no AI usage, even after quota exhaustion. Failed generation refunds the free monthly use but retains the daily attempt. Cached recipes expire after 30 days and an alarm removes expired storage within a day. Usage counters remain for enforcement.

The model can return only name, catalog ingredient IDs, amounts, units and constrained notes. Invalid output retries once. Unknown IDs/units are removed; empty allowed recipes fail. Code recalculates all five nutrients, adjusts sugar/caffeine/volume under ingredient bounds and reports misses truthfully. Context changes invalidate recipe cache keys; bedtime estimates are recomputed from fresh context. No model nutrition is accepted.

Only ordinary ingredients are available. Protein powder is deliberately excluded because the request's no-supplements rule takes priority over the example ingredient list. Alcohol needs an explicit alcohol request, an adult profile, tracking enabled and no pregnancy/nursing flag. Unknown-age and under-18 Goal suggestions are caffeine-free. Pregnancy/nursing uses a 200 mg daily ceiling unless a medical plan uses the person's own configured limit; the per-drink food-serving ceiling is 200 mg. These are conservative product rules, not medical recommendations. Lab warns on remaining limits and enforces ingredient/per-drink bounds when saving. Missing values are “not listed”, contribute no assumed amount, and mark logged totals incomplete.

Anonymous sessions survive normal refresh/relaunch. This is a per-authenticated-user limit, not a guarantee against a determined person reinstalling/creating accounts. Cross-device sign-in/linking, device attestation, self-service remote account deletion and server record export are not implemented. Local Delete data erases local tracking data, not the anonymous server identity/counters or a store subscription; the privacy screen states this. Resolve remote account lifecycle requirements before a public service release.

## Verification commands

```sh
npm test
npm run typecheck
npm run lint
npm run check --prefix backend
npx expo export --platform ios --platform android --output-dir /tmp/sip-maker-export
npm run dev --prefix backend
# A configured worker also needs authenticated integration testing with its real services.
```

The test suite covers totals/unknown values, real-number hints, strict schema/JSON extraction, filtering, dietary/profile/goal adjustment, blocked/non-drink requests, saved snapshots, quota/cache/month rollover, failed-generation refund and invalid-response retry. Worker bundling and local `/health` plus unconfigured `/drink-maker` responses are checked separately.

## On a real iPhone and Android phone

- Open Add a drink → Drink maker, then reach it again from My drinks. Check back navigation, both mode tabs, keyboard dismissal, small screens, larger text and screen-reader labels.
- In Lab, change syrup, espresso and milk; verify totals/hints immediately change. Search/add/remove ingredients, select shape/color, save, force-quit/reopen and verify the exact recipe survives.
- Log once from My drinks; confirm one Today entry, volume and all nutrient values. Edit the saved recipe and verify the prior entry stays unchanged. Try rapid repeated taps and offline use.
- In a **configured** native build, generate the example 400 ml no-dairy recipe. Verify actual totals, filters, Edit in Lab, Save and Try again. Check missing-nutrient and unattainable-goal warnings, bedtime wording, airplane-mode recovery and cancellation.
- Try a meal, nonsense, supplements, medical claims, large doses and prompt-injection text. Nothing should log. Verify pregnant/nursing/under-18/unknown-age/medical-plan cases and adult alcohol on/off.
- Exhaust free monthly and daily limits, repeat a cached request, then change context. Verify cache is free and the neutral paywall appears only when applicable. Test concurrent requests for the same account against the deployed service.
- Use Apple sandbox/TestFlight and Google license testing to purchase, cancel, restore, expire and refund Pro. Verify the **server** entitlement and limits change, including relaunch and fresh-install restore. Test Android purchase handoff (MainActivity uses singleTop). Never test with production charges.

No Android emulator runtime verification was possible on this host because its available disk space is below the emulator's boot requirement. Android production JavaScript export passes; physical Android and native IAP testing remain required.
