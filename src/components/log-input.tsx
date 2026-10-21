import {catalogDrinks} from "../lib/tracking";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Input, Button, T, Row, ErrorText } from "./ui";
import {
  parseLocal,
  validateParsed,
  entriesFromParsed,
} from "../logging/parse";
import type { ParsedLog } from "../logging/parse";
import { checkRequest } from "../drink-maker/core";
import { callService, MakerError } from "../drink-maker/client";
import { startVoice } from "../logging/voice";
import { id, formatVolume } from "../lib/model";
export function LogInput() {
  const store = useStore(),
    [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [review, setReview] = useState<ParsedLog[]>([]),
    [busy, setBusy] = useState(false),
    [listening, setListening] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [paywall, setPaywall] = useState(false);
  const cleanup = useRef<null | (() => void)>(null),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  const catalog = catalogDrinks(store.library,store.catalog);
  useEffect(
    () => () => {
      cleanup.current?.();
      controller.current?.abort();
    },
    [],
  );
  async function voice() {
    setOpen(true);
    setError("");
    if (listening) {
      cleanup.current?.();
      setListening(false);
      return;
    }
    cleanup.current?.();
    try {
      cleanup.current = await startVoice(
        (transcript) => {
          setText(transcript);
          setReview([]);
        },
        () => setListening(false),
        (message) => {
          setError(message);
          setListening(false);
        },
      );
      setListening(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function match() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReview([]);
    setPaywall(false);
    setNotice("");
    const now = new Date();
    try {
      let result = parseLocal(text, catalog, store.containers, now);
      if (!result) {
        const safe = checkRequest(text);
        if (!safe.ok) throw Error(safe.message);
        controller.current = new AbortController();
        const response = await callService(
          "/parse-drinks",
          {
            text,
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
      setReview(result);
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
      const rows = entriesFromParsed(review, catalog, id);
      await store.saveEntries(rows);
      setNotice(`${rows.length} drink${rows.length === 1 ? "" : "s"} logged.`);
      setReview([]);
      setText("");
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
        <Button secondary title="Type it" onPress={() => setOpen((v) => !v)} />
        <Button
          secondary
          title={listening ? "Stop listening" : "Voice log"}
          onPress={() => void voice()}
          disabled={busy}
        />
      </View>
      {open ? (
        <>
          <Input
            label="Describe what you drank"
            value={text}
            onChangeText={(value) => {
              setText(value);
              setReview([]);
              setError("");
            }}
            placeholder="250 ml water and a coffee at 2 pm"
          />
          <T size={12} muted>
            Common drinks are matched on this phone. Other descriptions are sent
            to the recipe service only when you tap Match drinks. Voice uses
            your device’s speech service.
          </T>
          <Button
            title="Match drinks"
            disabled={busy || !text.trim() || listening}
            onPress={() => void match()}
          />
          {review.map((p, index) => (
            <Row
              key={index}
              title={catalog.find((d) => d.id === p.drink_id)?.name ?? ""}
              detail={new Date(p.at).toLocaleString()}
              value={formatVolume(p.amount_ml, store.settings.units)}
            />
          ))}
          {review.length ? (
            <Button
              title="Log matched drinks"
              busy={busy}
              onPress={() => void log()}
            />
          ) : null}
        </>
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
