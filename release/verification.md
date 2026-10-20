# Verification record

The tracker build IDs and “final” builds below are historical, **before Drink maker**. They do not contain this feature. Current Drink maker verification is at the end of this file; setup and physical-device checks are in [drink-maker.md](drink-maker.md).

# Verification — free tracker

Validated on iPhone 17 Pro simulator, iOS 26.3, with Expo Go SDK 58 during implementation:

- Onboarding saves chosen targets and opens an empty dashboard.
- Quick add creates a real SQLite entry.
- Editing 250 ml to 300 ml persists and updates the dashboard.
- Full process restart preserves the saved entry.
- Invalid 0 ml input prevents saving and preserves the editor; correction to 350 ml saves.
- Weekly history shows the saved amount rather than sample chart values.
- Changing ml to US fl oz updates displayed amounts.
- CSV export creates a real file and opens the native iOS share sheet.
- Manual barcode 5449000000996 performs live Open Food Facts lookup; returned product is Coca-Cola Original, 330 ml, 10.6 g sugar per 100 ml, with unreported caffeine left unknown.
- Logging the scanned product updates daily sugar to about 35 g and displays missing-caffeine information.
- Delete confirmation is present and cancelling preserves the entry. Permanent deletion was not exercised in the UI.

Automated checks:

- TypeScript passes.
- ESLint passes.
- Expo Doctor: 20/20 checks passed before the final dependency cleanup.
- 10 unit tests pass for nutrition scaling, unknown values, invalid entries, date boundaries, caffeine decay, CSV escaping/formula neutralization and barcode unit conversion.
- Final Android JavaScript export succeeds.

Native distribution:

- EAS project: @nagamadhun7/sip.
- Earlier Android production candidate ID: 59469186-0af9-4ff3-87d6-151c9d305eee (version 1.0.0, versionCode 3).
- Verified iOS simulator build ID: e51da517-c5be-4fd3-84aa-7aac55cde93a.
- iOS production signing attempt failed because credentials are not configured. A simulator build cannot be uploaded to App Store Connect.
- Local native iOS build could not finish because CocoaPods is unavailable; EAS builds avoid that local dependency.
- Apple/Google store submission, review acceptance and public availability have not been performed or claimed.

Remaining device validation:

- Physical-camera scanning and permission denial/recovery on actual iOS and Android devices.
- Local notification delivery on actual iOS/Android devices and after reboot/timezone changes.
- Android runtime testing (local emulator blocked: about 7.4 GB required, about 3.5 GB free), screen readers and large text across device sizes.
- Permanent entry deletion and full data erasure in a disposable test install.

Dependency advisory review:

`npm audit --omit=dev` currently reports 28 transitive findings from three underlying packages: braces 3.0.3 (Metro file matching), node-forge 1.4.0 (Expo CLI/code-signing tooling), and uuid 7.0.3 (Xcode project tooling). The first two are still the latest registry releases at inspection; npm's suggested fix would downgrade Expo to SDK 44 and is not a compatible remedy. These paths are build tooling, not imports in the mobile app source. Review upstream fixes before release; this report does not claim a clean dependency security audit.

## Packaged-build verification — October 20, 2026

Both final EAS builds finished successfully. The iOS simulator archive was downloaded, installed as `com.sip.tracker` version 1.0.0 build 1, and launched independently of Expo Go and Metro. Onboarding, quick-add and full process restart were exercised; the 250 ml record persisted.

The Android version 1.0.0/versionCode 3 App Bundle passed bundletool validation. A universal test APK was generated from that bundle with a local debug key; it is for sideload testing, not Play submission. The AAB is the EAS-signed store artifact.

TypeScript, ESLint and all 10 automated tests passed again. Physical-device testing and store submission remain outstanding.

Native date editing and repeat-yesterday were also exercised on October 20: a test record was moved to October 19 using the native calendar, disappeared from Today, and was copied into October 20 through the real SQLite transaction.

Android configuration follow-up: the inherited overlay/shared-storage/install-referrer permissions are now blocked, and expo-system-ui was added to enforce the intended light appearance. Native Android prebuild now succeeds without the theme warning. A replacement Android production build (versionCode 5, ID 8238fd86-96da-4e3d-baa5-35678dad7c6f) is pending. The downloaded build-3 AAB/APK are earlier candidates and do not include this configuration cleanup.

Cloud simulator availability was checked: it is not enabled on the Expo account. No remote simulator session was created.


## Drink maker — October 20, 2026

- 32 tests pass, including shared nutrition/safety logic and dependency-injected backend cache/quota/retry tests.
- App TypeScript, backend TypeScript and ESLint pass.
- Final iOS and Android production JavaScript exports pass. This is not a claim of a new signed native build.
- Cloudflare Worker production bundle dry-run passes; the local worker responds to `/health` and reports an honest 503 when unconfigured.
- In Expo Go 58 on iPhone 17 Pro/iOS 26.3: Add sheet entry, Lab totals/stepper/hint, local ingredient search/add, save/reopen, one-tap logging, mode tabs, back arrow and non-drink rejection were exercised. A valid Goal request shows the missing-server configuration message and does not fabricate a suggestion.
- Live OpenAI requests, deployed Supabase/Cloudflare authentication, RevenueCat purchases/restores, physical devices and Android runtime testing are not verified. Publisher credentials/products are not configured. Do not submit an unconfigured Goal/paywall flow to the stores.
