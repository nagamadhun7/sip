# Release configuration handoff

App display name Sip; store listing draft Sip: Drink & Water Tracker. Version 1.1.0; EAS production auto-increments build numbers. Bundle/package com.sip.tracker is preserved. Existing opaque iOS app icon and Android adaptive/monochrome assets remain; splash explicitly uses the app icon on white. Simulator, preview APK, production AAB/store, and development profiles are present in eas.json.

Sentry is installed with its native config plugin and Metro integration. Set EXPO_PUBLIC_SENTRY_DSN to a real project. Set SENTRY_ORG / SENTRY_PROJECT and the private SENTRY_AUTH_TOKEN in EAS for source-map uploads, then change SENTRY_DISABLE_AUTO_UPLOAD to false. It remains true while the account is unconfigured so an otherwise valid build does not fail on missing upload credentials. Confirm plugin organization/project options or sentry.properties per the Sentry project before signed release. No real crash upload has been verified.

Camera, microphone, speech recognition and Health permission texts describe the actual feature. Camera photos are sent only for an explicitly requested estimate; label photos stay local. Health permission rationale routes to the existing privacy page. No background Health access or remote push is promised.

Production blockers: service URLs/keys, Sentry project, publisher/support/privacy/deletion details, RevenueCat products, signing and store accounts. Generate current signed native builds after configuration; JavaScript exports do not validate native Health/speech/Sentry modules. Store materials are drafts and have not been submitted.
