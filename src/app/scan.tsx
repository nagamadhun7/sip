import React, { useEffect, useRef, useState } from "react";
import { View, Linking, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { File, Paths } from "expo-file-system";
import { callService } from "../drink-maker/client";
import type { Drink } from "../lib/model";
import { id } from "../lib/model";
import { lookupBarcode } from "../lib/barcode";
import { Page, T, Input, Button, ErrorText } from "../components/ui";
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions(),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notFound, setNotFound] = useState(false),
    [photoMode, setPhotoMode] = useState(false),
    [ready, setReady] = useState(false),
    [scanning, setScanning] = useState(true);
  const camera = useRef<CameraView | null>(null);
  const lock = useRef(false),
    controller = useRef<AbortController | null>(null),
    store = useStore();
  useEffect(() => () => controller.current?.abort(), []);
  async function lookup(value = code) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotFound(false);
    setScanning(false);
    setCode(value);
    controller.current = new AbortController();
    try {
      const cached = store.library.find((d) => d.barcode === value);
      const drink =
        cached ??
        (await lookupBarcode(
          value,
          controller.current.signal,
          async (barcode) =>
            (
              await callService<{ drink: Drink | null }>(
                "/food-lookup",
                { barcode },
                controller.current!.signal,
              )
            ).drink,
        ));
      if (controller.current.signal.aborted) return;
      if (!drink) {
        setNotFound(true);
        return;
      }
      await store.saveDrink(drink);
      router.replace({ pathname: "/drink", params: { drink: drink.id } });
    } catch (e) {
      setNotFound(true);
      if (!controller.current?.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Could not look up this barcode. Check your connection.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <T size={26} bold>
        Point at a barcode
      </T>
      <T size={13} muted>
        Scan a beverage label or enter its barcode. Only the barcode number is
        sent to Open Food Facts first, then USDA if the fallback is configured.
        Photos stay on this device.
      </T>
      {permission?.granted ? (
        <View
          style={{
            height: 260,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#1F2A33",
          }}
        >
          <CameraView
            ref={camera}
            onCameraReady={() => setReady(true)}
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={
              scanning && !busy && !photoMode
                ? (result) => void lookup(result.data)
                : undefined
            }
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 32,
              right: 32,
              top: 65,
              bottom: 65,
              borderWidth: 2,
              borderColor: "white",
              borderRadius: 12,
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 16, paddingVertical: 12 }}>
          <T muted>
            {permission?.canAskAgain === false
              ? "Camera access is disabled. Enable it in device Settings, or enter a barcode below."
              : "Allow camera access to scan a barcode. Manual entry works without it."}
          </T>
          <Button
            secondary
            title={
              permission?.canAskAgain === false
                ? "Open device settings"
                : "Allow camera"
            }
            onPress={() =>
              permission?.canAskAgain === false
                ? void Linking.openSettings()
                : void requestPermission()
            }
          />
        </View>
      )}
      {photoMode && permission?.granted ? (
        <Button
          title="Capture label"
          disabled={!ready || busy}
          onPress={async () => {
            setBusy(true);
            try {
              const photo = await camera.current?.takePictureAsync({
                quality: 0.75,
              });
              if (!photo?.uri) throw Error("Could not capture the label.");
              const destination = new File(Paths.document, `label-${id()}.jpg`);
              await new File(photo.uri).copy(destination);
              router.replace({
                pathname: "/drink",
                params: { custom: "1", barcode: code, photo: destination.uri },
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      <Input
        numeric
        label="Barcode number"
        value={code}
        onChangeText={setCode}
        placeholder="8–14 digits"
      />
      <Button
        title="Look up drink"
        onPress={() => void lookup()}
        busy={busy}
        disabled={!code.trim()}
      />
      {busy ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActivityIndicator />
          <T muted>Looking up product…</T>
        </View>
      ) : null}
      <ErrorText error={error} />
      {notFound ? (
        <View style={{ gap: 14 }}>
          <T size={22} bold>
            We do not know this one yet
          </T>
          <T muted>Add it once. Next time it is instant.</T>
          <Button
            secondary
            title="Photograph the label"
            onPress={async () => {
              setPhotoMode(true);
              setScanning(false);
              if (!permission?.granted) await requestPermission();
            }}
          />
          <Button
            title="Enter label nutrition"
            onPress={() =>
              router.replace({
                pathname: "/drink",
                params: { custom: "1", barcode: code },
              })
            }
          />
        </View>
      ) : null}
      {!scanning && !busy && !photoMode && permission?.granted ? (
        <Button
          secondary
          title="Scan again"
          onPress={() => {
            setScanning(true);
            setNotFound(false);
            setError("");
          }}
        />
      ) : null}
      <T size={12} muted>
        Scanned values need checking against the label. Missing nutrients are
        not counted. Products without reliable liquid measurements can be
        entered manually.
      </T>
    </Page>
  );
}
