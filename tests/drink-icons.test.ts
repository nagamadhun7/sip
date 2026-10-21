import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  iconNames,
  iconShapes,
  shapeIcons,
  resolveDrinkIcon,
  iconColor,
} from "../src/lib/drink-icons.ts";
const sharp = createRequire(import.meta.url)("sharp");
const assets = new URL("../assets/drinks/", import.meta.url);
const traces = JSON.parse(
  fs.readFileSync(new URL("traces.json", assets), "utf8"),
);
test("all 30 grid names have a flat vector and three equally padded transparent PNG sizes", async () => {
  assert.equal(iconNames.length, 30);
  assert.deepEqual(Object.keys(traces), iconNames);
  for (const name of iconNames) {
    const svg = fs.readFileSync(new URL(`${name}.svg`, assets), "utf8");
    assert.match(svg, /viewBox="0 0 64 64"/);
    assert.doesNotMatch(svg, /gradient|<image|http[^]*href/);
    assert.ok(traces[name].path.length > 20, name);
    for (const scale of [1, 2, 3]) {
      const filename = `${name}${scale === 1 ? "" : `@${scale}x`}.png`;
      const input = fs.readFileSync(new URL(filename, assets));
      const { data, info } = await sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 64 * scale);
      assert.equal(info.height, 64 * scale);
      assert.equal(data[3], 0);
      assert.equal(data.at(-1), 0);
    }
    const { data } = await sharp(Buffer.from(svg))
      .resize(24, 24)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 100) ink++;
    assert.ok(ink > 20, `${name} is visible at 24 px`);
  }
});
test("unknown icons never resolve to a broken asset and custom shapes use the saved tint", () => {
  for (const type of [undefined, "unknown", "", "toString"])
    assert.equal(resolveDrinkIcon(type).name, "custom-drink");
  assert.equal(resolveDrinkIcon("green-tea").name, "tea");
  for (const shape of iconShapes) {
    const icon = resolveDrinkIcon("custom-drink", shape);
    assert.equal(icon.name, shapeIcons[shape]);
    assert.equal(icon.tint, true);
  }
  assert.equal(resolveDrinkIcon("coffee", "toString").name, "coffee");
  assert.equal(iconColor("#AABBCC"), "#AABBCC");
  assert.equal(iconColor("bad"), "#6FAEE8");
});
