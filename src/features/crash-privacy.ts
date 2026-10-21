export function sanitizeCrash<T extends object>(event: T): T {
  const safe = { ...event } as Record<string, unknown>;
  for (const key of [
    "user",
    "request",
    "extra",
    "breadcrumbs",
    "contexts",
    "message",
    "logentry",
    "transaction",
    "tags",
  ])
    delete safe[key];
  const exception = safe.exception as
    | {
        values?: {
          value?: string;
          stacktrace?: { frames?: { filename?: string }[] };
        }[];
      }
    | undefined;
  if (exception?.values)
    safe.exception = {
      values: exception.values.map((value) => ({
        ...value,
        value: "Sip app error",
        stacktrace: value.stacktrace
          ? {
              ...value.stacktrace,
              frames: value.stacktrace.frames?.map((f) => ({
                ...f,
                filename: f.filename
                  ?.split("?")[0]
                  .replace(/\/Users\/[^/]+/g, "/Users/redacted"),
              })),
            }
          : undefined,
      })),
    };
  return safe as T;
}
