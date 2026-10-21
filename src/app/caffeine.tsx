import React, { useState, useEffect } from "react";
import Svg, { Path, Line, Text as SvgText } from "react-native-svg";
import { useStore } from "../state/store";
import { caffeineNow, onDay, localDay, totals } from "../lib/model";
import { caffeineClearBy } from "../lib/tracking";
import { Page, T, Row, colors } from "../components/ui";
export default function Caffeine() {
  const { entries, settings } = useStore(),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const today = onDay(entries, localDay()),
    sum = totals(today),
    active = caffeineNow(entries, now),
    hours = active > 25 ? 5 * Math.log2(active / 25) : 0,
    clear = caffeineClearBy(entries, now),
    max = Math.max(25, active);
  const bedtime = new Date(now);
  const [bedHour, bedMinute] = settings.bedtime.split(":").map(Number);
  bedtime.setHours(bedHour, bedMinute, 0, 0);
  if (bedtime.getTime() <= now) bedtime.setDate(bedtime.getDate() + 1);
  const atBedtime = caffeineNow(entries, bedtime.getTime());
  const points = Array.from(
    { length: 25 },
    (_, h) =>
      `${h === 0 ? "M" : "L"}${16 + h * 11.7},${160 - ((active * Math.pow(0.5, h / 5)) / max) * 135}`,
  ).join(" ");
  return (
    <Page>
      {!entries.length ? <T muted>No drinks logged yet.</T> : null}
      <T>
        {Math.round(sum.caffeine)} mg today. {Math.round(active)} mg estimated
        in your body now.
      </T>
      <Svg width="100%" height={210} viewBox="0 0 320 210">
        <Line x1={16} x2={297} y1={160} y2={160} stroke="#DDE2E6" />
        <Path d={points} fill="none" stroke={colors.brown} strokeWidth={3} />
        {[0, 6, 12, 18, 24].map((h) => (
          <SvgText
            key={h}
            x={16 + h * 11.7}
            y={190}
            fill={colors.muted}
            fontSize={12}
            textAnchor="middle"
          >
            {h === 0 ? "Now" : `+${h}h`}
          </SvgText>
        ))}
      </Svg>
      <T muted>Below 25 mg {hours ? "by" : "now"}</T>
      {hours ? (
        <T size={32} bold>
          {clear.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </T>
      ) : null}
      <Row
        title="At your bedtime"
        detail={bedtime.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
        value={`${Math.round(atBedtime)} mg estimated`}
      />
      {sum.missing.caffeine > 0 ? (
        <T size={13} muted>
          {sum.missing.caffeine} drink(s) have no caffeine data. This estimate
          is incomplete.
        </T>
      ) : null}
      {today
        .filter((e) => (e.drink.nutrition.caffeine ?? 0) > 0)
        .map((e) => (
          <Row
            key={e.id}
            title={e.drink.name}
            detail={new Date(e.at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
            value={`${Math.round(((e.drink.nutrition.caffeine ?? 0) * e.ml) / 100)} mg`}
            dot={e.drink.color}
          />
        ))}
      <T size={13} muted>
        Estimate using a 5-hour half-life. Metabolism varies widely. This is not
        a measurement, a sleep guarantee, or advice about safe caffeine intake.
        Missing caffeine values are excluded.
      </T>
    </Page>
  );
}

export { ErrorBoundary } from "../components/route-error";
