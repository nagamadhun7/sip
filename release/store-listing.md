# Sip — listing draft (update after Drink maker services are configured)

App name: Sip: Drink & Water Tracker
Subtitle: Know what you drink
Category: Health & Fitness
Android package / iOS bundle identifier currently configured: com.sip.tracker

## Short description
Track water, caffeine and sugar. Simple drink logging, personal targets and history.

## Description
Know what you drink with Sip. Log water, coffee, tea, soda and your own drinks in a clean, simple tracker.

• Add everyday drinks in one tap.
• Scan a beverage barcode to look up its label nutrition in Open Food Facts.
• Save custom drinks with nutrition from your own labels.
• Build ingredient recipes in the free offline Drink maker Lab.
• Optionally generate recipes in Goal mode with a limited free allowance or Pro.
• Edit amounts and times; your daily totals update automatically.
• Set personal fluid, caffeine, total sugar and mineral targets.
• View daily balance and seven-day history.
• Estimate caffeine remaining using a five-hour half-life.
• Choose optional daily reminders.
• Export your history as a CSV file.

No account or subscription is required. Drink history stays on your device. Barcode lookup uses an internet connection; logging and history work offline. Unknown nutrients are flagged rather than counted as zero.

Nutrition estimates and caffeine calculations are informational, not medical advice. Product information may be incomplete. Verify values against your label and follow personal advice from your healthcare professional.

## Review notes
No login required. Complete the short onboarding flow, then tap Water to log a drink or + to browse drinks and create one. Settings includes targets, focus, units, reminders, CSV export and data deletion. Camera permission is requested only on the barcode screen. If a camera is unavailable, enter barcode 5449000000996 to test beverage lookup. Product lookup depends on the external Open Food Facts service. Core logging is offline and requires no service account.

Drink maker Lab is offline. Goal and Pro require configured services and store products before review; do not submit an unconfigured Goal/paywall flow. No microphone capture or Health integration is included. See drink-maker.md for setup and physical-device verification.

## Publisher details still required
- Confirm publisher name and ownership/availability of the configured bundle/package ID.
- Public support email and support URL.
- Hosted public privacy policy URL; the in-app policy text is in src/app/privacy.tsx.
- Apple Developer membership and App Store Connect app record/team.
- Google Play developer account/app record and submission credentials.
- Content/age ratings, privacy disclosures and required testing must be completed for the publisher's accounts.

## Privacy disclosure facts for publisher review
- Drink records, nutrition, goals and preferences are stored locally in SQLite.
- Camera frames are used for barcode detection on device and are not uploaded.
- The barcode string and normal connection metadata are sent to Open Food Facts for lookup.
- Goal creates a Supabase anonymous session, sends the entered request and selected profile context to the server/OpenAI, and stores recipes/hashed cache keys and usage counters server-side. Pro uses RevenueCat and the platform store. Review related health, user ID, purchase and diagnostics disclosures with the actual configured providers.
- No advertising or remote push token registration is used.
- Device backups may include local app data. CSV files are shared only through the user's chosen share-sheet destination.
- Review the current store questionnaires and Open Food Facts policy before submitting declarations; do not assume the third-party lookup is equivalent to entirely offline use.
