const parseIsoDate = (iso) => new Date(`${iso}T00:00:00`);

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
};

const bucketKey = (iso, mode) => {
  const date = parseIsoDate(iso);
  if (mode === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (mode === "week") return toIsoDate(startOfWeek(date));
  return iso;
};

const bucketDate = (key, mode) => (mode === "month" ? `${key}-01` : key);

const average = (values) => {
  const valid = values.filter((value) => value !== null && value !== undefined);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const lastValue = (values) => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null && values[index] !== undefined) return values[index];
  }
  return null;
};

const countSymbols = (value) => [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length;

const aggregateSeries = (series, indexes, isSleep, isDesire) => {
  const values = indexes.map((index) => series.values[index]);
  if (isDesire) return values.reduce((total, value) => total + (Number.isFinite(value) ? value : countSymbols(value)), 0);
  if (isSleep && series.id !== "sleep-duration") {
    const clockValues = values
      .filter((value) => Number.isFinite(value))
      .map((value) => value < 18 ? value + 24 : value);
    const mean = average(clockValues);
    return mean === null ? null : mean % 24;
  }
  return average(values);
};

const aggregateTraining = (values, indexes) => {
  const entries = indexes.map((index) => values[index]).filter(Boolean);
  if (!entries.length) return null;
  const isWeightedChinUp = entries.some((entry) => entry.kind === "weighted-chin-up");
  const weightedEntries = entries.filter((entry) => Number.isFinite(entry.maxWeight));
  if (!weightedEntries.length) {
    const bodyweightEntries = entries.filter((entry) => Number.isFinite(entry.maxReps));
    if (!bodyweightEntries.length) return null;
    const latestEntry = bodyweightEntries.at(-1);
    const throughIndex = indexes.at(-1);
    const history = values.slice(0, throughIndex + 1).filter((entry) => Number.isFinite(entry?.maxReps));
    return {
      ...latestEntry,
      kind: "bodyweight",
      cumulativeDelta: history.at(-1).maxReps - history[0].maxReps,
    };
  }
  const latestEntry = weightedEntries.at(-1);
  const throughIndex = indexes.at(-1);
  const history = values.slice(0, throughIndex + 1).filter((entry) => Number.isFinite(entry?.maxWeight));
  return {
    ...latestEntry,
    totalVolume: weightedEntries.reduce((sum, entry) => sum + (entry.totalVolume || 0), 0),
    formalSet: weightedEntries.at(-1).formalSet,
    maxWeight: latestEntry.maxWeight,
    cumulativeDelta: isWeightedChinUp
      ? latestEntry.maxWeight
      : history.at(-1).maxWeight - history[0].maxWeight,
  };
};

export const createDisplayData = (source, mode = "day") => {
  if (mode === "day") {
    return {
      ...source,
      groups: source.groups.map((group) => ({
        ...group,
        series: group.series.map((series) => ({
          ...series,
          values: group.title === "欲"
            ? series.values.map((value) => value == null ? null : countSymbols(value))
            : [...series.values],
          desireDailyValues: group.title === "欲" ? [...series.values] : undefined,
          latestSummaryValues: group.title === "欲"
            ? series.values.map((value) => value == null ? null : countSymbols(value))
            : [...series.values],
        })),
      })),
      cumulativeGainSummaryValues: [...(source.cumulativeGainValues || [])],
      rangeMode: "day",
    };
  }
  const buckets = [];
  const bucketMap = new Map();
  source.dates.forEach((item, index) => {
    const key = bucketKey(item.date, mode);
    if (!bucketMap.has(key)) {
      const bucket = { key, indexes: [] };
      bucketMap.set(key, bucket);
      buckets.push(bucket);
    }
    bucketMap.get(key).indexes.push(index);
  });
  const bucketIndexBySourceIndex = new Map();
  buckets.forEach((bucket, bucketIndex) => {
    bucket.indexes.forEach((index) => bucketIndexBySourceIndex.set(index, bucketIndex));
  });
  return {
    ...source,
    dates: source.dates.map((item) => ({ ...item })),
    groups: source.groups.map((group) => ({
      ...group,
      series: group.series.map((series) => ({
        ...series,
        desireDailyValues: group.title === "欲" ? [...series.values] : undefined,
        values: group.title === "欲"
          ? source.dates.map((_, index) => {
            const bucketIndex = bucketIndexBySourceIndex.get(index);
            if (bucketIndex === undefined || buckets[bucketIndex].indexes[0] !== index) return null;
            return buckets[bucketIndex].indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0);
          })
          : [...series.values],
        summaryValues: buckets.map((bucket) => group.title === "欲"
          ? bucket.indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0)
          : aggregateSeries(
            series,
            bucket.indexes,
            group.chartType === "sleep-band" || group.chartType === "text",
            false,
          )),
        latestSummaryValues: group.title === "欲"
          ? buckets.map((bucket) => bucket.indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0))
          : buckets.map((bucket) => lastValue(bucket.indexes.map((index) => series.values[index]))),
      })),
    })),
    training: source.training.map((action) => ({
      ...action,
      values: [...action.values],
      summaryValues: buckets.map((bucket) => aggregateTraining(action.values, bucket.indexes)),
    })),
    cumulativeGainSummaryValues: buckets.map((bucket) => lastValue(bucket.indexes.map((index) => source.cumulativeGainValues?.[index]))),
    rangeMode: mode,
    rangeStart: source.dates[0].date,
    rangeEnd: source.dates.at(-1).date,
  };
};

export const rangeLabel = (mode) => ({ day: "按天", week: "按周", month: "按月" }[mode] || "按天");
