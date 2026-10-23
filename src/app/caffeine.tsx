import React, { useState, useEffect } from "react";
import { View, AppState } from "react-native";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { useStore } from "../state/store";
import { onDay, localDay, totals } from "../lib/model";
import { caffeineCurve } from "../features/caffeine-curve";
import { Page, T, Row, colors } from "../components/ui";
export default function Caffeine() {
  const { entries, settings } = useStore(),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now()),
      timer = setInterval(refresh, 60000),
      subscription = AppState.addEventListener("change", (s) => {
        if (s === "active") refresh();
      });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const curve = caffeineCurve(entries, now, settings.bedtime),
    today = onDay(entries, localDay(new Date(now))),
    sum = totals(today),
    locale = settings.locale ?? "en-US";
  const clock = (at: number) =>
    new Date(at).toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  const x = (at: number) =>
      40 + ((at - curve.start) / (curve.end - curve.start)) * 292,
    y = (mg: number) => 190 - (mg / curve.max) * 140;
  const path = curve.points
    .map((p, i) => `${i ? "L" : "M"}${x(p.at)},${y(p.mg)}`)
    .join(" ");
  const bedColor = curve.mostlyGone && !curve.missing ? "#417761" : "#A35436";
  const ticks = Array.from(
    { length: 5 },
    (_, i) => curve.start + ((curve.end - curve.start) * i) / 4,
  );
  return (
    <Page>
      <View style={{ gap: 6 }}>
        <T size={36} bold>
          {Math.round(curve.active)} mg
        </T>
        <T muted>Estimated caffeine in your body now</T>
        <T size={13} muted>
          {Math.round(sum.caffeine)} mg recorded today
        </T>
      </View>
      {!entries.length ? (
        <T muted>
          No drinks logged yet. Your curve appears as you log caffeine.
        </T>
      ) : null}
      <Svg
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Estimated caffeine curve using a 5-hour half-life. Now ${Math.round(curve.active)} mg; bedtime ${clock(curve.bedtime)}, ${Math.round(curve.atBedtime)} mg. ${curve.missing ? "Some recent caffeine values are not listed." : ""}`}
        width="100%"
        height={265}
        viewBox="0 0 350 265"
      >
        {[0, curve.max / 2, curve.max].map((mg, i) => (
          <React.Fragment key={i}>
            <Line x1={40} x2={332} y1={y(mg)} y2={y(mg)} stroke="#EBEEF0" />
            <SvgText
              x={33}
              y={y(mg) + 4}
              textAnchor="end"
              fill={colors.muted}
              fontSize={10}
            >
              {Math.round(mg)}
            </SvgText>
          </React.Fragment>
        ))}
        <SvgText x={8} y={25} fill={colors.muted} fontSize={10}>
          mg
        </SvgText>
        <Line
          x1={40}
          x2={332}
          y1={y(curve.reference)}
          y2={y(curve.reference)}
          stroke="#A5B5AA"
          strokeDasharray="3 4"
        />
        <Path d={path} stroke={colors.brown} strokeWidth={2.5} fill="none" />
        {curve.doses.map((d) => (
          <Circle
            key={d.id}
            cx={x(d.at)}
            cy={y(curve.points.find((p) => p.at === d.at)!.mg)}
            r={3}
            fill={colors.brown}
          />
        ))}
        <Line
          x1={x(now)}
          x2={x(now)}
          y1={42}
          y2={195}
          stroke="#6FAEE8"
          strokeDasharray="3 3"
        />
        <SvgText
          x={x(now)}
          y={15}
          textAnchor="middle"
          fill="#315D85"
          fontSize={11}
        >
          Now
        </SvgText>
        <Line
          x1={x(curve.bedtime)}
          x2={x(curve.bedtime)}
          y1={42}
          y2={195}
          stroke={bedColor}
          strokeDasharray="5 4"
        />
        <Circle
          cx={x(curve.bedtime)}
          cy={y(curve.atBedtime)}
          r={5}
          fill={bedColor}
        />
        <SvgText
          x={Math.min(300, Math.max(75, x(curve.bedtime)))}
          y={32}
          textAnchor="middle"
          fill={bedColor}
          fontSize={11}
        >
          Bedtime
        </SvgText>
        {ticks.map((at, i) => (
          <SvgText
            key={i}
            x={x(at)}
            y={221}
            textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            fill={colors.muted}
            fontSize={10}
          >
            {clock(at)}
          </SvgText>
        ))}
      </Svg>
      <View
        style={{
          borderLeftWidth: 3,
          borderColor: bedColor,
          paddingLeft: 14,
          gap: 6,
        }}
      >
        <T bold>
          By bedtime ·{" "}
          {localDay(new Date(curve.bedtime)) !== localDay(new Date(now))
            ? "tomorrow "
            : ""}
          {clock(curve.bedtime)}
        </T>
        <T>{Math.round(curve.atBedtime)} mg estimated remaining.</T>
        <T size={14} style={{ color: bedColor }}>
          {curve.missing
            ? "Estimate incomplete: some recent drinks have no caffeine value."
            : curve.mostlyGone
              ? "Should be mostly gone by bedtime in this model."
              : "Some caffeine is expected to remain at bedtime."}
        </T>
      </View>
      <Row
        title={
          curve.active <= curve.reference
            ? "25 mg or less now"
            : "Estimated 25 mg or less by"
        }
        value={
          curve.active <= curve.reference
            ? `${Math.round(curve.active)} mg`
            : new Date(curve.clearAt).toLocaleString(locale, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
        }
      />
      <T size={12} muted>
        The dashed horizontal line marks 25 mg, the chart’s “mostly gone”
        reference—not a sleep or safety threshold. Assumes a typical 5-hour
        half-life and no further caffeine. Actual clearance and sleep effects
        vary; this is an estimate, not a measurement. Missing caffeine values
        are excluded.
      </T>
      {today
        .filter((e) => (e.drink.nutrition.caffeine ?? 0) > 0)
        .map((e) => (
          <Row
            key={e.id}
            title={e.drink.name}
            detail={clock(Date.parse(e.at))}
            value={`${Math.round(((e.drink.nutrition.caffeine ?? 0) * e.ml) / 100)} mg`}
            dot={e.drink.color}
          />
        ))}
    </Page>
  );
}
export { ErrorBoundary } from "../components/route-error";
