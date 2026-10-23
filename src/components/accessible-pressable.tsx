import React from "react";
import { Pressable as NativePressable } from "react-native";
import type { PressableProps } from "react-native";
import { translate } from "../features/locale";
function spoken(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number")
    return String(translate(String(node)));
  if (Array.isArray(node)) return node.map(spoken).filter(Boolean).join(", ");
  if (
    React.isValidElement<{
      children?: React.ReactNode;
      accessibilityLabel?: string;
    }>(node)
  )
    return node.props.accessibilityLabel ?? spoken(node.props.children);
  return "";
}
export function AccessiblePressable({
  children,
  style,
  accessibilityLabel,
  accessibilityState,
  disabled,
  ...props
}: PressableProps) {
  const label =
    accessibilityLabel ??
    (typeof children === "function" ? undefined : spoken(children));
  return (
    <NativePressable
      {...props}
      accessible
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityLabel={label ? String(translate(label)) : undefined}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        { minWidth: 44, minHeight: 44 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {children}
    </NativePressable>
  );
}
