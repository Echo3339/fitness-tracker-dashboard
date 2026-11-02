const parseRep = (value) => {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
};

const parseIncrement = (value) => {
  const text = String(value ?? "").trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text);
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const trainingNotes = (value) => (
  typeof value === "string"
    ? value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("#"))
    : []
);

export const parseChinUpSets = (value, marker) => {
  if (typeof value !== "string") return [];
  const rawLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const embeddedBodyweight = rawLines[0] === "自重";
  const repLines = embeddedBodyweight ? rawLines.slice(1) : rawLines;
  const reps = repLines.map(parseRep);
  if (!reps.length || reps.some((item) => item === null)) return [];
  const markerLines = String(marker ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const alignedMarkers = markerLines.length === 1
    ? reps.map(() => markerLines[0])
    : markerLines.length === reps.length
      ? markerLines
      : embeddedBodyweight && markerLines.length === 0
        ? reps.map(() => "自重")
        : [];
  if (!alignedMarkers.length) return [];
  return reps.map((count, index) => ({ reps: count, marker: alignedMarkers[index] }));
};

export const parseBodyweightChinUp = (value, marker) => {
  const repsBySet = parseChinUpSets(value, marker)
    .filter((set) => set.marker === "自重")
    .map((set) => set.reps);
  if (!repsBySet.length) return null;
  const entry = {
    kind: "bodyweight",
    maxReps: Math.max(...repsBySet),
    totalReps: repsBySet.reduce((sum, reps) => sum + reps, 0),
    setCount: repsBySet.length,
    repsBySet,
  };
  const notes = trainingNotes(value);
  return notes.length ? { ...entry, notes } : entry;
};

export const parseWeightedChinUpSession = (value, marker) => {
  const sets = parseChinUpSets(value, marker)
    .map((set) => ({ ...set, incrementPerSide: parseIncrement(set.marker) }))
    .filter((set) => set.incrementPerSide !== null);
  if (!sets.length) return null;
  const repsBySet = sets.map((set) => set.reps);
  const entry = {
    kind: "weighted-chin-up",
    sessionIncrease: round(sets.at(-1).incrementPerSide * 2),
    maxReps: Math.max(...repsBySet),
    totalReps: repsBySet.reduce((sum, reps) => sum + reps, 0),
    setCount: repsBySet.length,
    repsBySet,
  };
  const notes = trainingNotes(value);
  return notes.length ? { ...entry, notes } : entry;
};

export const accumulateChinUpLoad = (current, sessionIncrease) => (
  round(Math.max(0, current + sessionIncrease))
);
