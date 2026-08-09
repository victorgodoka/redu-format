import assert from "node:assert/strict";
import test from "node:test";
import { createDrawer } from "./draw.ts";

const images = Array.from({ length: 11 }, (_, i) => `img-${i}`);

test("every image shows once before any repeats", () => {
  const draw = createDrawer(images, 3);
  for (let cycle = 0; cycle < 20; cycle++) {
    const seen = Array.from({ length: images.length }, draw);
    assert.deepEqual([...seen].sort(), [...images].sort(), `cycle ${cycle}`);
  }
});

test("nothing repeats inside the on-screen window", () => {
  const onScreen = 3;
  const draw = createDrawer(images, onScreen);
  const window: string[] = [];
  for (let i = 0; i < 500; i++) {
    const pick = draw();
    assert.ok(!window.includes(pick), `${pick} was still on screen at draw ${i}`);
    window.push(pick);
    if (window.length >= onScreen) window.shift();
  }
});

test("survives a deck smaller than the screen", () => {
  const draw = createDrawer(["only"], 3);
  assert.equal(draw(), "only");
  assert.equal(draw(), "only");
});
