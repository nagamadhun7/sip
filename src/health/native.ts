import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { HealthAdapter } from "./sync";
const mapping = [
  ["water", "HKQuantityTypeIdentifierDietaryWater", "mL"],
  ["sugar", "HKQuantityTypeIdentifierDietarySugar", "g"],
  ["caffeine", "HKQuantityTypeIdentifierDietaryCaffeine", "mg"],
  ["calories", "HKQuantityTypeIdentifierDietaryEnergyConsumed", "kcal"],
  ["sodium", "HKQuantityTypeIdentifierDietarySodium", "mg"],
  ["potassium", "HKQuantityTypeIdentifierDietaryPotassium", "mg"],
] as const;
export async function nativeHealth(request = false): Promise<HealthAdapter> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw Error(
      "Health sync needs a native Sip build with Health permissions. It is unavailable in Expo Go.",
    );
  if (Platform.OS === "ios") {
    const hk = await import("@kingstinct/react-native-healthkit");
    if (!hk.isHealthDataAvailable())
      throw Error("Apple Health is not available on this device.");
    const types = mapping.map(([, type]) => type);
    if (request)
      await hk.requestAuthorization({
        toRead: ["HKQuantityTypeIdentifierDietaryWater"],
        toShare: types,
      });
    if (
      types.some(
        (type) =>
          hk.authorizationStatusFor(type) !==
          hk.AuthorizationStatus.sharingAuthorized,
      )
    )
      throw Error(
        "Allow Sip’s requested write permissions in Apple Health, then retry.",
      );
    return {
      platform: "ios",
      remove: async (entryId) => {
        for (const [, type] of mapping)
          await hk.deleteObjects(type, {
            metadata: {
              withMetadataKey: "SipEntryID",
              operatorType: hk.ComparisonPredicateOperator.equalTo,
              value: entryId,
            },
          });
      },
      write: async (e) => {
        const ids: string[] = [];
        for (const [key, type, unit] of mapping) {
          const value =
            key === "water"
              ? e.ml
              : e.drink.nutrition[key] === null ||
                  e.drink.missingNutrition?.includes(key)
                ? null
                : (e.drink.nutrition[key]! * e.ml) / 100;
          if (value === null) continue;
          const sample = await hk.saveQuantitySample(
            type,
            unit,
            value,
            new Date(e.at),
            new Date(e.at),
            { SipEntryID: e.id },
          );
          if (!sample)
            throw Error("Apple Health did not save a sample. Retry sync.");
          ids.push(sample.uuid);
        }
        return ids;
      },
      read: async () => {
        const rows = await hk.queryQuantitySamples(
          "HKQuantityTypeIdentifierDietaryWater",
          {
            unit: "mL",
            limit: 0,
            filter: {
              date: {
                startDate: new Date(Date.now() - 30 * 86400000),
                endDate: new Date(),
              },
            },
          },
        );
        return rows
          .filter((r) => !r.metadata.SipEntryID)
          .map((r) => ({
            id: r.uuid,
            ml: r.quantity,
            at: r.startDate.toISOString(),
            source: "Apple Health water",
          }));
      },
    };
  }
  if (Platform.OS === "android") {
    const hc = await import("react-native-health-connect");
    if (!(await hc.initialize()))
      throw Error("Install or update Health Connect, then retry.");
    const permissions = [
      { accessType: "read", recordType: "Hydration" },
      { accessType: "write", recordType: "Hydration" },
      { accessType: "write", recordType: "Nutrition" },
    ] as const;
    const granted = request
      ? await hc.requestPermission([...permissions])
      : await hc.getGrantedPermissions();
    if (
      permissions.some(
        (p) =>
          !granted.some(
            (g) =>
              "recordType" in g &&
              g.recordType === p.recordType &&
              g.accessType === p.accessType,
          ),
      )
    )
      throw Error(
        "Allow hydration and nutrition permissions in Health Connect, then retry.",
      );
    return {
      platform: "android",
      remove: async (key) => {
        await hc.deleteRecordsByUuids(
          "Hydration",
          [],
          ["sip:" + key + ":water"],
        );
        await hc.deleteRecordsByUuids(
          "Nutrition",
          [],
          ["sip:" + key + ":nutrition"],
        );
      },
      write: async (e) => {
        const startTime = e.at,
          endTime = new Date(Date.parse(e.at) + 1000).toISOString(),
          meta = (kind: string) => ({
            clientRecordId: "sip:" + e.id + ":" + kind,
            clientRecordVersion: Date.now(),
            recordingMethod: hc.RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
          });
        const n: import("react-native-health-connect").NutritionRecord = {
          recordType: "Nutrition",
          startTime,
          endTime,
          metadata: meta("nutrition"),
          name: e.drink.name,
          mealType: hc.MealType.UNKNOWN,
        };
        for (const key of [
          "sugar",
          "caffeine",
          "calories",
          "sodium",
          "potassium",
        ] as const) {
          const value = e.drink.nutrition[key];
          if (value === null || e.drink.missingNutrition?.includes(key))
            continue;
          const total = (value * e.ml) / 100;
          if (key === "calories")
            n.energy = { value: total, unit: "kilocalories" };
          else
            n[key] = {
              value: total,
              unit: key === "sugar" ? "grams" : "milligrams",
            };
        }
        return hc.insertRecords([
          {
            recordType: "Hydration",
            startTime,
            endTime,
            metadata: meta("water"),
            volume: { value: e.ml, unit: "milliliters" },
          },
          ...(Object.keys(n).some((k) =>
            ["energy", "sugar", "caffeine", "sodium", "potassium"].includes(k),
          )
            ? [n]
            : []),
        ]);
      },
      read: async () => {
        const all: import("./sync").RemoteWater[] = [];
        let pageToken: string | undefined;
        do {
          const result = await hc.readRecords("Hydration", {
            timeRangeFilter: {
              operator: "between",
              startTime: new Date(Date.now() - 30 * 86400000).toISOString(),
              endTime: new Date().toISOString(),
            },
            pageSize: 500,
            pageToken,
          });
          for (const r of result.records) {
            if (r.metadata?.clientRecordId?.startsWith("sip:")) continue;
            if (r.metadata?.id)
              all.push({
                id: r.metadata.id,
                ml: r.volume.inMilliliters,
                at: r.startTime,
                source: "Health Connect hydration",
              });
          }
          pageToken = result.pageToken;
        } while (pageToken);
        return all;
      },
    };
  }
  throw Error("Health sync is available on iPhone and Android phones.");
}
