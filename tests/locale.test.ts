import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDrinkText,
  setLocale,
  translate,
  regionalOunce,
} from "../src/features/locale.ts";
test("regional drink aliases and decimal amounts normalize locally and interface language changes", () => {
  assert.equal(
    normalizeDrinkText("250 ml agua y un café", "es-ES"),
    "250 ml water and one coffee",
  );
  assert.equal(normalizeDrinkText("0,5 litres eau", "fr-FR"), "0.5 l water");
  setLocale("es-ES");
  assert.equal(translate("Water"), "Agua");
  setLocale("en-US");
  assert.notEqual(regionalOunce("en-US"), regionalOunce("en-GB"));
});
