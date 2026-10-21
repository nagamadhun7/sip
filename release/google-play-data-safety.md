# Google Play Data safety answer draft — October 21, 2026

Complete against the final production build and processor contracts. These are draft answers, not a claim of Play approval.

- Does the app collect or share required user data types? **Yes** for enabled authenticated server, AI, purchase and diagnostics features.
- Is data encrypted in transit? **Yes**: production client requires HTTPS; providers use HTTPS. Local SQLite itself is not encrypted by Sip; device OS protection/backups apply.
- Can users request deletion? **Not ready to answer Yes for remote data** until the publisher provides and verifies a remote deletion contact/workflow. In-app local deletion exists. Add the public deletion URL/contact before submission.
- Ads / sale / cross-app advertising tracking: **No**.

| Type | Collected? | Optional? | Purpose | Shared? |
|---|---|---|---|---|
| Health info: submitted nutrient limits and profile context | Yes for Goal | Yes | App functionality | Processor-only exemption may apply for contracted AI/hosting providers; publisher must confirm |
| Other user-generated content: submitted drink text | Yes for remote matching/Goal | Yes | App functionality | Same processor review |
| Photos | Yes for requested recognition, transmitted without server photo caching | Yes | App functionality | Same processor review |
| User IDs | Yes, anonymous service identifier | Required for server features; local tracking works without it | Account/session functionality, security and limits | Processor review for Supabase/RevenueCat |
| Purchase history | Yes for Pro and restore | Yes | App functionality | Platform store and RevenueCat processor review |
| Crash logs / diagnostics | Yes if Sentry enabled | Build configuration dependent | App functionality and diagnostics | Sentry processor review |

Raw Health Connect records remain local. Declare and justify only READ_HYDRATION, WRITE_HYDRATION and WRITE_NUTRITION access in Play's Health permissions declaration. The app imports hydration and exports the user's logged water/known nutrients; no advertising use. Supply the accessible public privacy policy, including the Health permission rationale route.

Voice audio is handled by the device speech provider; verify that provider's network processing and the Play disclosure requirements. Do not claim all processing is on-device.

Final publisher must verify processor exemptions, native SDK collection, operational retention/deletion, and country-specific disclosures. Primary guidance: https://support.google.com/googleplay/android-developer/answer/10787469
