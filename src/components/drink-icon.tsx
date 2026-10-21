import React, { useState } from "react";
import { Image } from "react-native";
import Svg, { Path } from "react-native-svg";
import traces from "../../assets/drinks/traces.json";
import { pngSources } from "../../assets/drinks/sources";
import { resolveDrinkIcon, iconColor } from "../lib/drink-icons";
import type { Drink } from "../lib/model";
export function DrinkIcon({
  type,
  size = 28,
  drink,
  color,
  shape,
}: {
  type?: string;
  size?: number;
  drink?: Pick<Drink, "id" | "iconType" | "color" | "shape">;
  color?: string;
  shape?: string;
}) {
  const resolved = resolveDrinkIcon(
    type ?? drink?.iconType ?? drink?.id,
    shape ?? drink?.shape,
  );
  const key = resolved.name as keyof typeof traces;
  const data = traces[key] ?? traces["custom-drink"];
  const fill = resolved.tint ? iconColor(color ?? drink?.color) : data.color;
  const [failed, setFailed] = useState(false);
  if (data.raster && !resolved.tint && !failed)
    return (
      <Image
        accessible={false}
        source={pngSources[key]}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  return (
    <Svg accessible={false} width={size} height={size} viewBox="0 0 64 64">
      <Path
        d={data.path || traces["custom-drink"].path}
        fill={fill}
        fillRule="evenodd"
      />
    </Svg>
  );
}
