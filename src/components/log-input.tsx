import { partitionInput } from "../features/non-drink";
import { normalizeDrinkText } from "../features/locale";
import { catalogDrinks } from "../lib/tracking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Input, Button, T, Row, ErrorText } from "./ui";
import { parseLocal, validateParsed } from "../logging/parse";
import type { ReviewRow } from "../logging/review";
import {
  reviewRows,
  reviewEntries,
  nutrientBreakdown,
} from "../logging/review";
import { loadJournalDraft, saveJournalDraft } from "../lib/database";
import { checkRequest } from "../drink-maker/core";
import { callService, MakerError } from "../drink-maker/client";
import { startVoice } from "../logging/voice";
import { id, formatVolume, totals, nutrients } from "../lib/model";
export function LogInput({
  autoStartVoice = false,
  onAutoStartHandled,
}: {
  autoStartVoice?: boolean;
  onAutoStartHandled?: () => void;
}) {
  const store = useStore(),
    [open, setOpen] = useState(true),
    [text, setText] = useState(""),
    [review, setReview] = useState<ReviewRow[]>([]),
    [busy, setBusy] = useState(false),
    [listening, setListening] = useState(false),
    [startingVoice, setStartingVoice] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [paywall, setPaywall] = useState(false),
    [draftReady, setDraftReady] = useState(false),
    [draftStatus, setDraftStatus] = useState("Loading draft…"),
    [skipped, setSkipped] = useState<string[]>([]),
    [soupOffer, setSoupOffer] = useState(false),
    [method, setMethod] = useState(""),
    [details, setDetails] = useState<number | null>(null);
  const cleanup = useRef<null | (() => void)>(null),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  const mounted = useRef(true),
    autoStarted = useRef(false),
    voiceAttempt = useRef(0);
  const catalog = catalogDrinks(store.library, store.catalog);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cleanup.current?.();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    void loadJournalDraft().then(
      (saved) => {
        if (active) {
          setText(saved);
          setDraftReady(true);
          setDraftStatus(saved ? "Draft saved on this device" : "");
        }
      },
      () => {
        if (active)
          setError("Could not load your draft. Reopen Add a drink to retry.");
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const draftRevision = useRef(0);
  const writeNote = useCallback((value: string) => {
    const revision = ++draftRevision.current;
    setText(value);
    setReview([]);
    setError("");
    setNotice("");
    setDraftStatus("Saving draft…");
    void saveJournalDraft(value).then(
      () => {
        if (revision === draftRevision.current)
          setDraftStatus(value ? "Draft saved on this device" : "");
      },
      () => {
        if (revision === draftRevision.current)
          setDraftStatus(
            "Draft could not be saved. Keep this screen open and retry.",
          );
      },
    );
  }, []);
  let preview: ReturnType<typeof reviewEntries> = [];
  let previewError = "";
  if (review.length) {
    try {
      preview = reviewEntries(
        review,
        catalog,
        store.settings.units,
        () => "preview",
      );
    } catch (e) {
      previewError = (e as Error).message;
    }
  }
  const sum = totals(preview);
  const voice = useCallback(async () => {
    setOpen(true);
    setError("");
    if (listening) {
      cleanup.current?.();
      setListening(false);
      return;
    }
    cleanup.current?.();
    const attempt = ++voiceAttempt.current;
    setStartingVoice(true);
    try {
      const stop = await startVoice(
        (transcript) => {
          if (mounted.current && attempt === voiceAttempt.current)
            writeNote(transcript);
        },
        () => setListening(false),
        (message) => {
          setError(message);
          setListening(false);
        },
        store.settings.locale ?? "en-US",
      );
      if (!mounted.current || attempt !== voiceAttempt.current) {
        stop();
        return;
      }
      cleanup.current = stop;
      setListening(true);
    } catch (e) {
      if (mounted.current && attempt === voiceAttempt.current)
        setError((e as Error).message);
    } finally {
      if (mounted.current && attempt === voiceAttempt.current)
        setStartingVoice(false);
    }
  }, [listening, store.settings.locale, writeNote]);
  useEffect(() => {
    if (!autoStartVoice || !draftReady || autoStarted.current) return;
    autoStarted.current = true;
    onAutoStartHandled?.();
    void voice();
  }, [autoStartVoice, draftReady, voice, onAutoStartHandled]);
  async function match(includeSoup = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReview([]);
    setPaywall(false);
    setNotice("");
    const now = new Date();
    try {
      const normalized = normalizeDrinkText(
        text,
        store.settings.locale ?? "en-US",
      );
      const parts = partitionInput(
        normalized,
        catalog.map((d) => d.name),
      );
      setSkipped(parts.skipped);
      setSoupOffer(parts.soup.length > 0 && !includeSoup);
      setNotice(
        parts.skipped.length ? `Skipped: ${parts.skipped.join("; ")}.` : "",
      );
      const accepted = [
        ...parts.drinks,
        ...(includeSoup ? parts.soup : []),
      ].join(" and ");
      if (!accepted) {
        if (parts.soup.length) {
          setNotice(
            "Soup or broth can be logged as a drink if you choose. Include an amount in ml.",
          );
          return;
        }
        throw Error("No drinks found. Nothing was logged.");
      }
      let result = parseLocal(
        accepted,
        catalog,
        store.containers,
        now,
        store.settings.locale ?? "en-US",
      );
      const local = result !== null;
      if (!result) {
        const safe = checkRequest(accepted);
        if (!safe.ok) throw Error(safe.message);
        controller.current = new AbortController();
        const response = await callService(
          "/parse-drinks",
          {
            text: accepted,
            now: now.toISOString(),
            timezone_offset: now.getTimezoneOffset(),
            catalog: catalog
              .slice(0, 200)
              .map((d) => ({ id: d.id, name: d.name, serving: d.serving })),
          },
          controller.current.signal,
        );
        result = validateParsed(response, catalog, now);
      }
      if (!result.length)
        throw Error(
          "Please describe a drink and amount, or enter it manually.",
        );
      setReview(reviewRows(result, store.settings.units));
      setDetails(null);
      setMethod(
        local
          ? "Matched on your device"
          : "Matched by AI; nutrition comes from your saved drink data",
      );
    } catch (e) {
      setError((e as Error).message);
      setPaywall(e instanceof MakerError && e.paywall);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function log() {
    if (lock.current || !review.length) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const rows = reviewEntries(review, catalog, store.settings.units, id);
      await store.saveJournalEntries(rows);
      setNotice(
        `${rows.length} drink${rows.length === 1 ? "" : "s"} logged.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`,
      );
      setReview([]);
      setText("");
      setDraftStatus("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          secondary
          title={open ? "Hide note" : "Write a note"}
          onPress={() => setOpen((v) => !v)}
        />
        <Button
          secondary
          title={
            startingVoice
              ? "Starting microphone…"
              : listening
                ? "Stop listening"
                : "Voice log"
          }
          onPress={() => void voice()}
          disabled={busy || !draftReady || startingVoice}
        />
      </View>
      {listening ? (
        <View accessibilityLiveRegion="polite">
          <T bold>
            Listening… Speak your drinks, then check them before saving.
          </T>
        </View>
      ) : null}
      {open ? (
        <>
          <Input
            label="Your drink note"
            multiline
            editable={draftReady && !busy && !listening}
            maxLength={1000}
            value={text}
            onChangeText={writeNote}
            placeholder={"250 ml water\nA coffee at 2 pm"}
          />
          {draftStatus ? (
            <T size={12} muted>
              {draftStatus}
            </T>
          ) : null}
          <T size={12} muted>
            Write one drink per line, or describe several together. Common
            drinks are matched on this phone. Other descriptions are sent to the
            recipe service only when you tap Match drinks. Voice uses your
            device’s speech service.
          </T>
          <Button
            title="Match drinks"
            disabled={busy || !draftReady || !text.trim() || listening}
            onPress={() => void match()}
          />
          {review.length ? (
            <T size={13} muted>
              {method}. Check portions before saving.
            </T>
          ) : null}
          {review.map((p, index) => {
            const drink = catalog.find((d) => d.id === p.drink_id)!;
            const ml = preview[index]?.ml;
            return (
              <View key={index} style={{ gap: 10 }}>
                <Row
                  title={drink.name}
                  detail={new Date(p.at).toLocaleString()}
                />
                <Input
                  label={`${drink.name} amount (${store.settings.units === "oz" ? "fl oz" : "ml"})`}
                  numeric
                  editable={!busy}
                  value={p.portion}
                  onChangeText={(portion) =>
                    setReview((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, portion } : r)),
                    )
                  }
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    secondary
                    title={
                      details === index ? "Hide calculation" : "How calculated"
                    }
                    onPress={() => setDetails(details === index ? null : index)}
                  />
                  <Button
                    secondary
                    title={`Remove ${drink.name}`}
                    disabled={busy}
                    onPress={() => {
                      setReview((rows) => rows.filter((_, i) => i !== index));
                      setDetails(null);
                    }}
                  />
                </View>
                {details === index ? (
                  <View style={{ gap: 6 }}>
                    <T size={12} muted>
                      Source: {drink.source}. Estimates scale with the portion;
                      AI does not supply nutrient values.
                    </T>
                    {nutrients.map((key) => {
                      const value =
                        ml === undefined
                          ? null
                          : nutrientBreakdown(drink, ml, key);
                      const unit =
                        key === "calories"
                          ? "kcal"
                          : key === "sugar"
                            ? "g"
                            : "mg";
                      return (
                        <T key={key} size={13}>
                          {key}:{" "}
                          {value
                            ? `${+value.per100.toFixed(2)} ${unit} per 100 ml × ${+ml!.toFixed(2)} ml ÷ 100 = ${+value.amount.toFixed(2)} ${unit}`
                            : "not listed"}
                        </T>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
          {preview.length ? (
            <View style={{ gap: 6 }}>
              <T bold>
                Ready to log · {formatVolume(sum.water, store.settings.units)}
              </T>
              {nutrients.map((key) => (
                <T key={key} size={13}>
                  {key}:{" "}
                  {sum.missing[key] === preview.length
                    ? "not listed"
                    : `${+sum[key].toFixed(2)} ${key === "calories" ? "kcal" : key === "sugar" ? "g" : "mg"}${sum.missing[key] ? " · some values not listed" : ""}`}
                </T>
              ))}
            </View>
          ) : null}
          <ErrorText error={previewError} />
          {review.length ? (
            <Button
              title="Log matched drinks"
              busy={busy}
              disabled={!!previewError || listening}
              onPress={() => void log()}
            />
          ) : null}
        </>
      ) : null}
      {soupOffer ? (
        <Button
          secondary
          title="Log soup or broth as a drink anyway"
          onPress={() => void match(true)}
        />
      ) : null}
      <ErrorText error={error} />
      {notice ? <T>{notice}</T> : null}
      {paywall ? (
        <Button
          secondary
          title="View Sip Pro"
          onPress={() => router.push("/pro")}
        />
      ) : null}
    </View>
  );
}
