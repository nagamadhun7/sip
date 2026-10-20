import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Entry, exportCsv, localDay } from "./model";
export async function shareCsv(entries: Entry[]) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Sharing is unavailable on this device.");
  const file = new File(Paths.cache, `Sip-drinks-${localDay()}.csv`);
  file.create({ overwrite: true });
  file.write(exportCsv(entries));
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export Sip drinks",
    UTI: "public.comma-separated-values-text",
  });
}
