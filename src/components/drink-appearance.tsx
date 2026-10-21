import { AccessiblePressable as Pressable } from "./accessible-pressable";
import React from "react";
import { View, } from "react-native";
import { T, Input } from "./ui";
import { DrinkIcon } from "./drink-icon";
import { iconShapes, iconColor } from "../lib/drink-icons";
import type { IconShape } from "../lib/drink-icons";
export function DrinkAppearance({
  shape,
  color,
  onShape,
  onColor,
}: {
  shape: IconShape;
  color: string;
  onShape: (s: IconShape) => void;
  onColor: (c: string) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <T size={13} muted>
        Icon shape
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {iconShapes.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityLabel={s.replace(/-/g, " ")}
            accessibilityState={{
              selected:
                s === shape || (shape === "glass" && s === "tall-glass"),
            }}
            onPress={() => onShape(s)}
            style={{
              alignItems: "center",
              padding: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor:
                s === shape || (shape === "glass" && s === "tall-glass")
                  ? "#6FAEE8"
                  : "#E8EBED",
            }}
          >
            <DrinkIcon
              type="custom-drink"
              shape={s}
              color={iconColor(color)}
              size={32}
            />
            <T size={11}>{s.replace(/-/g, " ")}</T>
          </Pressable>
        ))}
      </View>
      <T size={13} muted>
        Icon color
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {[
          "#6FAEE8",
          "#A0724A",
          "#D6B48C",
          "#90A783",
          "#F2A58A",
          "#EE6795",
          "#9A90BA",
          "#4AA994",
          "#687580",
        ].map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={`Color ${c}`}
            accessibilityState={{ selected: c === color }}
            onPress={() => onColor(c)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: c,
              borderWidth: c === color ? 3 : 0,
              borderColor: "#103B62",
            }}
          />
        ))}
      </View>
      <Input
        label="Custom icon color (#RRGGBB)"
        value={color}
        onChangeText={onColor}
      />
      <T size={12} muted>
        Choose a swatch or enter a six-digit hex color.
      </T>
    </View>
  );
}
