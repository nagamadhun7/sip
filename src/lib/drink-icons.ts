export const iconNames =
  "water sparkling-water coffee espresso iced-coffee latte tea iced-tea cola soda-bottle energy-drink sports-drink orange-juice juice-bottle milk plant-milk smoothie protein-shake beer wine cocktail shot hot-chocolate coconut-water kombucha electrolyte-drink lemonade broth my-bottle custom-drink".split(
    " ",
  );
export const iconShapes = [
  "mug",
  "tall-glass",
  "can",
  "bottle",
  "carton",
  "jar",
  "wine-glass",
  "bowl",
  "cup",
] as const;
export type IconShape = (typeof iconShapes)[number] | "glass"; // Keep existing saved glass recipes compatible.
export const shapeIcons: Record<IconShape, string> = {
  mug: "coffee",
  "tall-glass": "water",
  glass: "water",
  can: "energy-drink",
  bottle: "soda-bottle",
  carton: "milk",
  jar: "kombucha",
  "wine-glass": "wine",
  bowl: "broth",
  cup: "latte",
};
const aliases: Record<string, string> = {
  "black-tea": "tea",
  "green-tea": "tea",
  "herbal-tea": "tea",
  "whole-milk": "milk",
  "oat-milk": "plant-milk",
  "almond-milk": "plant-milk",
  "soy-milk": "plant-milk",
};
export function resolveDrinkIcon(type?: string, shape?: string) {
  if (shape && Object.hasOwn(shapeIcons, shape))
    return { name: shapeIcons[shape as IconShape], tint: true };
  const name = aliases[type ?? ""] ?? type ?? "custom-drink";
  return {
    name: iconNames.includes(name) ? name : "custom-drink",
    tint: name === "custom-drink" || !iconNames.includes(name),
  };
}
export const iconColor = (color?: string) =>
  /^#[0-9a-f]{6}$/i.test(color ?? "") ? color! : "#6FAEE8";
