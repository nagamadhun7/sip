# Sip

A functional, offline-first React Native / Expo drink tracker for iOS and Android. The UI follows the supplied Sip reference using responsive native components. It does not use screenshot rendering, a WebView, a screen gallery or seeded drink history.

## Implemented

- First-launch onboarding, focus selection and editable personal targets.
- SQLite-backed drink records and custom-drink library.
- Quick logging, amounts, native date/time editing, per-100-ml nutrition entry and deletion.
- Calculated daily totals, nutrient completeness flags, seven-day history and caffeine estimates.
- Barcode detection using the device camera; live Open Food Facts lookup, cached products, timeout/error handling and manual entry fallback.
- Local daily notification scheduling with permission handling.
- CSV file export using the native share sheet.
- Units, bedtime, privacy information and local-data deletion.

Drink maker adds an offline Lab, persisted ingredient recipes and one-tap logging from My drinks. Goal mode has a real serverless API and Pro purchase integration; they require the publisher's service configuration. No responses or store purchases are simulated in the app. See [Drink maker setup and verification](release/drink-maker.md). Health sync, widgets and Live Activities remain outside this release.

## Development

Use Node 22.13+.

```sh
npm ci
npm start
npm run ios      # native development build; requires Xcode and CocoaPods
npm run android  # native development build; requires Android SDK
npm test
npm run typecheck
npm run lint
```

Core app flows work in Expo Go SDK 58, but validate notification scheduling and camera behavior on real devices before store release. iOS simulators cannot provide a physical camera. Do not replace platform testing with a successful JavaScript export.

## Build and submission

EAS project: https://expo.dev/accounts/nagamadhun7/projects/sip

```sh
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform ios --profile simulator
```

`production` builds use store distribution; Android produces an AAB. An iOS simulator build is unsigned for device/App Store distribution and cannot be submitted to Apple. Store submission requires the publisher's Apple/Google accounts, app records, signing, policy URLs and listing details. See release/store-listing.md. No store submission is claimed by this repository.

## Data and estimates

There is no demo history. General drink nutrition is clearly labeled as approximate; product labels can override it. Unknown nutrients stay null and are flagged. Sugar is total sugar, since added sugar is not consistently available in barcode data. All fluid volumes contribute to the fluid target. Caffeine uses a five-hour half-life and is not a physiological measurement.

The built-in estimates are not a verified product database. Barcode data is attributed to Open Food Facts under its database license; verify the label before logging. No drink history is uploaded for lookup.
