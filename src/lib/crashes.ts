import * as Sentry from "@sentry/react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { sanitizeCrash } from "../features/crash-privacy";
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn)
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    enableAutoSessionTracking: false,
    enableNative:
      Constants.executionEnvironment !== ExecutionEnvironment.StoreClient,
    enableLogs: false,
    beforeSend: (event) => sanitizeCrash(event),
  });
export function reportCrash(error: Error) {
  if (dsn) Sentry.captureException(error);
}
