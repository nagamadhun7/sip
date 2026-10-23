import { AccessiblePressable as Pressable } from "./accessible-pressable";
import { translate } from "../features/locale";
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect, ClipPath, Defs } from "react-native-svg";
import { router } from "expo-router";
export const colors = {
  ink: "#252525",
  muted: "#596875",
  line: "#EFEFEF",
  blue: "#6FAEE8",
  brown: "#A0724A",
  peach: "#F2A58A",
};
export function T({
  children,
  size = 16,
  muted = false,
  bold = false,
  style,
}: any) {
  return (
    <Text
      style={[
        {
          fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
          fontWeight: bold ? "600" : "400",
          fontSize: size,
          flexShrink: 1,
          color: muted ? colors.muted : colors.ink,
        },
        style,
      ]}
    >
      {Array.isArray(children)
        ? children.map((c) => translate(c) as React.ReactNode)
        : (translate(children) as React.ReactNode)}
    </Text>
  );
}
export function Page({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const safe = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "white" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: 32, gap: 20 }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: Math.max(safe.bottom, 16),
            borderTopWidth: 1,
            borderColor: colors.line,
            backgroundColor: "white",
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={String(translate(title))}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 18,
        backgroundColor: secondary
          ? "#F3F5F6"
          : danger
            ? "#FCE9E5"
            : colors.blue,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <T
          bold
          style={{
            color: danger ? "#AE4837" : secondary ? colors.ink : "#103B62",
          }}
        >
          {title}
        </T>
      )}
    </Pressable>
  );
}
export function Row({
  title,
  detail,
  value,
  onPress,
  dot,
  leading,
  children,
}: {
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  dot?: string;
  leading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.line,
        minHeight: 54,
      }}
    >
      {leading}
      {dot ? (
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: dot,
          }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        <T>{title}</T>
        {detail ? (
          <T size={13} muted>
            {detail}
          </T>
        ) : null}
      </View>
      {value ? (
        <T size={16} bold>
          {value}
        </T>
      ) : null}
      {children}
      {onPress ? <T muted>›</T> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}
export function Input({
  label,
  value,
  onChangeText,
  numeric = false,
  placeholder,
  multiline = false,
  editable = true,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <T size={13} muted>
        {label}
      </T>
      <TextInput
        accessibilityLabel={String(translate(label))}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholder={placeholder ? String(translate(placeholder)) : undefined}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        editable={editable}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
          fontSize: 18,
          color: colors.ink,
          paddingVertical: 12,
          paddingHorizontal: 0,
          borderBottomWidth: 1,
          borderColor: "#DDE2E6",
          minHeight: multiline ? 112 : 48,
        }}
      />
    </View>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 12, backgroundColor: "#FCEEE9", borderRadius: 12 }}
    >
      <T size={14} style={{ color: "#9F3F2F" }}>
        {error}
      </T>
    </View>
  ) : null;
}
export function Bar({
  value,
  color = colors.blue,
}: {
  value: number;
  color?: string;
}) {
  return (
    <View
      accessibilityLabel={`${Math.round(value * 100)} percent`}
      style={{
        height: 7,
        backgroundColor: colors.line,
        borderRadius: 4,
        overflow: "hidden",
        marginTop: 10,
      }}
    >
      <View
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          backgroundColor: color,
          borderRadius: 4,
        }}
      />
    </View>
  );
}
export function Glass({
  fraction = 0.72,
  size = 90,
}: {
  fraction?: number;
  size?: number;
}) {
  const level = 106 - Math.min(1, Math.max(0, fraction)) * 100;
  return (
    <Svg
      width={size}
      height={(size * 112) / 84}
      viewBox="0 0 84 112"
      accessibilityLabel={`Glass ${Math.round(fraction * 100)} percent full`}
    >
      <Defs>
        <ClipPath id="glass">
          <Path d="M10 6H74L68 100Q67 106 61 106H23Q17 106 16 100Z" />
        </ClipPath>
      </Defs>
      <Rect
        x="0"
        y={level}
        width="84"
        height="112"
        fill={colors.blue}
        clipPath="url(#glass)"
      />
      <Rect
        x="0"
        y={level}
        width="84"
        height="5"
        fill="#A9CEF3"
        clipPath="url(#glass)"
      />
      <Path
        d="M10 6H74L68 100Q67 106 61 106H23Q17 106 16 100Z"
        fill="none"
        stroke="#9AA7B2"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Icon({
  name,
  color = colors.ink,
  size = 24,
}: {
  name: "plus" | "drop" | "chart" | "settings" | "camera" | "back" | "mic";
  color?: string;
  size?: number;
}) {
  const paths = {
    mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM6 10v2a6 6 0 0 0 12 0v-2M12 18v4M9 22h6",
    plus: "M12 5v14M5 12h14",
    drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
    chart: "M5 20V10M12 20V4M19 20v-7",
    settings: "M4 8h9M17 8h3M4 16h3M11 16h9M13 6v4M9 14v4",
    camera:
      "M4 8h3l2-3h6l2 3h3v11H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0",
    back: "M15 5l-7 7 7 7",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function TabBar({ active }: { active: "today" | "week" }) {
  const safe = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: "white",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: Math.max(safe.bottom, 16),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: "#F7F7F7",
          borderRadius: 28,
          padding: 3,
        }}
      >
        <Pressable
          accessibilityLabel="Add a drink"
          onPress={() => router.push("/add")}
          style={{ padding: 11 }}
        >
          <Icon name="plus" size={23} />
        </Pressable>
        <Pressable
          accessibilityLabel={active === "today" ? "View week" : "View today"}
          onPress={() => router.replace(active === "today" ? "/week" : "/")}
          style={{ padding: 11 }}
        >
          <Icon name={active === "today" ? "chart" : "drop"} size={21} />
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel="Scan barcode"
        onPress={() => router.push("/scan")}
        style={{ padding: 12 }}
      >
        <Icon name="camera" size={23} />
      </Pressable>
      <Pressable
        accessibilityLabel="Voice log"
        onPress={() =>
          router.push({ pathname: "/add", params: { mode: "voice" } })
        }
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: colors.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="mic" color="#103B62" size={27} />
      </Pressable>
    </View>
  );
}
