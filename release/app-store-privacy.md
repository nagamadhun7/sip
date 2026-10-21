# App Store privacy answer draft — October 21, 2026

For the configured online/Pro build. Review against the final services and SDK manifests before submission. Do not select “Data Not Collected” for a build with AI, purchases or diagnostics enabled.

| Data type | Purpose | Linked to user | Tracking |
|---|---|---|---|
| Health & Fitness: Health (submitted remaining nutrient limits, pregnancy/nursing flags, dietary/medical-plan context) | App functionality, only when Goal is requested | Yes, anonymous service ID | No |
| User Content: Other User Content (submitted drink descriptions and recipe requests) | App functionality | Yes, anonymous service ID | No |
| User Content: Photos or Videos (requested drink recognition) | App functionality | Yes, authenticated request; photo is not cached | No |
| Identifiers: User ID (anonymous Supabase / RevenueCat identifier) | App functionality, fraud/limit enforcement | Yes | No |
| Purchases: Purchase History | App functionality, entitlement and restore | Yes | No |
| Diagnostics: Crash Data (when Sentry DSN configured) | App functionality / crash diagnosis | No intentional user linkage in sanitized app reports; verify native SDK identifiers | No |

Local-only drink history, weight/sex/profile, unsent drafts and raw Health-provider records are not uploaded. Voice may use the OS speech provider; confirm its disclosure requirements for each platform. Infrastructure sees IP/network metadata; verify provider configurations and the resulting declaration for coarse location or device identifiers rather than claiming none without checking production.

Data is not used for ads, cross-app tracking or sale. Do not request App Tracking Transparency solely for these functionality flows. Include third-party privacy manifests supplied by installed SDKs in the signed build.

Required before final answers: public privacy-policy URL, publisher/contact details, service processor/retention confirmation, Sentry project configuration, final native privacy-manifest review. This is a draft, not submitted App Store Connect answers.

Primary guidance: https://developer.apple.com/app-store/app-privacy-details/
