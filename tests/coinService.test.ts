import assert from "node:assert/strict";
import test from "node:test";
import { calculateCoins, getBudgetForAttempt, getTimeLimitForLevel } from "../src/Service/coinService";

test("getBudgetForAttempt decreases budget across attempts and then bottoms out", () => {
  assert.equal(getBudgetForAttempt(1, 1), 20);
  assert.equal(getBudgetForAttempt(1, 2), 15);
  assert.equal(getBudgetForAttempt(1, 5), 6);
  assert.equal(getBudgetForAttempt(1, 99), 5);
});

test("getTimeLimitForLevel returns tighter limits for higher levels", () => {
  assert.equal(getTimeLimitForLevel(1), 600);
  assert.equal(getTimeLimitForLevel(3), 480);
  assert.equal(getTimeLimitForLevel(5), 360);
  assert.equal(getTimeLimitForLevel(99), 300);
});

test("calculateCoins rewards completion while applying attempt penalties", () => {
  const firstAttempt = calculateCoins(2, 1, 1, 8, 20, 60, 600);
  const laterAttempt = calculateCoins(2, 3, 1, 8, 20, 60, 600);

  assert.ok(firstAttempt > laterAttempt);
  assert.ok(firstAttempt > 0);
});

test("calculateCoins returns zero for zero completion", () => {
  assert.equal(calculateCoins(1, 1, 0, 10, 20, 60, 600), 0);
});
