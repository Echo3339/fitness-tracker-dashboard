import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulateChinUpLoad,
  parseBodyweightChinUp,
  parseChinUpSets,
  parseWeightedChinUpSession,
} from "./training-data.mjs";

test("parses one self-weight set per numeric row", () => {
  assert.deepEqual(parseBodyweightChinUp("3\n3\n3", "自重"), {
    kind: "bodyweight",
    maxReps: 3,
    totalReps: 9,
    setCount: 3,
    repsBySet: [3, 3, 3],
  });
});

test("splits mixed self-weight and weighted sets by matching marker rows", () => {
  const sets = parseChinUpSets("3\n5\n2", "自重\n0.5\n自重");
  assert.deepEqual(sets, [
    { reps: 3, marker: "自重" },
    { reps: 5, marker: "0.5" },
    { reps: 2, marker: "自重" },
  ]);
  assert.equal(parseBodyweightChinUp("3\n5\n2", "自重\n0.5\n自重").setCount, 2);
  assert.deepEqual(parseWeightedChinUpSession("3\n5\n2", "自重\n0.5\n自重"), {
    kind: "weighted-chin-up",
    sessionIncrease: 1,
    maxReps: 5,
    totalReps: 5,
    setCount: 1,
    repsBySet: [5],
  });
});

test("accumulates both-side load increases and clamps reductions at bodyweight", () => {
  assert.equal(accumulateChinUpLoad(0, 1), 1);
  assert.equal(accumulateChinUpLoad(1, 0.5), 1.5);
  assert.equal(accumulateChinUpLoad(1.5, -2), 0);
});
