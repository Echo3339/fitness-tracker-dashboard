import { getLanguage, translateUnit } from "./i18n.js";

const dateFormatters = {
  en: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
  zh: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }),
};

export const parseDate = (iso) => new Date(`${iso}T00:00:00`);

export const formatDate = (iso) => dateFormatters[getLanguage()].format(parseDate(iso)).replace(/\//g, "/");

export const formatClock = (value) => {
  if (value === null || value === undefined) return "—";
  const hour = Math.floor(value % 24);
  const minute = Math.round((value - Math.floor(value)) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
};

export const formatValue = (value, unit) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (unit === "时刻") return formatClock(value);
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "BMI") return value.toFixed(1);
  if (unit === "bpm") return `${value.toFixed(0)}`;
  if (unit === "次/周") return `${Number.isInteger(value) ? value : value.toFixed(1)}${getLanguage() === "zh" ? "次/周" : " reps/week"}`;
  if (unit === "次") return `${Number.isInteger(value) ? value : value.toFixed(1)}${getLanguage() === "zh" ? "次" : " reps"}`;
  if (unit === "kg/日") return `${value.toFixed(2)}`;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
};

export const latestValue = (series) => {
  for (let index = series.values.length - 1; index >= 0; index -= 1) {
    if (series.values[index] !== null && series.values[index] !== undefined) return series.values[index];
  }
  return null;
};

export const toSleepTimelineHour = (clockValue) => {
  if (clockValue === null || clockValue === undefined) return null;
  return clockValue < 18 ? clockValue + 24 : clockValue;
};

export const sleepTickLabel = (timelineHour) => {
  const hour = Math.floor(timelineHour) % 24;
  const minute = Math.round((timelineHour - Math.floor(timelineHour)) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const formatTrainingSet = (entry) => {
  if (!entry) return "—";
  const formatNumber = (value) => (Number.isInteger(value) ? `${value}` : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  if (getLanguage() === "en") {
    return `${formatNumber(entry.weight)} kg × ${formatNumber(entry.reps)} × ${formatNumber(entry.sets)}`;
  }
  return `${formatNumber(entry.weight)} kg × ${formatNumber(entry.reps)} × ${formatNumber(entry.sets)}`;
};

export const formatTrainingVolume = (value) => {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
};

export const seriesDelta = (series, unit) => {
  if (unit === "时刻") return null;
  const valid = series.values.filter((value) => value !== null && value !== undefined);
  if (!valid.length) return null;
  return valid.at(-1) - valid[0];
};

export const trainingDelta = (action, data) => {
  const field = action.kind === "bodyweight" ? "maxReps" : "maxWeight";
  if (data?.rangeMode !== "day") {
    const summaryDelta = action.summaryValues?.at(-1)?.cumulativeDelta;
    if (Number.isFinite(summaryDelta)) return summaryDelta;
  }
  const values = action.values
    .filter(Boolean)
    .map((entry) => entry[field])
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  if (action.kind === "weighted-chin-up") return values.at(-1);
  return values.at(-1) - values[0];
};

export const latestTrainingEntry = (action, data) => {
  if (data?.rangeMode !== "day") {
    const summaryEntry = action.summaryValues?.at(-1);
    if (summaryEntry) return summaryEntry;
  }
  for (let index = action.values.length - 1; index >= 0; index -= 1) {
    if (action.values[index]) return action.values[index];
  }
  return null;
};

export const formatTrainingMax = (action, data) => {
  const entry = latestTrainingEntry(action, data);
  if (!entry) return "—";
  if (action.kind === "bodyweight") {
    if (!Number.isFinite(entry.maxReps)) return "—";
    return getLanguage() === "zh" ? `${entry.maxReps}次` : `${entry.maxReps} reps`;
  }
  if (action.kind === "weighted-chin-up") {
    if (!Number.isFinite(entry.maxReps) && !Number.isFinite(entry.maxWeight)) return "—";
    const weight = Number.isFinite(entry.maxWeight)
      ? `${Number.isInteger(entry.maxWeight) ? entry.maxWeight : entry.maxWeight.toFixed(1)} kg`
      : "—";
    const reps = Number.isFinite(entry.maxReps)
      ? `${entry.maxReps}${getLanguage() === "zh" ? "次" : " reps"}`
      : "—";
    return `${weight} × ${reps}`;
  }
  if (!Number.isFinite(entry.maxWeight)) return "—";
  const value = Number.isInteger(entry.maxWeight)
    ? `${entry.maxWeight}`
    : entry.maxWeight.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${value}`;
};

export const formatDelta = (value, unit) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const normalized = Math.abs(value) < 0.0001 ? 0 : value;
  const sign = normalized > 0 ? "+" : "";
  if (unit === "%") return `${sign}${normalized.toFixed(1)}%`;
  if (unit === "bpm") return `${sign}${normalized.toFixed(0)}bpm`;
  if (unit === "kg/日") return getLanguage() === "zh"
    ? `${sign}${normalized.toFixed(2)}kg/日`
    : `${sign}${normalized.toFixed(2)}kg/day`;
  if (unit === "时刻") return "";
  if (unit === "小时") return getLanguage() === "zh" ? `${sign}${normalized.toFixed(1)}小时` : `${sign}${normalized.toFixed(1)}h`;
  const formatted = Number.isInteger(normalized) ? `${normalized}` : normalized.toFixed(1);
  if (unit === "次") return `${sign}${formatted}${getLanguage() === "zh" ? "次" : " reps"}`;
  if (unit === "BMI") return sign + formatted;
  return `${sign}${formatted}${translateUnit(unit) || ""}`;
};
