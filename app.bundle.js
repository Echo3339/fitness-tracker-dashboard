(() => {
  // js/config.js
  var timelineAxisOffset = 44;
  var chartConfig = {
    chartHeight: 220,
    expandedChartHeight: 640,
    sleepChartHeight: 330,
    trainingChartHeight: 640,
    textChartHeight: 132,
    desireChartHeight: 104,
    phaseGap: 15,
    chartMargin: { top: 8, right: 0, bottom: 15, left: 0 },
    sleepMargin: { top: 15, right: 0, bottom: 15, left: 0 },
    trainingMargin: { top: 15, right: 0, bottom: 15, left: 0 }
  };
  var createTimelineConfig = (dateCount, cellWidth2) => ({
    cellWidth: cellWidth2,
    leftOffset: 0,
    rightOffset: 0,
    timelineWidth: dateCount * cellWidth2,
    axisWidth: timelineAxisOffset
  });

  // js/date-range.js
  var parseIsoDate = (iso) => /* @__PURE__ */ new Date(`${iso}T00:00:00`);
  var toIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  var startOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    return result;
  };
  var bucketKey = (iso, mode) => {
    const date = parseIsoDate(iso);
    if (mode === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (mode === "week") return toIsoDate(startOfWeek(date));
    return iso;
  };
  var average = (values) => {
    const valid = values.filter((value) => value !== null && value !== void 0);
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  };
  var lastValue = (values) => {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      if (values[index] !== null && values[index] !== void 0) return values[index];
    }
    return null;
  };
  var countSymbols = (value) => [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length;
  var aggregateSeries = (series, indexes, isSleep, isDesire) => {
    const values = indexes.map((index) => series.values[index]);
    if (isDesire) return values.reduce((total, value) => total + (Number.isFinite(value) ? value : countSymbols(value)), 0);
    if (isSleep && series.id !== "sleep-duration") {
      const clockValues = values.filter((value) => Number.isFinite(value)).map((value) => value < 18 ? value + 24 : value);
      const mean = average(clockValues);
      return mean === null ? null : mean % 24;
    }
    return average(values);
  };
  var aggregateTraining = (values, indexes) => {
    const entries = indexes.map((index) => values[index]).filter(Boolean);
    if (!entries.length) return null;
    const isWeightedChinUp = entries.some((entry) => entry.kind === "weighted-chin-up");
    const weightedEntries = entries.filter((entry) => Number.isFinite(entry.maxWeight));
    if (!weightedEntries.length) {
      const bodyweightEntries = entries.filter((entry) => Number.isFinite(entry.maxReps));
      if (!bodyweightEntries.length) return null;
      const latestEntry2 = bodyweightEntries.at(-1);
      const throughIndex2 = indexes.at(-1);
      const history3 = values.slice(0, throughIndex2 + 1).filter((entry) => Number.isFinite(entry?.maxReps));
      return {
        ...latestEntry2,
        kind: "bodyweight",
        cumulativeDelta: history3.at(-1).maxReps - history3[0].maxReps
      };
    }
    const latestEntry = weightedEntries.at(-1);
    const throughIndex = indexes.at(-1);
    const history2 = values.slice(0, throughIndex + 1).filter((entry) => Number.isFinite(entry?.maxWeight));
    return {
      ...latestEntry,
      totalVolume: weightedEntries.reduce((sum, entry) => sum + (entry.totalVolume || 0), 0),
      formalSet: weightedEntries.at(-1).formalSet,
      maxWeight: latestEntry.maxWeight,
      cumulativeDelta: isWeightedChinUp ? latestEntry.maxWeight : history2.at(-1).maxWeight - history2[0].maxWeight
    };
  };
  var createDisplayData = (source, mode = "day") => {
    if (mode === "day") {
      return {
        ...source,
        groups: source.groups.map((group) => ({
          ...group,
          series: group.series.map((series) => ({
            ...series,
            values: group.title === "\u6B32" ? series.values.map((value) => value == null ? null : countSymbols(value)) : [...series.values],
            desireDailyValues: group.title === "\u6B32" ? [...series.values] : void 0,
            latestSummaryValues: group.title === "\u6B32" ? series.values.map((value) => value == null ? null : countSymbols(value)) : [...series.values]
          }))
        })),
        cumulativeGainSummaryValues: [...source.cumulativeGainValues || []],
        rangeMode: "day"
      };
    }
    const buckets = [];
    const bucketMap = /* @__PURE__ */ new Map();
    source.dates.forEach((item, index) => {
      const key = bucketKey(item.date, mode);
      if (!bucketMap.has(key)) {
        const bucket = { key, indexes: [] };
        bucketMap.set(key, bucket);
        buckets.push(bucket);
      }
      bucketMap.get(key).indexes.push(index);
    });
    const bucketIndexBySourceIndex = /* @__PURE__ */ new Map();
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
          desireDailyValues: group.title === "\u6B32" ? [...series.values] : void 0,
          values: group.title === "\u6B32" ? source.dates.map((_, index) => {
            const bucketIndex = bucketIndexBySourceIndex.get(index);
            if (bucketIndex === void 0 || buckets[bucketIndex].indexes[0] !== index) return null;
            return buckets[bucketIndex].indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0);
          }) : [...series.values],
          summaryValues: buckets.map((bucket) => group.title === "\u6B32" ? bucket.indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0) : aggregateSeries(
            series,
            bucket.indexes,
            group.chartType === "sleep-band" || group.chartType === "text",
            false
          )),
          latestSummaryValues: group.title === "\u6B32" ? buckets.map((bucket) => bucket.indexes.reduce((total, sourceIndex) => total + countSymbols(series.values[sourceIndex]), 0)) : buckets.map((bucket) => lastValue(bucket.indexes.map((index) => series.values[index])))
        }))
      })),
      training: source.training.map((action) => ({
        ...action,
        values: [...action.values],
        summaryValues: buckets.map((bucket) => aggregateTraining(action.values, bucket.indexes))
      })),
      cumulativeGainSummaryValues: buckets.map((bucket) => lastValue(bucket.indexes.map((index) => source.cumulativeGainValues?.[index]))),
      rangeMode: mode,
      rangeStart: source.dates[0].date,
      rangeEnd: source.dates.at(-1).date
    };
  };

  // js/i18n.js
  var STORAGE_KEY = "whatsup.bio.language.v2";
  var language = localStorage.getItem(STORAGE_KEY) || "zh";
  var dictionary = {
    en: {
      appTitle: "Data Records",
      logoAlt: "Data Records",
      dataSummary: (count) => `${count} days`,
      metric: "Metric",
      pointsShort: "Pts",
      valuesShort: "Val",
      showPoints: "Show points",
      showValues: "Show all values",
      zoom: "Zoom",
      dateRange: "Date range",
      locateToday: "Center on today",
      day: "Day",
      week: "Week",
      month: "Month",
      sourceViewTitle: "Source data",
      sourceDownload: "Excel",
      sourceDownloadTitle: "Download fitness plan Excel",
      sourceDataAria: "Source data",
      trendAria: "Fitness trend timeline",
      filterAria: "Chart controls",
      strengthFilterAria: "Movement filter",
      sourceSheetTabs: "Source worksheets",
      siteOverview: "Overview",
      siteTraining: "Training",
      siteMetrics: "Metrics",
      siteDiet: "Diet",
      quantification: "Metrics",
      diet: "Diet",
      loadingData: "Loading data...",
      loadingQuantification: "Loading metrics data...",
      loadingDiet: "Loading diet data...",
      loadingFailed: "Data failed to load. Please refresh later.",
      loadingAppFailed: "Application script failed to load",
      sourceLoadFailed: (name, status) => `${name} failed to load (${status})`,
      lineChart: (title, unit) => `${title} ${unit} line chart`,
      barChart: (title, unit) => `${title} ${unit} bar chart`,
      textTimeline: (title) => `${title} notes`,
      sleepChart: "Sleep time band from 21:00 to 13:00, with 22:00 and 07:30 guides",
      strengthChart: "Strength training max-weight trend",
      strengthTraining: "Strength Training",
      maxWeight: "Max weight",
      maxReps: "Max reps",
      totalReps: "Total",
      setCount: "Count",
      totalVolume: "Total volume",
      formalSet: "Working",
      sleepOnset: "Sleep onset",
      wakeTime: "Wake time",
      sleepDuration: "Sleep duration",
      sleepAlignToActual: "Switch to actual sleep times",
      sleepAlignToDuration: "Switch to common-start duration comparison",
      desireCount: (count) => `${count}`,
      desireWeeklyAverage: (count) => `${Number.isFinite(count) ? Number.isInteger(count) ? count : count.toFixed(1) : "0"}`,
      average: "Avg",
      phaseFallback: (index) => `Phase ${index}`,
      monthLabel: (month) => `${month} mo`,
      weekLabel: (week) => `Week ${week}`
    },
    zh: {
      appTitle: "\u91CF\u5316\xB7\u529B\u91CF\u8BAD\u7EC3",
      logoAlt: "\u91CF\u5316\xB7\u529B\u91CF\u8BAD\u7EC3",
      dataSummary: (count) => `${count}\u5929`,
      metric: "\u6307\u6807",
      pointsShort: "\u70B9",
      valuesShort: "\u503C",
      showPoints: "\u663E\u793A\u8282\u70B9",
      showValues: "\u663E\u793A\u5168\u90E8\u503C",
      zoom: "\u7F29\u653E",
      dateRange: "\u65E5\u671F\u8303\u56F4",
      locateToday: "\u5B9A\u4F4D\u5230\u5F53\u524D\u65E5\u671F",
      day: "\u65E5",
      week: "\u5468",
      month: "\u6708",
      sourceViewTitle: "\u6E90\u6570\u636E",
      sourceDownload: "Excel",
      sourceDownloadTitle: "\u4E0B\u8F7D\u5065\u8EAB\u8BA1\u5212 Excel",
      sourceDataAria: "\u6E90\u6570\u636E",
      trendAria: "\u91CF\u5316\u8D8B\u52BF\u65F6\u95F4\u8F74",
      filterAria: "\u56FE\u8868\u7B5B\u9009",
      strengthFilterAria: "\u52A8\u4F5C\u7B5B\u9009",
      sourceSheetTabs: "\u6E90\u6570\u636E\u5DE5\u4F5C\u8868",
      siteOverview: "\u603B\u89C8",
      siteTraining: "\u529B\u8BAD",
      siteMetrics: "\u91CF\u5316",
      siteDiet: "\u996E\u98DF",
      quantification: "\u91CF\u5316",
      diet: "\u996E\u98DF\u8BB0\u5F55",
      loadingData: "\u6B63\u5728\u52A0\u8F7D\u6570\u636E\u2026",
      loadingQuantification: "\u6B63\u5728\u52A0\u8F7D\u91CF\u5316\u6570\u636E\u2026",
      loadingDiet: "\u6B63\u5728\u52A0\u8F7D\u996E\u98DF\u6570\u636E\u2026",
      loadingFailed: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0",
      loadingAppFailed: "\u5E94\u7528\u811A\u672C\u52A0\u8F7D\u5931\u8D25",
      sourceLoadFailed: (name, status) => `${name} \u52A0\u8F7D\u5931\u8D25\uFF08${status}\uFF09`,
      lineChart: (title, unit) => `${title} ${unit} \u6298\u7EBF\u56FE`,
      barChart: (title, unit) => `${title} ${unit} \u67F1\u72B6\u56FE`,
      textTimeline: (title) => `${title}\u79BB\u6563\u8BB0\u5F55`,
      sleepChart: "\u7761\u7720\u65F6\u95F4\u5E26\uFF0C\u65F6\u95F4\u8F74 21:00 \u81F3\u6B21\u65E5 13:00\uFF0C\u542B 22:00 \u548C 07:30 \u523B\u5EA6",
      strengthChart: "\u529B\u91CF\u8BAD\u7EC3\u6700\u5927\u91CD\u91CF\u8D8B\u52BF",
      strengthTraining: "\u529B\u91CF\u8BAD\u7EC3",
      maxWeight: "\u6700\u5927\u91CD\u91CF",
      maxReps: "\u6700\u5927\u6B21\u6570",
      totalReps: "\u603B\u91CF",
      setCount: "\u6570\u91CF",
      totalVolume: "\u603B\u8BAD\u7EC3\u91CF",
      formalSet: "\u6B63\u5F0F",
      sleepOnset: "\u5165\u7761\u65F6\u95F4",
      wakeTime: "\u8D77\u5E8A\u65F6\u95F4",
      sleepDuration: "\u7761\u7720\u65F6\u957F",
      sleepAlignToActual: "\u5207\u6362\u4E3A\u5B9E\u9645\u5165\u7761/\u8D77\u5E8A\u65F6\u95F4",
      sleepAlignToDuration: "\u5207\u6362\u4E3A\u7EDF\u4E00\u8D77\u70B9\u7684\u65F6\u957F\u5BF9\u6BD4",
      desireCount: (count) => `${count}`,
      desireWeeklyAverage: (count) => `${Number.isFinite(count) ? Number.isInteger(count) ? count : count.toFixed(1) : "0"}`,
      average: "\u5747\u503C",
      phaseFallback: (index) => `\u9636\u6BB5 ${index}`,
      monthLabel: (month) => `${month} \u6708`,
      weekLabel: (week) => `\u7B2C${week}\u5468`
    }
  };
  var textMap = {
    "\u7761\u7720\u65F6\u95F4\u5E26": "Sleep Window",
    "\u8EAB\u4F53\u8D28\u91CF": "Body Mass",
    "\u56F4\u5EA6": "Circumference",
    "\u4F53\u8102\u7387": "Body Fat",
    "\u4EBA\u4F53\u6210\u5206": "Body Composition",
    "\u8282\u6BB5\u8102\u80AA": "Segmental Fat",
    "\u8282\u6BB5\u808C\u8089": "Segmental Muscle",
    "\u5FC3\u7387": "Heart Rate",
    "\u80FD\u91CF\u6536\u652F": "Energy Balance",
    "\u8425\u517B\u7D20": "Macros",
    "\u6B32": "Desire",
    "\u8DD1\u6B65\u7EC4": "Running sets",
    "\u8DD1\u6B65\u65F6\u957F": "Run duration",
    "\u6B21\u6570": "Count",
    "\u7D2F\u8BA1\u589E\u91CD": "Cumulative Gain",
    "\u589E\u91CD\u901F\u5EA6": "Gain Pace",
    "\u5165\u7761\u65F6\u95F4": "Sleep onset",
    "\u8D77\u5E8A\u65F6\u95F4": "Wake time",
    "\u7761\u7720\u65F6\u957F": "Sleep duration",
    "\u9759\u606F\u5FC3\u7387": "Resting HR",
    "\u6709\u6C27\u5FC3\u7387": "Cardio HR",
    "\u57FA\u51C6\u70ED\u91CF": "Baseline",
    "\u6709\u6C27\u6D88\u8017": "Cardio burn",
    "\u529B\u91CF\u8BAD\u7EC3": "Strength",
    "\u6444\u5165\u70ED\u91CF": "Intake",
    "\u78B3\u6C34": "Carbs",
    "\u86CB\u767D\u8D28": "Protein",
    "\u8102\u80AA": "Fat",
    "\u4F53\u91CD": "Weight",
    "\u808C\u8089": "Muscle",
    "\u65E5\u589E\u5E45": "Daily gain",
    "\u6C34\u5206": "Water",
    "\u9AA8\u76D0": "Bone mineral",
    "\u5DE6\u4E0A\u80A2": "Left arm",
    "\u53F3\u4E0A\u80A2": "Right arm",
    "\u5DE6\u4E0B\u80A2": "Left leg",
    "\u53F3\u4E0B\u80A2": "Right leg",
    "\u8EAF\u5E72": "Torso",
    "\u5DE6\u5927\u81C2\u56F4(\u76F4)": "Left arm straight",
    "\u5DE6\u5927\u81C2\u56F4(\u66F2)": "Left arm flexed",
    "\u53F3\u5927\u81C2\u56F4(\u76F4)": "Right arm straight",
    "\u53F3\u5927\u81C2\u56F4(\u66F2)": "Right arm flexed",
    "\u80F8\u56F4": "Chest",
    "\u8170\u56F4": "Waist",
    "\u5927\u817F(\u5DE6)": "Left thigh",
    "\u5927\u817F(\u53F3)": "Right thigh",
    "\u5C0F\u817F(\u5DE6)": "Left calf",
    "\u5C0F\u817F(\u53F3)": "Right calf",
    "\u72B6\u6001": "State",
    "\u8BB0\u5F55": "Notes",
    "\u65F6\u523B": "Clock",
    "\u5C0F\u65F6": "h",
    "kg/\u65E5": "kg/day",
    "\u6DF1\u8E72": "Squat",
    "\u63A8\u4E3E": "Press",
    "\u9AD8\u7FFB": "Clean",
    "\u5367\u63A8": "Bench",
    "\u786C\u62C9": "Deadlift",
    "\u81EA\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A": "Bodyweight Chin-up",
    "\u8D1F\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A": "Weighted Chin-up",
    "\u6B21": "reps",
    "\u6B21/\u5468": "reps/week",
    "\u7EC4": "sets",
    "\u91CF\u5316": "Metrics",
    "\u996E\u98DF\u8BB0\u5F55": "Diet"
  };
  var weekdayMap = {
    \u5468\u4E00: "Mon",
    \u5468\u4E8C: "Tue",
    \u5468\u4E09: "Wed",
    \u5468\u56DB: "Thu",
    \u5468\u4E94: "Fri",
    \u5468\u516D: "Sat",
    \u5468\u65E5: "Sun"
  };
  var phaseMap = {
    "\u9636\u6BB51\uFF1A1\u5468\u5EB7\u590D\u8BAD\u7EC3\u8BA1\u5212\uFF1A7/7-7/12\uFF08\u7B2C1\u5468\uFF09": "Phase 1: Recovery week, Jul 7-Jul 12",
    "\u9636\u6BB52\uFF1A1\u5468\u65E0\u6C27\u8BAD\u7EC3\u8BA1\u5212\u8BD5\u884C\uFF1A7/13-7/19\uFF08\u7B2C2\u5468\uFF09": "Phase 2: Strength trial week, Jul 13-Jul 19",
    "\u9636\u6BB53\uFF1A3\u5468\u65E0\u6C27\u8BAD\u7EC3\uFF08\u786C\u62C9\uFF09\u51B2\u523A\u8BA1\u5212\uFF1A7/19-8/09\uFF08\u7B2C3\u30014\u30015\u5468\uFF09": "Phase 3: Deadlift push, Jul 19-Aug 9",
    "\u9636\u6BB54\uFF1A1\u5468\u5E38\u89C4\u65E0\u6C27\u8BAD\u7EC3\u8BA1\u5212\uFF1A8/10-8/16\uFF08\u7B2C6\u5468\uFF09": "Phase 4: Standard strength week, Aug 10-Aug 16",
    "\u9636\u6BB55\uFF1A\uFF08\u61C8\u6020\uFF09\u65E0\u6C27\u8BAD\u7EC3\u8BA1\u5212\uFF1A8/17-8/30\uFF08\u7B2C7/8\u5468\uFF09": "Phase 5: Low-adherence strength block, Aug 17-Aug 30",
    "\u9636\u6BB56\uFF1A\u65E0\u6C27\u8BAD\u7EC3\u4F18\u5316\u8BA1\u5212\uFF1A8/31-10/04\uFF08\u7B2C9/10/11/12/13\u5468\uFF09": "Phase 6: Strength optimization, Aug 31-Oct 4"
  };
  var getLanguage = () => language;
  var setLanguage = (nextLanguage) => {
    language = nextLanguage === "zh" ? "zh" : "en";
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.lang = language;
  };
  var t = (key, ...args) => {
    const value = dictionary[language][key] ?? dictionary.en[key] ?? key;
    return typeof value === "function" ? value(...args) : value;
  };
  var translate = (value) => {
    if (language === "zh") {
      if (value === "\u81EA\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A") return "\u81EA\u91CD\u53CD\u624B";
      if (value === "\u8D1F\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A") return "\u8D1F\u91CD\u53CD\u624B";
      return value;
    }
    return textMap[value] || value;
  };
  var translateUnit = (unit) => language === "zh" ? unit : textMap[unit] || unit;
  var translateWeekday = (weekday) => language === "zh" ? weekday : weekdayMap[weekday] || weekday;
  var translatePhaseTitle = (title) => language === "zh" ? title : phaseMap[title] || title;
  setLanguage(language);

  // js/formatters.js
  var dateFormatters = {
    en: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    zh: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })
  };
  var parseDate = (iso) => /* @__PURE__ */ new Date(`${iso}T00:00:00`);
  var formatDate = (iso) => dateFormatters[getLanguage()].format(parseDate(iso)).replace(/\//g, "/");
  var formatClock = (value) => {
    if (value === null || value === void 0) return "\u2014";
    const hour = Math.floor(value % 24);
    const minute = Math.round((value - Math.floor(value)) * 60);
    return `${String(hour).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  };
  var formatValue = (value, unit) => {
    if (value === null || value === void 0) return "\u2014";
    if (typeof value === "string") return value;
    if (unit === "\u65F6\u523B") return formatClock(value);
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "BMI") return value.toFixed(1);
    if (unit === "bpm") return `${value.toFixed(0)}`;
    if (unit === "\u6B21/\u5468") return `${Number.isInteger(value) ? value : value.toFixed(1)}${getLanguage() === "zh" ? "\u6B21/\u5468" : " reps/week"}`;
    if (unit === "\u6B21") return `${Number.isInteger(value) ? value : value.toFixed(1)}${getLanguage() === "zh" ? "\u6B21" : " reps"}`;
    if (unit === "kg/\u65E5") return `${value.toFixed(2)}`;
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  };
  var latestValue = (series) => {
    for (let index = series.values.length - 1; index >= 0; index -= 1) {
      if (series.values[index] !== null && series.values[index] !== void 0) return series.values[index];
    }
    return null;
  };
  var toSleepTimelineHour = (clockValue) => {
    if (clockValue === null || clockValue === void 0) return null;
    return clockValue < 18 ? clockValue + 24 : clockValue;
  };
  var formatTrainingSet = (entry) => {
    if (!entry) return "\u2014";
    const formatNumber = (value) => Number.isInteger(value) ? `${value}` : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    if (getLanguage() === "en") {
      return `${formatNumber(entry.weight)} kg \xD7 ${formatNumber(entry.reps)} \xD7 ${formatNumber(entry.sets)}`;
    }
    return `${formatNumber(entry.weight)} kg \xD7 ${formatNumber(entry.reps)} \xD7 ${formatNumber(entry.sets)}`;
  };
  var formatTrainingVolume = (value) => {
    if (value === null || value === void 0) return "\u2014";
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  };
  var seriesDelta = (series, unit) => {
    if (unit === "\u65F6\u523B") return null;
    const valid = series.values.filter((value) => value !== null && value !== void 0);
    if (!valid.length) return null;
    return valid.at(-1) - valid[0];
  };
  var trainingDelta = (action, data2) => {
    const field = action.kind === "bodyweight" ? "maxReps" : "maxWeight";
    if (data2?.rangeMode !== "day") {
      const summaryDelta = action.summaryValues?.at(-1)?.cumulativeDelta;
      if (Number.isFinite(summaryDelta)) return summaryDelta;
    }
    const values = action.values.filter(Boolean).map((entry) => entry[field]).filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    if (action.kind === "weighted-chin-up") return values.at(-1);
    return values.at(-1) - values[0];
  };
  var latestTrainingEntry = (action, data2) => {
    if (data2?.rangeMode !== "day") {
      const summaryEntry = action.summaryValues?.at(-1);
      if (summaryEntry) return summaryEntry;
    }
    for (let index = action.values.length - 1; index >= 0; index -= 1) {
      if (action.values[index]) return action.values[index];
    }
    return null;
  };
  var formatTrainingMax = (action, data2) => {
    const entry = latestTrainingEntry(action, data2);
    if (!entry) return "\u2014";
    if (action.kind === "bodyweight") {
      if (!Number.isFinite(entry.maxReps)) return "\u2014";
      return getLanguage() === "zh" ? `${entry.maxReps}\u6B21` : `${entry.maxReps} reps`;
    }
    if (action.kind === "weighted-chin-up") {
      if (!Number.isFinite(entry.maxReps) && !Number.isFinite(entry.maxWeight)) return "\u2014";
      const weight = Number.isFinite(entry.maxWeight) ? `${Number.isInteger(entry.maxWeight) ? entry.maxWeight : entry.maxWeight.toFixed(1)} kg` : "\u2014";
      const reps = Number.isFinite(entry.maxReps) ? `${entry.maxReps}${getLanguage() === "zh" ? "\u6B21" : " reps"}` : "\u2014";
      return `${weight} \xD7 ${reps}`;
    }
    if (!Number.isFinite(entry.maxWeight)) return "\u2014";
    const value = Number.isInteger(entry.maxWeight) ? `${entry.maxWeight}` : entry.maxWeight.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${value}`;
  };
  var formatDelta = (value, unit) => {
    if (value === null || value === void 0 || !Number.isFinite(value)) return "";
    const normalized = Math.abs(value) < 1e-4 ? 0 : value;
    const sign = normalized > 0 ? "+" : "";
    if (unit === "%") return `${sign}${normalized.toFixed(1)}%`;
    if (unit === "bpm") return `${sign}${normalized.toFixed(0)}bpm`;
    if (unit === "kg/\u65E5") return getLanguage() === "zh" ? `${sign}${normalized.toFixed(2)}kg/\u65E5` : `${sign}${normalized.toFixed(2)}kg/day`;
    if (unit === "\u65F6\u523B") return "";
    if (unit === "\u5C0F\u65F6") return getLanguage() === "zh" ? `${sign}${normalized.toFixed(1)}\u5C0F\u65F6` : `${sign}${normalized.toFixed(1)}h`;
    const formatted = Number.isInteger(normalized) ? `${normalized}` : normalized.toFixed(1);
    if (unit === "\u6B21") return `${sign}${formatted}${getLanguage() === "zh" ? "\u6B21" : " reps"}`;
    if (unit === "BMI") return sign + formatted;
    return `${sign}${formatted}${translateUnit(unit) || ""}`;
  };

  // js/svg.js
  var makeSvg = (tag, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  var buildPath = (series, xScale, yScale) => {
    let path = "";
    let started = false;
    series.values.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        return;
      }
      const x = xScale(index);
      const y = yScale(value);
      path += `${started ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)} `;
      started = true;
    });
    return path.trim();
  };
  var append = (parent, ...children) => {
    parent.append(...children);
    return parent;
  };

  // js/tooltip.js
  var tooltipGap = 22;
  var viewportPadding = 12;
  var positionTooltipBeside = ({
    tooltip: tooltip2,
    event,
    anchorX = event.clientX,
    anchorY = event.clientY,
    horizontalGap = tooltipGap,
    flipVertically = false,
    prepareLayout
  }) => {
    const isTrainingTooltip = Boolean(tooltip2.querySelector(".tooltip-training-grid"));
    tooltip2.classList.toggle("is-training-tooltip", isTrainingTooltip);
    tooltip2.style.display = "block";
    tooltip2.style.width = "";
    tooltip2.style.minWidth = "";
    tooltip2.style.maxWidth = `calc(100vw - ${viewportPadding * 2}px)`;
    tooltip2.style.height = "";
    tooltip2.style.maxHeight = "";
    const naturalWidth = tooltip2.offsetWidth;
    const rightSpace = window.innerWidth - anchorX - horizontalGap - viewportPadding;
    const leftSpace = anchorX - horizontalGap - viewportPadding;
    const placeRight = rightSpace >= naturalWidth || rightSpace >= leftSpace;
    const availableWidth = Math.max(1, placeRight ? rightSpace : leftSpace);
    if (!isTrainingTooltip) {
      tooltip2.style.minWidth = `${Math.min(154, availableWidth)}px`;
      tooltip2.style.maxWidth = `${availableWidth}px`;
    } else {
      tooltip2.style.maxWidth = `${availableWidth}px`;
    }
    prepareLayout?.();
    const width = tooltip2.offsetWidth;
    const height = tooltip2.offsetHeight;
    const preferredLeft = placeRight ? anchorX + horizontalGap : anchorX - horizontalGap - width;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    const alignedTop = anchorY - height / 2;
    const maxTop = Math.max(viewportPadding, window.innerHeight - height - viewportPadding);
    const top = !flipVertically ? alignedTop : anchorY + 16 + height > window.innerHeight - viewportPadding ? anchorY - height - 16 : anchorY + 16;
    tooltip2.style.left = `${Math.max(viewportPadding, Math.min(preferredLeft, maxLeft))}px`;
    tooltip2.style.top = `${Math.max(viewportPadding, Math.min(top, maxTop))}px`;
  };

  // js/timeline-grid.js
  var isMonday = (weekday) => String(weekday || "").includes("\u4E00");
  var phaseStarts = (data2) => [...new Set((data2.phases || []).slice(1).map((phase) => phase.start))].filter((start) => Number.isFinite(start));
  var weekStarts = (dates) => dates.reduce((starts, item, index) => {
    if (index === 0 || isMonday(item.weekday)) starts.push(index);
    return starts;
  }, []);

  // js/axis.js
  var readAxisWidth = () => {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--axis-offset"));
    return Number.isFinite(value) && value > 0 ? value : 44;
  };
  var normalizeTicks = ({ min, max, step, ticks }) => {
    if (Array.isArray(ticks)) return ticks;
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) return [];
    const values = [];
    for (let value = min; value <= max + step / 2; value += step) {
      values.push(Number(value.toFixed(8)));
    }
    return values;
  };
  var renderAxis = ({
    axisPanel,
    height,
    top,
    bottom,
    min,
    max,
    step,
    ticks,
    yPosition,
    format = (value) => String(value),
    classes = "axis-label",
    skipLine = () => false
  }) => {
    axisPanel.replaceChildren();
    const width = readAxisWidth();
    const safeHeight = Math.max(1, Number(height) || 1);
    const safeTop = Math.max(0, Number(top) || 0);
    const safeBottom = Math.max(0, Number(bottom) || 0);
    const plotHeight = Math.max(1, safeHeight - safeTop - safeBottom);
    const range = Math.max(1e-6, Number(max) - Number(min));
    const yScale = typeof yPosition === "function" ? (value) => yPosition(Number(value)) : (value) => safeTop + (Number(max) - Number(value)) / range * plotHeight;
    const svg = makeSvg("svg", {
      viewBox: `0 0 ${width} ${safeHeight}`,
      width,
      height: safeHeight,
      "aria-hidden": "true"
    });
    svg.appendChild(makeSvg("line", {
      x1: width - 0.5,
      y1: safeTop,
      x2: width - 0.5,
      y2: safeHeight - safeBottom,
      class: "axis-spine"
    }));
    normalizeTicks({ min, max, step, ticks }).forEach((value) => {
      const y = yScale(value);
      const label = makeSvg("text", {
        x: width - 5,
        y: y + 4,
        class: classes,
        "text-anchor": "end"
      });
      label.textContent = format(value);
      svg.appendChild(label);
    });
    axisPanel.appendChild(svg);
    return { yScale, width };
  };

  // js/date-preview.js
  var setDatePreview = (index) => {
    window.dispatchEvent(new CustomEvent("fitness-date-preview", {
      detail: { index: Number.isFinite(index) ? index : null }
    }));
  };

  // js/line-chart.js
  var negativeGrowthColor = "#2f8b70";
  var niceStep = (rough) => {
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return factor * magnitude;
  };
  var niceDomain = (group) => {
    const values = group.series.flatMap((series) => series.values).filter((value) => value !== null && value !== void 0);
    if (!values.length) return { min: 0, max: 1, step: 0.25 };
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const span = Math.max(0.01, dataMax - dataMin);
    const step = niceStep(span / 5);
    const min = Math.max(0, Math.floor(dataMin / step) * step);
    const max = Math.ceil(dataMax / step) * step;
    return { min, max: max === min ? min + step : max, step };
  };
  var valueColor = (group, series, value) => group.title === "\u589E\u91CD\u901F\u5EA6" && value < 0 ? negativeGrowthColor : series.color;
  var createLineChart = ({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showPoints: showPoints2, showAllValues: showAllValues2, chartHeight = chartConfig.chartHeight }) => {
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
    const chartMargin = { ...chartConfig.chartMargin, top: phaseGap, bottom: phaseGap };
    const innerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
    const chartGroup = {
      ...group,
      series: group.series.map((series) => ({
        ...series,
        values: series.values.map((value) => Number.isFinite(value) && value < 0 ? null : value)
      }))
    };
    const { min, max, step } = niceDomain(chartGroup);
    const xScale = (index) => index * cellWidth2 + cellWidth2 / 2;
    const yScale = (value) => chartMargin.top + (max - value) / (max - min) * innerHeight;
    const valueLabelY = (value) => Math.max(chartMargin.top + 12, Math.min(chartHeight - chartMargin.bottom - 4, yScale(value) - 8));
    const svg = makeSvg("svg", {
      viewBox: `0 0 ${timelineWidth} ${chartHeight}`,
      "aria-label": t("lineChart", translate(group.title), translateUnit(group.unit))
    });
    for (let value = min; value <= max + step / 2; value += step) {
      const y = yScale(value);
      const line = makeSvg("line", { x1: 0, y1: y, x2: timelineWidth, y2: y, class: "axis-line" });
      append(svg, line);
    }
    renderAxis({
      axisPanel,
      height: chartHeight,
      top: chartMargin.top,
      bottom: chartMargin.bottom,
      min,
      max,
      step,
      format: (value) => formatValue(value, group.unit)
    });
    phaseStarts(data2).forEach((start) => {
      const x = start * cellWidth2;
      svg.appendChild(makeSvg("line", { x1: x, y1: chartMargin.top, x2: x, y2: chartHeight - chartMargin.bottom, class: "phase-divider" }));
    });
    weekStarts(data2.dates).slice(1).forEach((start) => {
      if (phaseStarts(data2).includes(start)) return;
      const x = start * cellWidth2;
      svg.appendChild(makeSvg("line", {
        x1: x,
        y1: chartMargin.top,
        x2: x,
        y2: chartHeight - chartMargin.bottom,
        class: "week-divider"
      }));
    });
    const seriesNodes = [];
    chartGroup.series.forEach((series) => {
      const pathNodes = [];
      if (series.pointOnly) {
      } else if (chartGroup.title === "\u589E\u91CD\u901F\u5EA6") {
        const validValues = series.values.map((value, index) => value === null || value === void 0 ? null : { value, index }).filter(Boolean);
        for (let index = 1; index < validValues.length; index += 1) {
          const previous = validValues[index - 1];
          const current = validValues[index];
          const startX = xScale(previous.index);
          const startY = yScale(previous.value);
          const endX = xScale(current.index);
          const endY = yScale(current.value);
          const crossesZero = previous.value < 0 && current.value > 0 || previous.value > 0 && current.value < 0;
          if (crossesZero) {
            const ratio = previous.value / (previous.value - current.value);
            const zeroX = startX + (endX - startX) * ratio;
            const zeroY = yScale(0);
            const firstPath = makeSvg("path", { d: `M ${startX.toFixed(2)} ${startY.toFixed(2)} L ${zeroX.toFixed(2)} ${zeroY.toFixed(2)}`, class: "series-path", stroke: previous.value < 0 ? negativeGrowthColor : series.color });
            const secondPath = makeSvg("path", { d: `M ${zeroX.toFixed(2)} ${zeroY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}`, class: "series-path", stroke: current.value < 0 ? negativeGrowthColor : series.color });
            svg.append(firstPath, secondPath);
            pathNodes.push(firstPath, secondPath);
          } else {
            const path = makeSvg("path", { d: `M ${startX.toFixed(2)} ${startY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}`, class: "series-path", stroke: current.value < 0 ? negativeGrowthColor : series.color });
            svg.appendChild(path);
            pathNodes.push(path);
          }
        }
      } else {
        const path = makeSvg("path", { d: buildPath(series, xScale, yScale), class: "series-path", stroke: series.color });
        svg.appendChild(path);
        pathNodes.push(path);
      }
      const pointNodes = [];
      const valueNodes = [];
      series.values.forEach((value, index) => {
        if (value === null) return;
        const color = valueColor(chartGroup, series, value);
        const point = makeSvg("circle", { cx: xScale(index), cy: yScale(value), r: 3.5, fill: color, class: "series-point" });
        const valueLabel = makeSvg("text", { x: xScale(index), y: valueLabelY(value), fill: color, class: "line-value-label", "text-anchor": "middle" });
        valueLabel.textContent = formatValue(value, group.unit);
        svg.appendChild(point);
        svg.appendChild(valueLabel);
        pointNodes.push(point);
        valueNodes.push(valueLabel);
      });
      seriesNodes.push({ pathNodes, pointNodes, valueNodes, pointOnly: Boolean(series.pointOnly) });
    });
    const hoverLine = makeSvg("line", { x1: 0, y1: chartMargin.top, x2: 0, y2: chartHeight - chartMargin.bottom, class: "hover-line" });
    const hitArea = makeSvg("rect", {
      x: 0,
      y: chartMargin.top,
      width: timelineWidth,
      height: innerHeight,
      class: "chart-hit-area"
    });
    append(svg, hoverLine, hitArea);
    chartPanel.appendChild(svg);
    const dataIndexes = chartGroup.series.reduce((indexes, series) => {
      series.values.forEach((value, index) => {
        if (value !== null && value !== void 0 && !indexes.includes(index)) indexes.push(index);
      });
      return indexes;
    }, []).sort((left, right) => left - right);
    const nearestDataIndex = (rawIndex) => dataIndexes.length ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0]) : rawIndex;
    const updateVisibility = () => {
      seriesNodes.forEach(({ pathNodes, pointNodes, valueNodes, pointOnly }) => {
        pathNodes.forEach((path) => {
          path.style.display = showPoints2.checked ? "none" : "";
        });
        pointNodes.forEach((point) => {
          point.style.display = pointOnly || showPoints2.checked ? "" : "none";
        });
        valueNodes.forEach((value) => {
          value.style.display = showAllValues2.checked ? "" : "none";
        });
      });
    };
    hitArea.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const rawIndex = Math.max(0, Math.min(data2.dates.length - 1, Math.round((localX - cellWidth2 / 2) / cellWidth2)));
      const index = nearestDataIndex(rawIndex);
      setDatePreview(index);
      const date = data2.dates[index];
      tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} \xB7 ${translateWeekday(date.weekday)}</div>${chartGroup.series.map((series) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${valueColor(chartGroup, series, series.values[index])}"></span><span>${translate(series.label)}</span><span class="tooltip-value">${formatValue(series.values[index], chartGroup.unit)}</span></div>`).join("")}`;
      const x = xScale(index);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.opacity = "1";
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + x * (rect.width / timelineWidth)
      });
    });
    hitArea.addEventListener("pointerleave", () => {
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      setDatePreview(null);
    });
    updateVisibility();
    return updateVisibility;
  };

  // js/bar-chart.js
  var niceDomain2 = (group) => {
    const values = group.series.flatMap((series) => series.values).filter((value) => value !== null && value !== void 0);
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(1, (max - min) * 0.08);
    return [Math.max(0, min - padding), max + padding];
  };
  var createBarChart = ({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showPoints: showPoints2, showAllValues: showAllValues2, chartHeight = chartConfig.chartHeight }) => {
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
    const chartMargin = { ...chartConfig.chartMargin, top: phaseGap, bottom: phaseGap };
    const innerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
    const [min, max] = niceDomain2(group);
    const xScale = (index) => index * cellWidth2 + cellWidth2 / 2;
    const yScale = (value) => chartMargin.top + (max - value) / (max - min) * innerHeight;
    const svg = makeSvg("svg", { viewBox: `0 0 ${timelineWidth} ${chartHeight}`, "aria-label": t("barChart", translate(group.title), translateUnit(group.unit)) });
    const ticks = [];
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = min + (max - min) * tick / 4;
      const y = yScale(value);
      const line = makeSvg("line", { x1: 0, y1: y, x2: timelineWidth, y2: y, class: "axis-line" });
      append(svg, line);
      ticks.push(value);
    }
    renderAxis({
      axisPanel,
      height: chartHeight,
      top: chartMargin.top,
      bottom: chartMargin.bottom,
      ticks,
      min,
      max,
      format: (value) => formatValue(value, group.unit)
    });
    phaseStarts(data2).forEach((start) => {
      const x = start * cellWidth2;
      svg.appendChild(makeSvg("line", { x1: x, y1: chartMargin.top, x2: x, y2: chartHeight - chartMargin.bottom, class: "phase-divider" }));
    });
    const dataIndexes = group.series.reduce((indexes, series) => {
      series.values.forEach((value, index) => {
        if (value !== null && value !== void 0 && !indexes.includes(index)) indexes.push(index);
      });
      return indexes;
    }, []).sort((left, right) => left - right);
    const nearestDataIndex = (rawIndex) => dataIndexes.length ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0]) : rawIndex;
    const hoverLine = makeSvg("line", { x1: 0, y1: chartMargin.top, x2: 0, y2: chartHeight - chartMargin.bottom, class: "hover-line" });
    const hitArea = makeSvg("rect", {
      x: 0,
      y: chartMargin.top,
      width: timelineWidth,
      height: innerHeight,
      class: "chart-hit-area"
    });
    hitArea.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const rawIndex = Math.max(0, Math.min(data2.dates.length - 1, Math.round((localX - cellWidth2 / 2) / cellWidth2)));
      const index = nearestDataIndex(rawIndex);
      setDatePreview(index);
      const date = data2.dates[index];
      tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} \xB7 ${translateWeekday(date.weekday)}</div>${group.series.map((series) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${series.color}"></span><span>${translate(series.label)}</span><span class="tooltip-value">${formatValue(series.values[index], group.unit)}</span></div>`).join("")}`;
      const x = xScale(index);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.opacity = "1";
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + x * (rect.width / timelineWidth)
      });
    });
    hitArea.addEventListener("pointerleave", () => {
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      setDatePreview(null);
    });
    append(svg, hoverLine, hitArea);
    const barWidth = Math.max(4, Math.min(14, (cellWidth2 - 14) / group.series.length));
    const valueNodes = [];
    group.series.forEach((series, seriesIndex) => {
      series.values.forEach((value, index) => {
        if (value === null || value === void 0) return;
        const x = xScale(index) - (group.series.length - 1) * barWidth / 2 + seriesIndex * barWidth;
        const y = yScale(value);
        const bar = makeSvg("rect", { x, y, width: Math.max(3, barWidth - 2), height: Math.max(2, chartHeight - chartMargin.bottom - y), rx: 2, fill: series.color, class: "data-bar" });
        bar.addEventListener("pointerenter", (event) => {
          setDatePreview(index);
          const date = data2.dates[index];
          tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} \xB7 ${translateWeekday(date.weekday)}</div>${group.series.map((item) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${item.color}"></span><span>${translate(item.label)}</span><span class="tooltip-value">${formatValue(item.values[index], group.unit)}</span></div>`).join("")}`;
          positionTooltipBeside({ tooltip: tooltip2, event });
        });
        bar.addEventListener("pointerleave", () => {
          tooltip2.style.display = "none";
          setDatePreview(null);
        });
        svg.appendChild(bar);
        const label = makeSvg("text", { x: x + (barWidth - 2) / 2, y: y - 5, fill: series.color, class: "bar-value-label", "text-anchor": "middle" });
        label.textContent = formatValue(value, group.unit);
        valueNodes.push(label);
        svg.appendChild(label);
      });
    });
    chartPanel.appendChild(svg);
    const updateVisibility = () => valueNodes.forEach((node) => {
      node.style.display = showAllValues2.checked ? "" : "none";
    });
    updateVisibility();
    return updateVisibility;
  };

  // js/sleep-band-chart.js
  var sleepStart = (group) => group.series.find((series) => series.id === "sleep-onset");
  var wakeTime = (group) => group.series.find((series) => series.id === "wake-time");
  var sleepDuration = (group) => group.series.find((series) => series.id === "sleep-duration");
  var sleepBandColor = (duration) => duration >= 9.5 ? "#5479a8" : "#8ea9c4";
  var sleepBandHoverColor = (duration) => duration >= 9.5 ? "#46698f" : "#7895b0";
  var createSleepBandChart = ({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showAllValues: showAllValues2, aligned = true, chartHeight = chartConfig.sleepChartHeight }) => {
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
    const sleepMargin = { ...chartConfig.sleepMargin, top: phaseGap, bottom: phaseGap };
    const sleepChartHeight = chartHeight;
    const [min, max] = aligned ? [0, 12] : group.domain;
    const innerHeight = sleepChartHeight - sleepMargin.top - sleepMargin.bottom;
    const xScale = (index) => index * cellWidth2 + cellWidth2 / 2;
    const actualPosition = (value) => {
      const normalized = (value - min) / (max - min);
      return normalized ** 1.35;
    };
    const yScale = (value) => aligned ? sleepChartHeight - sleepMargin.bottom - (value - min) / (max - min) * innerHeight : sleepMargin.top + actualPosition(value) * innerHeight;
    const bandWidth = Math.max(1, Math.min(12, cellWidth2 * 0.72));
    const sleepLabelMode = cellWidth2 >= 18 ? "full" : cellWidth2 >= 9 ? "compact" : "sparse";
    const sleepLabelStride = sleepLabelMode === "sparse" ? Math.max(1, Math.ceil(14 / Math.max(cellWidth2, 1))) : 1;
    const svg = makeSvg("svg", {
      viewBox: `0 0 ${timelineWidth} ${sleepChartHeight}`,
      "aria-label": t("sleepChart")
    });
    const onset = sleepStart(group);
    const wake = wakeTime(group);
    const duration = sleepDuration(group);
    const dataIndexes = data2.dates.reduce((indexes, _, index) => {
      if (toSleepTimelineHour(onset.values[index]) !== null && toSleepTimelineHour(wake.values[index]) !== null) indexes.push(index);
      return indexes;
    }, []);
    const nearestDataIndex = (rawIndex) => dataIndexes.length ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0]) : rawIndex;
    const guideTime = aligned ? null : 31.5;
    const guideTimes = new Set(guideTime === null ? [] : [guideTime]);
    const majorTicks = aligned ? [0, 2, 4, 6, 8, 10, 12] : [22, 25, 28, 31.5, 35, 37];
    const axisTicks = [];
    [.../* @__PURE__ */ new Set([...majorTicks, ...guideTimes])].sort((a, b) => a - b).forEach((value) => {
      const y = yScale(value);
      const isGuide = value !== null && guideTimes.has(value);
      const line = makeSvg("line", {
        x1: 0,
        y1: y,
        x2: timelineWidth,
        y2: y,
        class: `axis-line${isGuide ? " sleep-guide-line" : ""}`
      });
      axisTicks.push(value);
      append(svg, line);
    });
    const actualTickPosition = (value) => sleepMargin.top + actualPosition(value) * innerHeight;
    renderAxis({
      axisPanel,
      height: sleepChartHeight,
      top: sleepMargin.top,
      bottom: sleepMargin.bottom,
      min,
      max,
      ticks: axisTicks,
      yPosition: aligned ? void 0 : actualTickPosition,
      classes: "sleep-axis-label",
      format: (value) => aligned ? `${String(value).padStart(2, "0")}h` : {
        22: "22:00",
        25: "01:00",
        28: "04:00",
        31.5: "07:30",
        35: "11:00",
        37: "13:00"
      }[value] || `${String(value).padStart(2, "0")}:00`
    });
    if (aligned) {
      svg.appendChild(makeSvg("line", {
        x1: 0,
        y1: yScale(0),
        x2: timelineWidth,
        y2: yScale(0),
        class: "sleep-aligned-baseline"
      }));
    }
    phaseStarts(data2).forEach((start) => {
      const x = start * cellWidth2;
      svg.appendChild(makeSvg("line", { x1: x, y1: sleepMargin.top, x2: x, y2: sleepChartHeight - sleepMargin.bottom, class: "phase-divider" }));
    });
    const hoverLine = makeSvg("line", { x1: 0, y1: sleepMargin.top, x2: 0, y2: sleepChartHeight - sleepMargin.bottom, class: "hover-line" });
    const hitArea = makeSvg("rect", {
      x: 0,
      y: sleepMargin.top,
      width: timelineWidth,
      height: innerHeight,
      class: "chart-hit-area"
    });
    const showTooltip = (event, index) => {
      const start = toSleepTimelineHour(onset.values[index]);
      const end = toSleepTimelineHour(wake.values[index]);
      const durationValue = duration.values[index] ?? (start !== null && end !== null ? end - start : null);
      tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(data2.dates[index].date)} \xB7 ${translateWeekday(data2.dates[index].weekday)}</div><div class="tooltip-line"><span>${t("sleepOnset")}</span><span class="tooltip-value">${formatClock(onset.values[index])}</span></div><div class="tooltip-line"><span>${t("wakeTime")}</span><span class="tooltip-value">${formatClock(wake.values[index])}</span></div><div class="tooltip-line"><span>${t("sleepDuration")}</span><span class="tooltip-value">${formatValue(durationValue, "\u5C0F\u65F6")}</span></div>`;
      const rect = svg.getBoundingClientRect();
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + xScale(index) * (rect.width / timelineWidth)
      });
    };
    hitArea.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const rawIndex = Math.max(0, Math.min(data2.dates.length - 1, Math.round((localX - cellWidth2 / 2) / cellWidth2)));
      const index = nearestDataIndex(rawIndex);
      setDatePreview(index);
      showTooltip(event, index);
      const x = xScale(index);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.opacity = "1";
    });
    hitArea.addEventListener("pointerleave", () => {
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      setDatePreview(null);
    });
    append(svg, hoverLine, hitArea);
    data2.dates.forEach((_, index) => {
      const start = toSleepTimelineHour(onset.values[index]);
      const end = toSleepTimelineHour(wake.values[index]);
      if (start === null || end === null) return;
      const durationValue = duration.values[index] ?? end - start;
      if (!Number.isFinite(durationValue)) return;
      const top = aligned ? yScale(durationValue) : yScale(Math.min(start, end));
      const bottom = aligned ? yScale(0) : yScale(Math.max(start, end));
      const bar = makeSvg("rect", {
        x: xScale(index) - bandWidth / 2,
        y: top,
        width: bandWidth,
        height: Math.max(8, bottom - top),
        rx: bandWidth / 2,
        fill: sleepBandColor(durationValue),
        class: "sleep-band"
      });
      bar.style.setProperty("--sleep-band-hover", sleepBandHoverColor(durationValue));
      bar.addEventListener("pointerenter", (event) => {
        setDatePreview(index);
        showTooltip(event, index);
      });
      bar.addEventListener("pointerleave", () => {
        tooltip2.style.display = "none";
        setDatePreview(null);
      });
      svg.appendChild(bar);
      if (showAllValues2.checked && index % sleepLabelStride === 0) {
        const valueLabel = makeSvg("text", {
          x: xScale(index) + (sleepLabelMode === "full" ? 9 : 0),
          y: top + 4,
          class: `sleep-value-label ${sleepLabelMode}`,
          "text-anchor": sleepLabelMode === "full" ? "start" : "middle"
        });
        valueLabel.textContent = `${(Math.round((end - start) * 10) / 10).toFixed(1)}h`;
        svg.appendChild(valueLabel);
      }
    });
    chartPanel.classList.add("sleep-chart-panel");
    chartPanel.classList.toggle("is-duration-aligned", aligned);
    chartPanel.appendChild(svg);
  };

  // js/text-timeline.js
  var escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  var textLines = (value) => String(value).split(/\r?\n/).filter(Boolean);
  var createTextTimeline = ({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, chartHeight = chartConfig.textChartHeight }) => {
    const axisOffset = 0;
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || 15;
    const centerY = Math.round(chartHeight / 2);
    const xScale = (index) => index * cellWidth2 + cellWidth2 / 2;
    const svg = makeSvg("svg", {
      viewBox: `0 0 ${timelineWidth} ${chartHeight}`,
      "aria-label": t("textTimeline", translate(group.title))
    });
    renderAxis({ axisPanel, height: chartHeight, top: phaseGap, bottom: phaseGap, min: 0, max: 1, ticks: [] });
    const baseline = makeSvg("line", {
      x1: axisOffset,
      y1: centerY,
      x2: timelineWidth,
      y2: centerY,
      class: "text-timeline-baseline"
    });
    const phaseDividers = phaseStarts(data2).map((start) => makeSvg("line", {
      x1: start * cellWidth2,
      y1: phaseGap,
      x2: start * cellWidth2,
      y2: chartHeight - phaseGap,
      class: "phase-divider"
    }));
    const markers = [];
    const displayValues = group.series.map((series) => ({
      series,
      values: series.values.map((value) => {
        if (group.chartType === "activity" && series.id === "running-duration") {
          return formatValue(value, "\u5C0F\u65F6");
        }
        return value;
      })
    }));
    displayValues.forEach(({ series, values }, seriesIndex) => {
      const laneY = group.chartType === "activity" ? Math.round((seriesIndex + 1) * chartHeight / (displayValues.length + 1)) : centerY;
      values.forEach((value, index) => {
        if (value === null || value === void 0) return;
        const x = xScale(index);
        const lines = textLines(value);
        const text = makeSvg("text", {
          x,
          y: laneY - (lines.length - 1) * 7,
          class: "text-timeline-value",
          fill: series.color,
          "text-anchor": "middle"
        });
        lines.forEach((line, lineIndex) => {
          const tspan = makeSvg("tspan", {
            x,
            dy: lineIndex === 0 ? 0 : 14
          });
          tspan.textContent = line;
          text.appendChild(tspan);
        });
        svg.appendChild(text);
        markers.push({ index, value, text });
      });
    });
    const hoverLine = makeSvg("line", {
      x1: 0,
      y1: phaseGap,
      x2: 0,
      y2: chartHeight - phaseGap,
      class: "hover-line"
    });
    const hitArea = makeSvg("rect", {
      x: 0,
      y: 0,
      width: timelineWidth,
      height: chartHeight,
      class: "text-timeline-hit-area"
    });
    append(svg, baseline, ...phaseDividers, hoverLine, hitArea);
    chartPanel.appendChild(svg);
    const dataIndexes = [...new Set(markers.map(({ index }) => index))];
    const nearestDataIndex = (rawIndex) => dataIndexes.length ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0]) : rawIndex;
    hitArea.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const rawIndex = Math.max(0, Math.min(
        data2.dates.length - 1,
        Math.round((localX - cellWidth2 / 2) / cellWidth2)
      ));
      const index = nearestDataIndex(rawIndex);
      setDatePreview(index);
      const date = data2.dates[index];
      const lines = group.series.map((series) => {
        const value = series.values[index];
        return `<div class="tooltip-line"><span class="tooltip-dot" style="background:${series.color}"></span><span>${escapeHtml(translate(series.label))}</span><span class="tooltip-value">${value == null ? "\u2014" : escapeHtml(value).replaceAll("\n", " / ")}</span></div>`;
      }).join("");
      tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} \xB7 ${escapeHtml(translateWeekday(date.weekday))}</div>${lines}`;
      const x = xScale(index);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.opacity = "1";
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + x * (rect.width / timelineWidth)
      });
    });
    hitArea.addEventListener("pointerleave", () => {
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      setDatePreview(null);
    });
  };

  // js/desire-timeline.js
  var countSymbols2 = (value) => [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length;
  var countLabel = (value) => `${Number.isFinite(value) ? value : 0}`;
  var createWeeklyPeriods = (series, dates) => {
    const starts = weekStarts(dates);
    const dailyValues = series.desireDailyValues || series.values;
    return starts.map((start, index) => {
      const end = (starts[index + 1] ?? dates.length) - 1;
      const value = dailyValues.slice(start, end + 1).reduce((total, item) => total + countSymbols2(item), 0);
      return { start, end, value, week: index };
    });
  };
  var createDesireTimeline = ({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, chartHeight = chartConfig.desireChartHeight }) => {
    const chartHeightValue = chartHeight;
    const left = 0;
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || 15;
    const top = phaseGap;
    const baseline = chartHeightValue - phaseGap - 7;
    const series = group.series[0];
    const periods = createWeeklyPeriods(series, data2.dates);
    const maxValue = Math.max(1, ...periods.map(({ value }) => value));
    const svg = makeSvg("svg", {
      viewBox: `0 0 ${timelineWidth} ${chartHeightValue}`,
      "aria-label": t("textTimeline", translate(group.title)),
      fill: "none"
    });
    renderAxis({ axisPanel, height: chartHeightValue, top: phaseGap, bottom: phaseGap, min: 0, max: 1, ticks: [] });
    const selectedBand = makeSvg("rect", {
      x: left,
      y: top,
      width: cellWidth2,
      height: chartHeightValue - top - phaseGap,
      class: "desire-week-selection",
      visibility: "hidden",
      fill: "#707e84",
      "fill-opacity": "0.08"
    });
    svg.appendChild(selectedBand);
    periods.forEach(({ start, end, value, week }) => {
      const x = left + start * cellWidth2;
      const width = Math.max(cellWidth2, (end - start + 1) * cellWidth2);
      const center = x + width / 2;
      const density = width >= 68 ? "full" : width >= 42 ? "compact" : "minimal";
      const barWidth = value > 0 ? Math.max(4, Math.min(width * 0.58, value / maxValue * 34)) : 4;
      const barY = baseline + 3;
      const bar = makeSvg("rect", {
        x: center - barWidth / 2,
        y: barY,
        width: barWidth,
        height: 6,
        rx: 3,
        class: value > 0 ? "desire-period-bar" : "desire-period-bar is-zero",
        "data-week": week
      });
      const title = makeSvg("title");
      title.textContent = `${countLabel(value)}`;
      bar.appendChild(title);
      svg.appendChild(bar);
      const pointY = baseline - value / maxValue * 46;
      const point = makeSvg("circle", {
        cx: center,
        cy: pointY,
        r: 3.2,
        class: "desire-period-point",
        "data-week": week
      });
      svg.appendChild(point);
      if (density !== "minimal") {
        const valueLabel = makeSvg("text", {
          x: center,
          y: Math.max(14, pointY - 8),
          class: "desire-period-value",
          "text-anchor": "middle",
          "data-week": week
        });
        valueLabel.textContent = countLabel(value);
        svg.appendChild(valueLabel);
      }
    });
    const linePoints = periods.map(({ start, end, value }) => {
      const width = Math.max(cellWidth2, (end - start + 1) * cellWidth2);
      const center = left + start * cellWidth2 + width / 2;
      const y = baseline - value / maxValue * 46;
      return `${center.toFixed(2)},${y.toFixed(2)}`;
    });
    if (linePoints.length > 1) {
      svg.insertBefore(makeSvg("polyline", {
        points: linePoints.join(" "),
        class: "desire-period-line"
      }), svg.children[1] || null);
    }
    svg.appendChild(makeSvg("line", {
      x1: left,
      y1: baseline,
      x2: timelineWidth,
      y2: baseline,
      class: "desire-value-rule"
    }));
    svg.dataset.density = periods.length ? (periods[0].end - periods[0].start + 1) * cellWidth2 >= 68 ? "full" : (periods[0].end - periods[0].start + 1) * cellWidth2 >= 42 ? "compact" : "minimal" : "minimal";
    const hoverLine = makeSvg("line", {
      x1: 0,
      y1: top,
      x2: 0,
      y2: chartHeightValue - phaseGap,
      class: "hover-line"
    });
    const hitArea = makeSvg("rect", {
      x: left,
      y: 0,
      width: timelineWidth,
      height: chartHeightValue,
      class: "desire-timeline-hit-area",
      fill: "none",
      "pointer-events": "all"
    });
    svg.append(hoverLine, hitArea);
    chartPanel.appendChild(svg);
    let selectedWeek = -1;
    let touchSelection = false;
    const selectWeekAtPointer = (event) => {
      const rect = svg.getBoundingClientRect();
      const rawIndex = Math.max(0, Math.min(
        data2.dates.length - 1,
        Math.round((event.clientX - rect.left - cellWidth2 / 2) / cellWidth2)
      ));
      const period = periods.find(({ start: start2, end: end2 }) => rawIndex >= start2 && rawIndex <= end2);
      if (!period) return;
      const { start, end, value, week } = period;
      setDatePreview(rawIndex);
      const x = left + start * cellWidth2;
      const anchor = x + (end - start + 1) * cellWidth2 / 2;
      const previewX = left + rawIndex * cellWidth2 + cellWidth2 / 2;
      if (selectedWeek !== week) {
        selectedWeek = week;
        selectedBand.setAttribute("x", x);
        selectedBand.setAttribute("width", Math.max(cellWidth2, (end - start + 1) * cellWidth2));
        selectedBand.setAttribute("visibility", "visible");
      }
      const date = data2.dates[start];
      tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)}\u2013${formatDate(data2.dates[end].date)}</div><div class="tooltip-line"><span>${translate(series.label)}</span><span class="tooltip-value">${countLabel(value)}</span></div>`;
      hoverLine.setAttribute("x1", previewX);
      hoverLine.setAttribute("x2", previewX);
      hoverLine.style.opacity = "1";
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + anchor * (rect.width / timelineWidth),
        horizontalGap: 48,
        flipVertically: false
      });
    };
    hitArea.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch") touchSelection = false;
      selectWeekAtPointer(event);
    });
    hitArea.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      touchSelection = true;
      selectWeekAtPointer(event);
    });
    hitArea.addEventListener("pointerleave", () => {
      if (touchSelection) return;
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      selectedBand.setAttribute("visibility", "hidden");
      selectedWeek = -1;
      setDatePreview(null);
    });
  };

  // js/group-renderer.js
  var baseHeightForGroup = (group, focusRowHeight) => {
    const isExpanded = group.title === "\u56F4\u5EA6";
    const isTextChart = ["text", "activity", "count-line"].includes(group.chartType);
    if (group.chartType === "sleep-band") return chartConfig.sleepChartHeight;
    if (isTextChart) return group.title === "\u6B32" ? chartConfig.desireChartHeight : chartConfig.textChartHeight;
    if (["\u8282\u6BB5\u8102\u80AA", "\u8282\u6BB5\u808C\u8089"].includes(group.title)) return Math.max(chartConfig.chartHeight, 264);
    return isExpanded ? focusRowHeight : chartConfig.chartHeight;
  };
  var getPhaseGap = () => {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap"));
    return Number.isFinite(value) && value > 0 ? value : chartConfig.phaseGap;
  };
  var averageSummaryValue = (series, group, data2) => {
    const values = data2.rangeMode === "day" ? series.values : series.summaryValues || [];
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    if (group.chartType === "sleep-band" && series.id !== "sleep-duration") {
      const clockValues = valid.map((value) => value < 18 ? value + 24 : value);
      return clockValues.reduce((sum, value) => sum + value, 0) / clockValues.length % 24;
    }
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  };
  var setSharedRowHeight = ({ sidebarRow, chartRow, label, axisPanel, chartPanel, baseHeight }) => {
    const phaseGap = getPhaseGap();
    const rowHeight = Math.ceil(Math.max(baseHeight + phaseGap * 2, label.scrollHeight));
    [sidebarRow, chartRow].forEach((row) => {
      row.style.height = `${rowHeight}px`;
      row.style.setProperty("--row-content-height", `${rowHeight}px`);
      row.style.setProperty("--phase-gap", `${phaseGap}px`);
    });
    axisPanel.style.height = `${rowHeight}px`;
    chartPanel.style.height = `${rowHeight}px`;
    return rowHeight;
  };
  var createGroupRow = ({
    group,
    data: data2,
    body: body2,
    sidebarBody: sidebarBody2,
    tooltip: tooltip2,
    cellWidth: cellWidth2,
    timelineWidth,
    showPoints: showPoints2,
    showAllValues: showAllValues2,
    focusRowHeight = chartConfig.expandedChartHeight,
    sleepBandAligned: sleepBandAligned2 = true,
    onSleepBandAlignedChange
  }) => {
    const isExpanded = group.title === "\u56F4\u5EA6";
    const isTextChart = ["text", "activity", "count-line"].includes(group.chartType);
    const isDesireChart = group.title === "\u6B32";
    const baseHeight = baseHeightForGroup(group, focusRowHeight);
    const sidebarRow = document.createElement("article");
    sidebarRow.className = "sidebar-section-row";
    sidebarRow.dataset.group = group.id;
    if (group.chartType === "sleep-band") sidebarRow.classList.add("sleep-section-row");
    if (isTextChart) sidebarRow.classList.add("text-section-row");
    if (isDesireChart) sidebarRow.classList.add("desire-section-row");
    const chartRow = document.createElement("article");
    chartRow.className = `section-row chart-section-row${isExpanded ? " expanded-chart-row" : ""}${isTextChart ? " text-section-row" : ""}${isDesireChart ? " desire-section-row" : ""}`;
    chartRow.dataset.group = group.id;
    const label = document.createElement("div");
    label.className = "label-panel";
    if (["\u80FD\u91CF\u6536\u652F", "\u8425\u517B\u7D20"].includes(group.title)) label.classList.add("summary-values-hidden");
    const groupAccent = group.series.find((series) => series.color)?.color || "#15766e";
    label.style.setProperty("--group-accent", groupAccent);
    chartRow.style.setProperty("--group-accent", groupAccent);
    sidebarRow.style.setProperty("--group-accent", groupAccent);
    const list = group.series.map((series) => {
      const deltaUnit = group.chartType === "sleep-band" && series.id === "sleep-duration" ? "\u5C0F\u65F6" : group.unit;
      const deltaValue = group.title === "\u6B32" ? null : seriesDelta(series, deltaUnit);
      const isBodyWeight = group.title === "\u8EAB\u4F53\u8D28\u91CF" && series.id === "body-weight";
      const cumulativeGain = data2.cumulativeGainSummaryValues?.at(-1);
      const bodyWeightDelta = isBodyWeight ? Number.isFinite(cumulativeGain) ? cumulativeGain : deltaValue : null;
      const isAverageSummary = group.title === "\u6B32" || group.title === "\u5FC3\u7387" || group.title === "\u7761\u7720\u65F6\u95F4\u5E26";
      const desireWeeklyMean = group.title === "\u6B32" ? (() => {
        const values = series.desireDailyValues || series.values;
        const starts = weekStarts(data2.dates);
        const weeklyCounts = starts.map((start, index) => {
          const end = (starts[index + 1] ?? data2.dates.length) - 1;
          return values.slice(start, end + 1).reduce((sum, value) => sum + (Number.isFinite(value) ? value : [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length), 0);
        });
        return weeklyCounts.length ? weeklyCounts.reduce((sum, value) => sum + value, 0) / weeklyCounts.length : 0;
      })() : null;
      const delta = isAverageSummary ? "" : isBodyWeight ? formatDelta(bodyWeightDelta, "kg") : formatDelta(deltaValue, deltaUnit);
      const deltaForColor = isBodyWeight ? bodyWeightDelta : deltaValue;
      const deltaClass = deltaForColor > 0 ? "is-positive" : deltaForColor < 0 ? "is-negative" : "is-neutral";
      const currentValue = group.title === "\u6B32" ? desireWeeklyMean : isAverageSummary ? averageSummaryValue(series, group, data2) : series.latestSummaryValues?.at(-1) ?? latestValue(series);
      const valueUnit = group.title === "\u6B32" ? `${group.unit}/\u5468` : group.chartType === "sleep-band" && series.id === "sleep-duration" ? "\u5C0F\u65F6" : group.unit;
      const current = formatValue(currentValue, valueUnit);
      const averageClass = isAverageSummary ? ` summary-average ${group.title === "\u5FC3\u7387" ? "summary-average-heart" : group.title === "\u6B32" ? "summary-average-desire" : "summary-average-sleep"}` : "";
      const averageMark = isAverageSummary ? `<span class="series-average-mark">${t("average")}</span>` : "";
      return `<li class="series-item"><span class="series-swatch" style="background:${series.color}"></span><span class="series-name">${translate(series.label)}</span><span class="series-values${averageClass}"><span class="series-current-value">${current}</span>${averageMark}${delta ? `<span class="series-change ${deltaClass}">${delta}</span>` : ""}</span></li>`;
    }).join("");
    const unitLabel = group.chartType === "sleep-band" ? "" : translateUnit(group.title === "\u6B32" ? `${group.unit}/\u5468` : group.unit);
    const sleepButton = group.chartType === "sleep-band" ? `<button class="sleep-alignment-toggle${sleepBandAligned2 ? "" : " is-active"}" type="button" data-sleep-alignment aria-pressed="${!sleepBandAligned2}" title="${t(sleepBandAligned2 ? "sleepAlignToActual" : "sleepAlignToDuration")}" aria-label="${t(sleepBandAligned2 ? "sleepAlignToActual" : "sleepAlignToDuration")}"><span class="sleep-align-icon" aria-hidden="true"><span></span><span></span></span></button>` : "";
    label.innerHTML = `<div class="label-title"><span class="label-title-name"><strong>${translate(group.title)}</strong>${unitLabel ? `<span class="unit-chip">${unitLabel}</span>` : ""}</span>${sleepButton}</div><ul class="series-list">${list}</ul>`;
    label.querySelector("[data-sleep-alignment]")?.addEventListener("click", () => {
      onSleepBandAlignedChange?.(!sleepBandAligned2);
    });
    const axisPanel = document.createElement("div");
    axisPanel.className = "axis-panel";
    const chartPanel = document.createElement("div");
    chartPanel.className = `chart-panel${isExpanded ? " expanded-chart-panel" : ""}${isTextChart ? " text-chart-panel" : " line-chart-panel"}${isDesireChart ? " desire-chart-panel" : ""}`;
    const contentHeight = setSharedRowHeight({
      sidebarRow,
      chartRow,
      label,
      axisPanel,
      chartPanel,
      baseHeight
    });
    sidebarRow.append(label, axisPanel);
    chartRow.append(chartPanel);
    sidebarBody2.appendChild(sidebarRow);
    body2.appendChild(chartRow);
    if (group.chartType === "sleep-band") {
      createSleepBandChart({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showAllValues: showAllValues2, aligned: sleepBandAligned2, chartHeight: contentHeight });
    } else if (group.chartType === "activity") {
      createTextTimeline({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, chartHeight: contentHeight });
    } else if (group.chartType === "count-line") {
      createDesireTimeline({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, chartHeight: contentHeight });
    } else if (group.chartType === "bar") {
      createBarChart({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showPoints: showPoints2, showAllValues: showAllValues2, chartHeight: contentHeight });
    } else {
      createLineChart({ group, data: data2, chartPanel, axisPanel, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showPoints: showPoints2, showAllValues: showAllValues2, chartHeight: contentHeight });
    }
    return { sidebarRow, chartRow };
  };

  // js/strength-training.js
  var formatWeight = (value) => {
    if (value === null || value === void 0) return "\u2014";
    return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  };
  var getTrainingDomain = (training) => {
    const values = training.flatMap((action) => action.values).map((entry) => entry?.maxWeight).filter((value) => Number.isFinite(value));
    if (!values.length) return { axisMin: 0, axisMax: 10, step: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const magnitude = 10 ** Math.floor(Math.log10(range / 5));
    const normalized = range / 5 / magnitude;
    const step = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
    const axisMin = Math.max(0, Math.floor(min / step) * step);
    const axisMax = Math.ceil(max / step) * step;
    return { axisMin, axisMax, step };
  };
  var renderTrainingAction = (action, entry) => {
    if (!entry) {
      return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div>`;
    }
    if (action.kind === "bodyweight") {
      const bodyweightLabel = getLanguage() === "zh" ? "\u81EA\u91CD" : "Bodyweight";
      return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div><div class="tooltip-line"><span>${t("maxReps")}</span><span class="tooltip-value">${entry.maxReps ?? "\u2014"}${entry.maxReps == null ? "" : "\u6B21"}</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${bodyweightLabel} \xD7 ${entry.maxReps ?? "\u2014"} \xD7 ${entry.setCount ?? "\u2014"}</span></div>`;
    }
    if (action.kind === "weighted-chin-up") {
      return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div><div class="tooltip-line"><span>${getLanguage() === "zh" ? "\u8D1F\u91CD" : "Load"}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg</span></div><div class="tooltip-line"><span>${t("maxReps")}</span><span class="tooltip-value">${entry.maxReps ?? "\u2014"}${entry.maxReps == null ? "" : "\u6B21"}</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg \xD7 ${entry.maxReps ?? "\u2014"} \xD7 ${entry.setCount ?? "\u2014"}</span></div>`;
    }
    return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span>${translate(action.label)}</div><div class="tooltip-line"><span>${t("maxWeight")}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${formatTrainingVolume(entry.totalVolume)} kg</span></div><div class="tooltip-line"><span>${t("formalSet")}</span><span class="tooltip-value">${formatTrainingSet(entry.formalSet)}</span></div>`;
  };
  var getTrainingCardWidths = (training) => {
    const measureHost = document.createElement("div");
    measureHost.className = "tooltip is-training-tooltip";
    measureHost.style.cssText = "position:absolute;left:-100000px;top:0;width:max-content;max-width:none;visibility:hidden;display:block;";
    document.body.appendChild(measureHost);
    const widths = /* @__PURE__ */ new Map();
    let emptyWidth = 0;
    training.forEach((action) => {
      const emptyCard = document.createElement("section");
      emptyCard.className = "tooltip-training-card is-empty";
      emptyCard.style.width = "max-content";
      emptyCard.style.display = "inline-block";
      emptyCard.innerHTML = renderTrainingAction(action, null);
      measureHost.appendChild(emptyCard);
      emptyWidth = Math.max(emptyWidth, emptyCard.getBoundingClientRect().width);
      emptyCard.remove();
      const entries = action.values.filter(Boolean);
      const width = entries.reduce((maximum, entry) => {
        const card = document.createElement("section");
        card.className = `tooltip-training-card${entry ? "" : " is-empty"}`;
        card.style.width = "max-content";
        card.style.display = "inline-block";
        card.innerHTML = renderTrainingAction(action, entry);
        measureHost.appendChild(card);
        const measuredWidth = card.getBoundingClientRect().width;
        card.remove();
        return Math.max(maximum, measuredWidth);
      }, 0);
      widths.set(action, Math.ceil(width));
    });
    measureHost.remove();
    widths.emptyWidth = Math.ceil(emptyWidth);
    return widths;
  };
  var getTrainingPanelWidth = (training, cardWidths) => {
    const findAction = (label) => training.find((action) => action.label === label);
    const rows = [
      [findAction("\u6DF1\u8E72")],
      [findAction("\u5367\u63A8"), findAction("\u63A8\u4E3E")],
      [findAction("\u786C\u62C9"), findAction("\u9AD8\u7FFB"), findAction("\u81EA\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A"), findAction("\u8D1F\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A")]
    ];
    return Math.max(...rows.map((actions) => {
      const visibleActions = actions.filter(Boolean);
      return visibleActions.reduce((total, action) => total + (cardWidths.get(action) || 0), 0) + Math.max(0, visibleActions.length - 1) * 8;
    }), 0);
  };
  var createTooltip = ({ tooltip: tooltip2, training, data: data2, index, cardWidths }) => {
    const date = data2.dates[index];
    const renderAction = (action) => {
      const entry = action.values[index];
      return renderTrainingAction(action, entry);
    };
    const findAction = (label) => training.find((action) => action.label === label);
    const bodyweightAction = findAction("\u81EA\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A");
    const weightedAction = findAction("\u8D1F\u91CD\u53CD\u624B\u5F15\u4F53\u5411\u4E0A");
    const renderCard = (actions, className = "") => {
      const visibleActions = actions.filter(Boolean);
      const isEmpty = visibleActions.length === 0 || visibleActions.every((action2) => !action2.values[index]);
      const action = visibleActions[0];
      const width = isEmpty ? cardWidths.emptyWidth : action ? cardWidths.get(action) : null;
      const widthStyle = width ? `min-width:${width}px` : "";
      return `<section class="tooltip-training-card${isEmpty ? " is-empty" : ""} ${className}"${widthStyle ? ` style="${widthStyle}"` : ""}>${visibleActions.map(renderAction).join("")}</section>`;
    };
    const sortActions = (actions) => [...actions].sort((left, right) => Number(Boolean(right?.values[index])) - Number(Boolean(left?.values[index])));
    const renderRow = (actions) => sortActions(actions).map((action) => renderCard([action])).join("");
    const alignedFirstColumnWidth = Math.max(
      cardWidths.get(findAction("\u5367\u63A8")) || 0,
      cardWidths.get(findAction("\u63A8\u4E3E")) || 0,
      cardWidths.get(findAction("\u786C\u62C9")) || 0,
      cardWidths.emptyWidth || 0
    );
    const getRowStyle = (actions, alignFirstColumn = false) => {
      const sortedActions = sortActions(actions);
      if (sortedActions.length === 1) return "grid-template-columns:minmax(0, 1fr)";
      return `grid-template-columns:${sortedActions.map((action, actionIndex) => {
        if (alignFirstColumn && actionIndex === 0) return `${alignedFirstColumnWidth}px`;
        return action.values[index] ? `${cardWidths.get(action)}px` : `minmax(${cardWidths.emptyWidth}px, 1fr)`;
      }).join(" ")}`;
    };
    tooltip2.style.width = `${getTrainingPanelWidth(training, cardWidths) + 32}px`;
    const squatActions = [findAction("\u6DF1\u8E72")];
    const pressActions = [findAction("\u5367\u63A8"), findAction("\u63A8\u4E3E")];
    const pullActions = [findAction("\u786C\u62C9"), findAction("\u9AD8\u7FFB"), bodyweightAction, weightedAction];
    tooltip2.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} \xB7 ${translateWeekday(date.weekday)}</div><div class="tooltip-training-grid${training.some((action) => !action.values[index]) ? " has-empty-actions" : ""}"><div class="tooltip-training-row tooltip-training-row-one" style="${getRowStyle(squatActions)}">${renderRow(squatActions)}</div><div class="tooltip-training-row tooltip-training-row-two" style="${getRowStyle(pressActions, true)}">${renderRow(pressActions)}</div><div class="tooltip-training-row tooltip-training-row-three" style="${getRowStyle(pullActions, true)}">${renderRow(pullActions)}</div></div>`;
    tooltip2.classList.add("is-training-tooltip");
    tooltip2.style.display = "block";
    const trainingGrid = tooltip2.querySelector(".tooltip-training-grid");
    trainingGrid.classList.remove("has-card-height");
    trainingGrid.style.removeProperty("--training-card-height");
    return () => {
      const cards = [...trainingGrid.querySelectorAll(".tooltip-training-card")];
      const previousCardHeights = cards.map((card) => card.style.height);
      cards.forEach((card) => {
        card.style.height = "auto";
      });
      const ordinaryCardHeight = Math.max(...cards.map((card) => card.getBoundingClientRect().height), 0);
      cards.forEach((card, index2) => {
        card.style.height = previousCardHeights[index2];
      });
      if (ordinaryCardHeight > 0) {
        trainingGrid.classList.add("has-card-height");
        trainingGrid.style.setProperty("--training-card-height", `${ordinaryCardHeight}px`);
      }
    };
  };
  var createTrainingRows = ({ training, data: data2, body: body2, sidebarBody: sidebarBody2, tooltip: tooltip2, cellWidth: cellWidth2, timelineWidth, showPoints: showPoints2, showAllValues: showAllValues2, focusRowHeight = chartConfig.trainingChartHeight }) => {
    const sidebarRow = document.createElement("article");
    sidebarRow.className = "sidebar-section-row training-section-row";
    const row = document.createElement("article");
    row.className = "section-row chart-section-row training-section-row training-combined-row";
    row.dataset.group = "strength-training";
    const label = document.createElement("div");
    label.className = "label-panel";
    const groupAccent = training.find((action) => action.color)?.color || "#15766e";
    label.style.setProperty("--group-accent", groupAccent);
    row.style.setProperty("--group-accent", groupAccent);
    label.innerHTML = `<div class="label-title"><span class="label-title-name"><strong>${t("strengthTraining")}</strong><span class="unit-chip">kg</span></span></div><ul class="series-list training-action-list">${training.map((action) => {
      const deltaValue = trainingDelta(action, data2);
      const deltaUnit = action.kind === "bodyweight" ? "\u6B21" : "kg";
      const isBodyweight = action.kind === "bodyweight";
      const hasBodyweightRecord = action.values.some(Boolean) || Boolean(action.summaryValues?.some(Boolean));
      const delta = isBodyweight ? hasBodyweightRecord ? getLanguage() === "zh" ? "\u81EA\u91CD" : "Bodyweight" : "" : formatDelta(deltaValue, deltaUnit);
      const deltaClass = isBodyweight ? "is-bodyweight" : deltaValue > 0 ? "is-positive" : deltaValue < 0 ? "is-negative" : "is-neutral";
      return `<li class="series-item"><span class="series-swatch" style="background:${action.color}"></span><span class="series-name">${translate(action.label)}</span><span class="series-values"><span class="series-current-value">${formatTrainingMax(action, data2)}</span>${delta ? `<span class="series-change ${deltaClass}">${delta}</span>` : ""}</span></li>`;
    }).join("")}</ul>`;
    const axisPanel = document.createElement("div");
    axisPanel.className = "axis-panel";
    const chartPanel = document.createElement("div");
    chartPanel.className = "chart-panel training-chart-panel training-combined-panel";
    const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
    const rowHeight = Math.ceil(Math.max(focusRowHeight + phaseGap * 2, label.scrollHeight));
    sidebarRow.style.height = `${rowHeight}px`;
    row.style.height = `${rowHeight}px`;
    sidebarRow.style.setProperty("--phase-gap", `${phaseGap}px`);
    row.style.setProperty("--phase-gap", `${phaseGap}px`);
    chartPanel.style.height = `${rowHeight}px`;
    axisPanel.style.height = `${rowHeight}px`;
    sidebarRow.append(label, axisPanel);
    row.append(chartPanel);
    sidebarBody2.appendChild(sidebarRow);
    body2.appendChild(row);
    const trainingMargin = { ...chartConfig.trainingMargin, top: phaseGap, bottom: phaseGap };
    const trainingChartHeight = rowHeight;
    const plotHeight = trainingChartHeight - trainingMargin.top - trainingMargin.bottom;
    const { axisMin, axisMax, step } = getTrainingDomain(training);
    const xScale = (index) => index * cellWidth2 + cellWidth2 / 2;
    const yScale = (value) => trainingMargin.top + (axisMax - value) / (axisMax - axisMin) * plotHeight;
    const valueLabelY = (value) => Math.max(trainingMargin.top + 12, Math.min(trainingChartHeight - trainingMargin.bottom - 4, yScale(value) - 8));
    const svg = makeSvg("svg", { viewBox: `0 0 ${timelineWidth} ${trainingChartHeight}`, "aria-label": t("strengthChart") });
    const axisTicks = [];
    for (let value = axisMin; value <= axisMax; value += step) {
      const y = yScale(value);
      const line = makeSvg("line", { x1: 0, y1: y, x2: timelineWidth, y2: y, class: "axis-line" });
      append(svg, line);
      axisTicks.push(value);
    }
    renderAxis({ axisPanel, height: trainingChartHeight, top: trainingMargin.top, bottom: trainingMargin.bottom, ticks: axisTicks, min: axisMin, max: axisMax, classes: "training-axis-label", format: formatWeight });
    phaseStarts(data2).forEach((start) => {
      const x = start * cellWidth2;
      svg.appendChild(makeSvg("line", { x1: x, y1: trainingMargin.top, x2: x, y2: trainingChartHeight - trainingMargin.bottom, class: "phase-divider" }));
    });
    const seriesNodes = [];
    const dataIndexes = training.reduce((indexes, action) => {
      action.values.forEach((entry, index) => {
        if (entry && !indexes.includes(index)) indexes.push(index);
      });
      return indexes;
    }, []).sort((left, right) => left - right);
    const nearestDataIndex = (rawIndex) => dataIndexes.length ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0]) : rawIndex;
    training.forEach((action) => {
      let path = "";
      let started = false;
      action.values.forEach((entry, index) => {
        if (!Number.isFinite(entry?.maxWeight)) return;
        path += `${started ? "L" : "M"} ${xScale(index).toFixed(2)} ${yScale(entry.maxWeight).toFixed(2)} `;
        started = true;
      });
      const pathNode = makeSvg("path", { d: path.trim(), class: "series-path", stroke: action.color });
      svg.appendChild(pathNode);
      const pointNodes = [];
      const valueNodes = [];
      action.values.forEach((entry, index) => {
        if (!Number.isFinite(entry?.maxWeight)) return;
        const point = makeSvg("circle", { cx: xScale(index), cy: yScale(entry.maxWeight), r: 3.5, fill: action.color, class: "series-point" });
        const value = makeSvg("text", { x: xScale(index), y: valueLabelY(entry.maxWeight), fill: action.color, class: "training-value-label", "text-anchor": "middle" });
        value.textContent = formatWeight(entry.maxWeight);
        svg.append(point, value);
        pointNodes.push(point);
        valueNodes.push(value);
      });
      seriesNodes.push({ pathNodes: [pathNode], pointNodes, valueNodes });
    });
    const hoverLine = makeSvg("line", { x1: 0, y1: trainingMargin.top, x2: 0, y2: trainingChartHeight - trainingMargin.bottom, class: "hover-line" });
    const hitArea = makeSvg("rect", { x: 0, y: trainingMargin.top, width: timelineWidth, height: plotHeight, class: "chart-hit-area" });
    append(svg, hoverLine, hitArea);
    chartPanel.appendChild(svg);
    const cardWidths = getTrainingCardWidths(training);
    hitArea.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const rawIndex = Math.max(0, Math.min(data2.dates.length - 1, Math.round((localX - cellWidth2 / 2) / cellWidth2)));
      const index = nearestDataIndex(rawIndex);
      setDatePreview(index);
      const prepareTrainingTooltip = createTooltip({ tooltip: tooltip2, training, data: data2, index, cardWidths });
      const x = xScale(index);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.opacity = "1";
      positionTooltipBeside({
        tooltip: tooltip2,
        event,
        anchorX: rect.left + x * (rect.width / timelineWidth),
        flipVertically: false,
        prepareLayout: prepareTrainingTooltip
      });
    });
    hitArea.addEventListener("pointerleave", () => {
      tooltip2.style.display = "none";
      hoverLine.style.opacity = "0";
      setDatePreview(null);
    });
    const updateVisibility = () => {
      seriesNodes.forEach(({ pathNodes, pointNodes, valueNodes }) => {
        pathNodes.forEach((path) => {
          path.style.display = showPoints2.checked ? "none" : "";
        });
        pointNodes.forEach((point) => {
          point.style.display = showPoints2.checked ? "" : "none";
        });
        valueNodes.forEach((value) => {
          value.style.display = showAllValues2.checked ? "" : "none";
        });
      });
    };
    updateVisibility();
  };

  // js/timeline-header.js
  var textWidth = (text, font, letterSpacing) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = font;
    return context.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
  };
  var renderTimelineHeader = ({ data: data2, monthTrack: monthTrack2, weekTrack: weekTrack2, phaseTrack: phaseTrack2, dateTrack: dateTrack2 }) => {
    const hasDateValue = (index) => data2.groups.some((group) => group.series?.some((series) => series.values?.[index] != null)) || data2.training.some((action) => action.values?.[index] != null);
    const monthGroups = /* @__PURE__ */ new Map();
    data2.dates.forEach((item, index) => {
      const key = item.date.slice(0, 7);
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key).push(index);
    });
    monthGroups.forEach((indexes, key) => {
      const monthEl = document.createElement("div");
      monthEl.className = "month-cell";
      monthEl.dataset.start = indexes[0];
      monthEl.dataset.end = indexes.at(-1);
      monthEl.style.gridColumn = `${indexes[0] + 1} / ${indexes.at(-1) + 2}`;
      monthEl.textContent = t("monthLabel", Number(key.slice(5)));
      monthTrack2.appendChild(monthEl);
    });
    const starts = weekStarts(data2.dates);
    starts.map((start, index) => ({
      start,
      end: (starts[index + 1] ?? data2.dates.length) - 1,
      index
    })).forEach(({ start, end, index }) => {
      const weekEl = document.createElement("div");
      weekEl.className = "week-cell";
      weekEl.dataset.start = start;
      weekEl.dataset.end = end;
      weekEl.style.gridColumn = `${start + 1} / ${end + 2}`;
      const weekLabel = t("weekLabel", index + 1);
      const weekNumber = String(index + 1);
      const [prefix, suffix = ""] = weekLabel.split(weekNumber);
      weekEl.innerHTML = `<span class="week-prefix">${prefix}</span><span class="week-number">${weekNumber}</span><span class="week-suffix">${suffix}</span>`;
      weekTrack2.appendChild(weekEl);
    });
    (data2.phaseCells || data2.phases).forEach((phase) => {
      const phaseEl = document.createElement("div");
      phaseEl.className = "phase-cell";
      phaseEl.dataset.start = phase.start;
      phaseEl.dataset.end = phase.end;
      phaseEl.style.gridColumn = `${phase.start + 1} / ${phase.end + 2}`;
      phaseEl.style.background = phase.background || phase.color;
      const phaseTitle = translatePhaseTitle(phase.title);
      phaseEl.title = phaseTitle;
      phaseEl.setAttribute("aria-label", phaseTitle);
      const phaseNumber = String(phase.title).match(/^\s*(\d+)\s*[.、：:]/)?.[1] || "";
      const numberEl = document.createElement("span");
      numberEl.className = "phase-number";
      numberEl.textContent = phaseNumber;
      const titleEl = document.createElement("span");
      titleEl.className = "phase-title";
      titleEl.textContent = phaseTitle;
      phaseEl.append(numberEl, titleEl);
      phaseTrack2.appendChild(phaseEl);
      const phaseWidth = phaseEl.getBoundingClientRect().width;
      const phaseStyle = getComputedStyle(phaseEl);
      const horizontalPadding = Number.parseFloat(phaseStyle.paddingLeft) + Number.parseFloat(phaseStyle.paddingRight);
      const letterSpacing = Number.parseFloat(phaseStyle.letterSpacing) || 0;
      const titleWidth = textWidth(phaseTitle, phaseStyle.font, letterSpacing);
      phaseEl.classList.toggle("has-title", phaseWidth >= titleWidth + horizontalPadding + 2);
    });
    data2.dates.forEach((item, index) => {
      const cell = document.createElement("div");
      cell.className = "date-cell";
      if (!hasDateValue(index)) cell.classList.add("is-empty-day");
      cell.dataset.start = index;
      cell.dataset.end = index;
      cell.dataset.dateLabel = formatDate(item.date);
      if (item.date === data2.currentDate || item.isCurrent) cell.classList.add("is-today");
      if (item.date === data2.currentDate) cell.dataset.currentDate = "true";
      cell.innerHTML = `<span class="date-label">${item.date.slice(-2)}</span>`;
      dateTrack2.appendChild(cell);
    });
  };

  // js/visual-palette.js
  var seriesPalette = [
    "#708f82",
    "#778fa6",
    "#b18488",
    "#b09268",
    "#9185a1",
    "#6f9699",
    "#92986f",
    "#b17f65",
    "#7893a0",
    "#a27d91"
  ];
  var phasePalette = [
    "#b8c9c1",
    "#b7c7d3",
    "#cdbdc6",
    "#d2c3b6",
    "#c7cbae",
    "#c4bdd0",
    "#b6c9c4",
    "#cfbeb3"
  ];
  var trainingPalette = {
    squat: "#778fa6",
    "overhead-press": "#b18488",
    clean: "#708f82",
    "bench-press": "#9185a1",
    deadlift: "#b09268",
    "chin-up": "#6f9699",
    "weighted-chin-up": "#92986f"
  };

  // js/app.js
  var data = window.fitnessData;
  var root = document.documentElement;
  var appShell = document.querySelector(".app-shell");
  var viewport = document.getElementById("sheetViewport");
  var timelineViewport = viewport;
  var body = document.getElementById("sheetBody");
  var sidebarBody = document.getElementById("sidebarBody");
  var timelineHeader = document.getElementById("timelineHeader");
  var monthTrack = document.getElementById("monthTrack");
  var phaseTrack = document.getElementById("phaseTrack");
  var dateTrack = document.getElementById("dateTrack");
  var weekTrack = document.getElementById("weekTrack");
  var dateRangeFilter = document.getElementById("dateRangeFilter");
  var rangeButtons = [...dateRangeFilter.querySelectorAll("[data-range]")];
  var timelineZoom = document.getElementById("timelineZoom");
  var timelineZoomValue = document.getElementById("timelineZoomValue");
  var showPoints = document.getElementById("showPoints") || {
    checked: false,
    addEventListener() {
    },
    setAttribute() {
    }
  };
  var showAllValues = document.getElementById("showAllValues") || {
    checked: false,
    addEventListener() {
    },
    setAttribute() {
    }
  };
  var tooltip = document.getElementById("tooltip");
  var dataLoadStatus = document.getElementById("dataLoadStatus");
  var dateRange = document.getElementById("dateRange");
  var dataSummary = document.getElementById("dataSummary");
  var metricCorner = document.getElementById("metricCorner");
  var languageSwitch = document.getElementById("languageSwitch");
  var languageButtons = [...document.querySelectorAll("[data-language]")];
  var strengthFilterNavigation = document.getElementById("strengthFilterNavigation");
  var strengthFilterButtons = [...document.querySelectorAll("[data-strength-filter]")];
  var sourceDataView = document.getElementById("sourceDataView");
  var trainingEmbeddedView = document.getElementById("trainingEmbeddedView");
  var trainingFrame = document.getElementById("trainingFrame");
  var sourceSheetViewport = document.getElementById("sourceSheetViewport");
  var sourceQuantificationDocument = document.getElementById("sourceQuantificationDocument");
  var sourceDietDocument = document.getElementById("sourceDietDocument");
  var sourceSheetTabs = [...document.querySelectorAll("[data-source-sheet]")];
  var siteEntryButtons = [...document.querySelectorAll("[data-site-entry]")];
  var sourceDownloadButton = document.querySelector(".source-download-button");
  var baseCellWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--cell-width"));
  var cellWidth = baseCellWidth;
  var previousCellWidth = baseCellWidth;
  var zoomPercent = Number(timelineZoom.value || 100);
  var appliedZoom = zoomPercent;
  var RANGE_PRESETS = { day: 100, week: 65, month: 35 };
  var ZOOM_STORAGE_KEY = "whatsup.bio.timeline-zoom.v2";
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 100;
  var WHEEL_ZOOM_SENSITIVITY = 0.022;
  var GESTURE_ZOOM_GAIN = 4;
  var POINTER_PINCH_ZOOM_GAIN = 4;
  var FOCUS_ROW_MIN_HEIGHT = 320;
  var FOCUS_ROW_VISIBLE_RATIO = 0.95;
  var SCROLL_FIT_TOLERANCE = 12;
  var GROUP_DISPLAY_ORDER = [
    "\u8EAB\u4F53\u8D28\u91CF",
    "\u7761\u7720\u65F6\u95F4\u5E26",
    "\u80FD\u91CF\u6536\u652F",
    "\u8425\u517B\u7D20",
    "\u56F4\u5EA6",
    "\u4F53\u8102\u7387",
    "BMI",
    "\u4EBA\u4F53\u6210\u5206",
    "\u8282\u6BB5\u8102\u80AA",
    "\u8282\u6BB5\u808C\u8089",
    "\u5FC3\u7387",
    "\u6B32"
  ];
  var groupDisplayOrder = new Map(GROUP_DISPLAY_ORDER.map((title, index) => [title, index]));
  root.style.setProperty("--chart-height", `${chartConfig.chartHeight}px`);
  var getLocalIsoDate = () => {
    const today = /* @__PURE__ */ new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");
  };
  var createVisibleData = (source) => {
    const currentDate = getLocalIsoDate();
    const visibleCount = source.dates.findIndex((item) => item.date > currentDate);
    const dateCount = visibleCount < 0 ? source.dates.length : visibleCount;
    const dates = source.dates.slice(0, dateCount);
    const lastVisibleIndex = dates.length - 1;
    const cumulativeGainValues = source.groups.find((group) => group.title === "\u7D2F\u8BA1\u589E\u91CD")?.series[0]?.values.slice(0, dateCount) || [];
    return {
      ...source,
      currentDate: dates.find((item) => item.date === currentDate)?.date || dates.at(-1)?.date || currentDate,
      dates,
      cumulativeGainValues,
      phases: source.phases.filter((phase) => phase.start <= lastVisibleIndex && phase.end >= 0).map((phase, index) => ({
        ...phase,
        end: Math.min(phase.end, lastVisibleIndex),
        color: phasePalette[index % phasePalette.length]
      })),
      groups: source.groups.filter((group) => !["\u7D2F\u8BA1\u589E\u91CD", "\u589E\u91CD\u901F\u5EA6", "\u8DD1\u6B65"].includes(group.title)).map((group) => ({
        ...group,
        chartType: group.title === "\u6B32" ? "count-line" : group.chartType,
        series: group.series.filter((series) => !(group.title === "\u80FD\u91CF\u6536\u652F" && ["baseline-calories", "aerobic-calories", "strength-calories"].includes(series.id)) && series.id !== "aerobic-heart-rate").map((series) => ({
          ...series,
          color: group.title === "\u7761\u7720\u65F6\u95F4\u5E26" ? "#708eaf" : seriesPalette[group.series.indexOf(series) % seriesPalette.length],
          values: series.values.slice(0, dateCount)
        }))
      })).filter((group) => group.series.length > 0 && group.series.some((series) => series.values.some((value) => value !== null && value !== void 0))),
      training: source.training.map((action) => ({
        ...action,
        color: trainingPalette[action.id] || action.color,
        values: action.values.slice(0, dateCount)
      }))
    };
  };
  var visibleData = createVisibleData(data);
  try {
    sessionStorage.setItem("whatsup.bio.visible-days.v1", JSON.stringify({
      count: visibleData.dates.length,
      date: getLocalIsoDate()
    }));
  } catch (error) {
    console.warn("[fitness-summary] cache write failed", error);
  }
  var displayData = visibleData;
  var sleepBandAligned = true;
  var focusSnapTimer = null;
  var isFocusSnapping = false;
  var setSleepBandAligned = (aligned) => {
    sleepBandAligned = Boolean(aligned);
    renderGroups({ preserveScroll: true });
  };
  var latestValue2 = (item) => {
    const values = item.values || [];
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (value !== null && value !== void 0) {
        return typeof value === "object" ? value.maxWeight ?? value.maxReps ?? Number.NEGATIVE_INFINITY : value;
      }
    }
    return Number.NEGATIVE_INFINITY;
  };
  var sortByChartPosition = (items) => items.map((item, index) => ({ item, index })).sort((left, right) => {
    const leftValue = latestValue2(left.item);
    const rightValue = latestValue2(right.item);
    if (leftValue === rightValue) return left.index - right.index;
    if (leftValue === Number.NEGATIVE_INFINITY) return 1;
    if (rightValue === Number.NEGATIVE_INFINITY) return -1;
    return rightValue - leftValue;
  }).map(({ item }) => item);
  var syncFocusRowHeight = () => {
    const headerHeight = timelineHeader.getBoundingClientRect().height;
    const availableHeight = Math.floor(viewport.clientHeight - headerHeight);
    const focusRowHeight = Math.max(FOCUS_ROW_MIN_HEIGHT, availableHeight);
    root.style.setProperty("--focus-row-height", `${focusRowHeight}px`);
    return focusRowHeight;
  };
  var getSidebarWidth = () => {
    const sidebar = document.getElementById("sheetSidebar");
    const width = sidebar?.getBoundingClientRect().width || 0;
    return Number.isFinite(width) && width > 0 ? width : 0;
  };
  var syncPhaseGap = () => {
    const phaseHeight = phaseTrack.getBoundingClientRect().height;
    const phaseGap = Math.max(1, Math.round(phaseHeight / 2));
    root.style.setProperty("--phase-gap", `${phaseGap}px`);
    return phaseGap;
  };
  var refreshTimeline = () => {
    const mode = dateRangeFilter.dataset.value || "day";
    displayData = createDisplayData(visibleData, mode);
    const orderedGroups = displayData.groups.map((group, index) => ({ group, index })).sort((left, right) => {
      const leftOrder = groupDisplayOrder.get(left.group.title) ?? GROUP_DISPLAY_ORDER.length;
      const rightOrder = groupDisplayOrder.get(right.group.title) ?? GROUP_DISPLAY_ORDER.length;
      return leftOrder - rightOrder || left.index - right.index;
    }).map(({ group }) => group);
    displayData = {
      ...displayData,
      groups: orderedGroups.map((group) => ({
        ...group,
        series: group.chartType === "sleep-band" ? group.series : sortByChartPosition(group.series)
      })),
      training: sortByChartPosition(displayData.training)
    };
    root.style.setProperty("--header-height", "117px");
    syncFocusRowHeight();
    const zoom = zoomPercent / 100;
    const minimumCellWidth = 1;
    cellWidth = Math.max(minimumCellWidth, baseCellWidth * zoom);
    appliedZoom = zoomPercent;
    root.dataset.gridDensity = cellWidth >= 28 ? "full" : cellWidth >= 14 ? "weekly" : cellWidth >= 6 ? "phase" : "none";
    root.style.setProperty("--cell-width", `${cellWidth}px`);
    const timeline = createTimelineConfig(displayData.dates.length, cellWidth);
    root.style.setProperty("--axis-offset", `${timeline.axisWidth}px`);
    root.style.setProperty("--timeline-right-offset", `${timeline.rightOffset}px`);
    root.style.setProperty("--timeline-width", `${timeline.timelineWidth}px`);
    root.style.setProperty("--date-count", displayData.dates.length);
    phaseTrack.innerHTML = "";
    monthTrack.innerHTML = "";
    dateTrack.innerHTML = "";
    weekTrack.innerHTML = "";
    dateTrack.dataset.density = cellWidth < 12 ? "tiny" : cellWidth < 34 ? "compact" : cellWidth < 48 ? "small" : "normal";
    const rangeStart = displayData.rangeStart || displayData.dates[0].date;
    const rangeEnd = displayData.rangeEnd || displayData.dates.at(-1).date;
    dateRange.textContent = `${formatDate(rangeStart)} \u2014 ${formatDate(rangeEnd)}`;
    dataSummary.textContent = t("dataSummary", visibleData.dates.length);
    const zoomLabel = `${Math.round(zoomPercent)}`;
    timelineZoomValue.value = `${zoomLabel}%`;
    timelineZoomValue.textContent = `${zoomLabel}%`;
    renderTimelineHeader({ data: displayData, monthTrack, weekTrack, phaseTrack, dateTrack });
    syncPhaseGap();
    previousCellWidth = cellWidth;
  };
  var clearTimelineHeaderHover = () => {
    timelineHeader.querySelectorAll(".is-hovered").forEach((element) => element.classList.remove("is-hovered"));
  };
  var setTimelineHeaderSelection = (index) => {
    clearTimelineHeaderHover();
    if (!Number.isInteger(index) || index < 0 || index >= displayData.dates.length) return;
    timelineHeader.querySelectorAll("[data-start][data-end]").forEach((element) => {
      if (index >= Number(element.dataset.start) && index <= Number(element.dataset.end)) {
        element.classList.add("is-hovered");
      }
    });
  };
  var focusSnapSuppressedUntil = 0;
  var preserveViewportScroll = () => ({
    left: timelineViewport.scrollLeft,
    top: viewport.scrollTop
  });
  var restoreViewportScroll = ({ left, top }) => {
    const restore = () => {
      timelineViewport.scrollLeft = left;
      viewport.scrollTop = top;
    };
    restore();
    requestAnimationFrame(restore);
  };
  var renderGroups = ({ preserveScroll = false } = {}) => {
    const scroll = preserveScroll ? preserveViewportScroll() : null;
    if (preserveScroll) {
      focusSnapSuppressedUntil = performance.now() + 500;
      if (focusSnapTimer !== null) window.clearTimeout(focusSnapTimer);
      focusSnapTimer = null;
    }
    body.innerHTML = "";
    sidebarBody.innerHTML = "";
    const timelineWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--timeline-width"));
    const focusRowHeight = syncFocusRowHeight();
    const bodyMassGroup = displayData.groups.find((group) => group.title === "\u8EAB\u4F53\u8D28\u91CF");
    const sleepGroup = displayData.groups.find((group) => group.title === "\u7761\u7720\u65F6\u95F4\u5E26");
    root.classList.toggle("show-points-mode", showPoints.checked);
    if (bodyMassGroup) createGroupRow({ group: bodyMassGroup, data: displayData, body, sidebarBody, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, focusRowHeight });
    createTrainingRows({ training: displayData.training, data: displayData, body, sidebarBody, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, focusRowHeight });
    if (sleepGroup) createGroupRow({
      group: sleepGroup,
      data: displayData,
      body,
      sidebarBody,
      tooltip,
      cellWidth,
      timelineWidth,
      showPoints,
      showAllValues,
      focusRowHeight,
      sleepBandAligned,
      onSleepBandAlignedChange: setSleepBandAligned
    });
    displayData.groups.filter((group) => group !== bodyMassGroup && group !== sleepGroup).forEach((group) => createGroupRow({ group, data: displayData, body, sidebarBody, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, focusRowHeight }));
    if (scroll) restoreViewportScroll(scroll);
  };
  var locateCurrentDate = () => {
    const index = displayData.dates.findIndex((item) => item.date === displayData.currentDate);
    if (index < 0) return;
    const maxScrollLeft = Math.max(0, timelineViewport.scrollWidth - timelineViewport.clientWidth);
    if (maxScrollLeft <= SCROLL_FIT_TOLERANCE) {
      timelineViewport.scrollLeft = 0;
      return;
    }
    const sidebarWidth = getSidebarWidth();
    timelineViewport.scrollTo({ left: Math.max(0, sidebarWidth + index * cellWidth - 260), behavior: "smooth" });
  };
  var modeForZoom = (zoomPercent2) => zoomPercent2 >= 80 ? "day" : "week";
  var getInitialZoom = () => {
    const dateCount = Math.max(1, displayData?.dates?.length || visibleData.dates.length);
    const sidebarWidth = getSidebarWidth();
    const viewportWidth = Math.min(timelineViewport.clientWidth, root.clientWidth || timelineViewport.clientWidth);
    const availableWidth = Math.max(1, viewportWidth - sidebarWidth);
    const fitPercent = availableWidth / (dateCount * baseCellWidth) * 100;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitPercent));
  };
  var syncRangeButtons = (mode) => {
    dateRangeFilter.dataset.value = mode;
    rangeButtons.forEach((button) => {
      const active = button.dataset.range === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  var setRange = (mode) => {
    const nextZoom = RANGE_PRESETS[mode];
    if (nextZoom === void 0) return;
    syncRangeButtons(mode);
    setZoom(nextZoom, captureScrollAnchor());
  };
  var setZoom = (value, anchor = null, interactive = false) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    if (Math.abs(nextZoom - zoomPercent) < 1e-3) return false;
    const scroll = preserveViewportScroll();
    focusSnapSuppressedUntil = performance.now() + 500;
    if (focusSnapTimer !== null) window.clearTimeout(focusSnapTimer);
    focusSnapTimer = null;
    zoomPercent = nextZoom;
    try {
      sessionStorage.setItem(ZOOM_STORAGE_KEY, String(nextZoom));
    } catch (error) {
      console.warn("[fitness-zoom] cache write failed", error);
    }
    timelineZoom.value = String(nextZoom);
    refreshTimeline();
    renderGroups({ preserveScroll: true });
    const restoreZoomViewport = () => {
      viewport.scrollTop = scroll.top;
      if (anchor === null) locateCurrentDate();
      else restoreScrollAnchor(anchor);
    };
    restoreZoomViewport();
    requestAnimationFrame(restoreZoomViewport);
    return true;
  };
  var captureScrollAnchorAt = (clientX) => {
    const rect = timelineViewport.getBoundingClientRect();
    const contentX = timelineViewport.scrollLeft + clientX - rect.left;
    return {
      index: Math.max(0, (contentX - getSidebarWidth() - previousCellWidth / 2) / previousCellWidth),
      viewportX: clientX - rect.left
    };
  };
  var captureScrollAnchor = () => {
    const sidebarWidth = getSidebarWidth();
    const viewportCenter = timelineViewport.scrollLeft + timelineViewport.clientWidth / 2;
    return {
      index: Math.max(0, (viewportCenter - sidebarWidth - previousCellWidth / 2) / previousCellWidth),
      viewportX: timelineViewport.clientWidth / 2
    };
  };
  var restoreScrollAnchor = (anchor) => {
    const normalized = typeof anchor === "number" ? { index: anchor, viewportX: timelineViewport.clientWidth / 2 } : anchor;
    const sidebarWidth = getSidebarWidth();
    const target = sidebarWidth + normalized.index * cellWidth + cellWidth / 2 - normalized.viewportX;
    timelineViewport.scrollLeft = Math.max(0, Math.min(timelineViewport.scrollWidth - timelineViewport.clientWidth, target));
  };
  var focusRows = () => [...body.querySelectorAll(".expanded-chart-row, .training-combined-row")];
  var sourceDocuments = /* @__PURE__ */ new Map([
    ["\u91CF\u5316", sourceQuantificationDocument],
    ["\u996E\u98DF\u8BB0\u5F55", sourceDietDocument]
  ]);
  var sourceSheetPaths = {
    \u91CF\u5316: "/excel-preview/sheets/quantification.html",
    \u996E\u98DF\u8BB0\u5F55: "/excel-preview/sheets/diet.html"
  };
  var sourceRouteBySheet = {
    \u91CF\u5316: "/source-data/metrics",
    \u996E\u98DF\u8BB0\u5F55: "/source-data/diet"
  };
  var trainingRoute = "/training/";
  var trainingDocumentUrl = `/training/index.html?embedded=1&build=20261021-nav-load-fix-v1`;
  var selectedStrengthFilter = "all";
  var normalizeRoutePath = () => window.location.pathname.replace(/\/+$/, "") || "/";
  var isTrainingRoute = () => normalizeRoutePath() === "/training";
  var sourceSheetFromRoute = () => {
    const path = normalizeRoutePath();
    if (path === "/source-data/diet") return "\u996E\u98DF\u8BB0\u5F55";
    if (path === "/source-data/metrics") return "\u91CF\u5316";
    return null;
  };
  var isSourceRoute = () => sourceSheetFromRoute() !== null;
  var sourceActiveSheet = sourceSheetFromRoute() || "\u91CF\u5316";
  var sourceLoadedVersion = "";
  var sourceLoadedSheets = /* @__PURE__ */ new Set();
  var sourcePanState = null;
  var sourceLoadPromises = /* @__PURE__ */ new Map();
  var SOURCE_CACHE_NAME = "whatsup.bio.source-sheets.v3";
  var renderedViewportWidth = viewport.clientWidth;
  var clearLegacySourceStorage = () => {
    const legacyPrefix = "whatsup.bio.source-sheets.v2:";
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(legacyPrefix)) sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn("[fitness-source] legacy cache cleanup failed", error);
    }
  };
  var pruneSourceCache = async (version) => {
    if (!("caches" in window)) return;
    try {
      const cache = await window.caches.open(SOURCE_CACHE_NAME);
      const requests = await cache.keys();
      await Promise.all(requests.filter((request) => new URL(request.url).searchParams.get("v") !== version).map((request) => cache.delete(request)));
    } catch (error) {
      console.warn("[fitness-source] persistent cache cleanup failed", error);
    }
  };
  clearLegacySourceStorage();
  var syncLanguageButtons = () => {
    languageButtons.forEach((button) => {
      const active = button.dataset.language === getLanguage();
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  var syncStaticText = () => {
    document.title = t("appTitle");
    document.querySelector(".brand-block h1 img")?.setAttribute("alt", t("logoAlt"));
    metricCorner.textContent = t("metric");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelector(".topbar-controls")?.setAttribute("aria-label", t("filterAria"));
    dateRangeFilter.setAttribute("aria-label", t("dateRange"));
    strengthFilterNavigation?.setAttribute("aria-label", t("strengthFilterAria"));
    strengthFilterButtons.forEach((button) => {
      const filter = button.dataset.strengthFilter;
      button.textContent = filter === "all" ? getLanguage() === "zh" ? "\u5168\u90E8" : "All" : translate(filter);
    });
    showPoints.setAttribute("aria-label", t("showPoints"));
    showAllValues.setAttribute("aria-label", t("showValues"));
    timelineZoom.setAttribute("aria-label", t("zoom"));
    viewport.setAttribute("aria-label", t("trendAria"));
    sourceDataView.setAttribute("aria-label", t("sourceDataAria"));
    sourceDownloadButton?.setAttribute("title", t("sourceDownloadTitle"));
    sourceDownloadButton?.setAttribute("aria-label", t("sourceDownloadTitle"));
    dateRange.setAttribute("title", t("locateToday"));
    dateRange.setAttribute("aria-label", t("locateToday"));
    sourceSheetTabs.forEach((tab) => {
      tab.textContent = translate(tab.dataset.sourceSheet);
    });
    syncLanguageButtons();
  };
  var setDataLoadStatus = (message, state = "loading") => {
    if (!dataLoadStatus) return;
    dataLoadStatus.textContent = message;
    dataLoadStatus.dataset.state = state;
    dataLoadStatus.hidden = !message;
  };
  var preserveSourceColumnWidths = (container) => {
    container.querySelectorAll("table").forEach((table) => {
      const width = [...table.querySelectorAll("col")].reduce(
        (total, column) => total + Number.parseFloat(column.style.width || 0),
        0
      );
      if (width > 0) table.style.width = `${width}px`;
    });
  };
  var applySourceFreezePanes = (container) => {
    container.querySelectorAll("table").forEach((table) => {
      const frozenColumns = Number.parseInt(table.dataset.freezeCols || "0", 10);
      const frozenRows = Number.parseInt(table.dataset.freezeRows || "0", 10);
      if (!frozenColumns && !frozenRows) return;
      const rows = [...table.rows];
      const columns = [...table.querySelectorAll("col")];
      const rowOffsets = [0];
      rows.forEach((row) => rowOffsets.push(rowOffsets.at(-1) + row.getBoundingClientRect().height));
      const columnOffsets = [0];
      columns.forEach((column) => columnOffsets.push(columnOffsets.at(-1) + column.getBoundingClientRect().width));
      table.querySelectorAll("td[data-grid-row]").forEach((cell) => {
        const row = Number.parseInt(cell.dataset.gridRow || "0", 10);
        const column = Number.parseInt(cell.dataset.gridCol || "0", 10);
        const rowSpan = Number.parseInt(cell.dataset.gridRowspan || "1", 10);
        const columnSpan = Number.parseInt(cell.dataset.gridColspan || "1", 10);
        const freezesTop = row <= frozenRows;
        const freezesLeft = column <= frozenColumns;
        if (!freezesTop && !freezesLeft) return;
        cell.dataset.freezeSticky = "true";
        if (freezesTop) cell.style.top = `${rowOffsets[row - 1] || 0}px`;
        if (freezesLeft) cell.style.left = `${columnOffsets[column - 1] || 0}px`;
        cell.style.zIndex = String((freezesTop ? 20 : 10) + (freezesLeft ? 2 : 0));
        const computed = getComputedStyle(cell);
        if (freezesLeft && column + columnSpan - 1 === frozenColumns && computed.borderRightStyle !== "none") {
          cell.dataset.freezeEdgeRight = "true";
          if (!cell.dataset.freezeRightWidth) {
            cell.dataset.freezeRightWidth = computed.borderRightWidth;
            cell.dataset.freezeRightStyle = computed.borderRightStyle;
            cell.dataset.freezeRightColor = computed.borderRightColor;
          }
          cell.style.setProperty("--freeze-edge-right-width", cell.dataset.freezeRightWidth);
          cell.style.setProperty("--freeze-edge-right-style", cell.dataset.freezeRightStyle);
          cell.style.setProperty("--freeze-edge-right-color", cell.dataset.freezeRightColor);
          cell.style.borderRightColor = "transparent";
        }
        if (freezesTop && row + rowSpan - 1 === frozenRows && computed.borderBottomStyle !== "none") {
          cell.dataset.freezeEdgeBottom = "true";
          if (!cell.dataset.freezeBottomWidth) {
            cell.dataset.freezeBottomWidth = computed.borderBottomWidth;
            cell.dataset.freezeBottomStyle = computed.borderBottomStyle;
            cell.dataset.freezeBottomColor = computed.borderBottomColor;
          }
          cell.style.setProperty("--freeze-edge-bottom-width", cell.dataset.freezeBottomWidth);
          cell.style.setProperty("--freeze-edge-bottom-style", cell.dataset.freezeBottomStyle);
          cell.style.setProperty("--freeze-edge-bottom-color", cell.dataset.freezeBottomColor);
          cell.style.borderBottomColor = "transparent";
        }
        if (computed.backgroundColor === "rgba(0, 0, 0, 0)") {
          cell.style.backgroundColor = "#fff";
        }
      });
    });
  };
  var fetchSourceSheet = async (name) => {
    const version = window.fitnessDataVersion || "live";
    const sourcePath = sourceSheetPaths[name];
    const cacheUrl = `${sourcePath}?v=${encodeURIComponent(version)}`;
    try {
      if ("caches" in window) {
        const cache = await window.caches.open(SOURCE_CACHE_NAME);
        const cached = await cache.match(cacheUrl);
        if (cached) {
          return cached.text();
        }
      }
    } catch (error) {
      console.warn("[fitness-source] persistent cache read failed", error);
    }
    const response = await fetch(cacheUrl, {
      cache: "force-cache"
    });
    if (!response.ok) throw new Error(t("sourceLoadFailed", translate(name), response.status));
    const html = await response.text();
    try {
      if ("caches" in window) {
        const cache = await window.caches.open(SOURCE_CACHE_NAME);
        await cache.put(cacheUrl, new Response(html, {
          headers: { "Content-Type": "text/html; charset=UTF-8" }
        }));
      }
    } catch (error) {
      console.warn("[fitness-source] persistent cache write failed", error);
    }
    return html;
  };
  var loadSourceSheet = async (name, { showStatus = true } = {}) => {
    const loadingMessage = name === "\u996E\u98DF\u8BB0\u5F55" ? t("loadingDiet") : t("loadingQuantification");
    const version = window.fitnessDataVersion || "live";
    if (sourceLoadedVersion !== version) {
      sourceLoadedSheets.clear();
      sourceLoadPromises.clear();
      sourceLoadedVersion = version;
      void pruneSourceCache(version);
    }
    if (sourceLoadedSheets.has(name)) return;
    if (sourceLoadPromises.has(name)) {
      const existingPromise = sourceLoadPromises.get(name);
      if (showStatus) setDataLoadStatus(loadingMessage, "loading");
      try {
        await existingPromise;
      } finally {
        if (showStatus) setDataLoadStatus("");
      }
      return;
    }
    const loadPromise = (async () => {
      if (showStatus) setDataLoadStatus(loadingMessage, "loading");
      const document2 = sourceDocuments.get(name);
      const html = await fetchSourceSheet(name);
      document2.innerHTML = html;
      preserveSourceColumnWidths(document2);
      requestAnimationFrame(() => {
        applySourceFreezePanes(document2);
      });
      sourceLoadedSheets.add(name);
      if (showStatus) setDataLoadStatus("");
    })();
    sourceLoadPromises.set(name, loadPromise);
    try {
      await loadPromise;
    } finally {
      if (sourceLoadPromises.get(name) === loadPromise) sourceLoadPromises.delete(name);
    }
  };
  var prefetchSourceSheet = (name) => {
    if (sourceLoadedSheets.has(name)) return;
    const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 120));
    idle(() => {
      loadSourceSheet(name, { showStatus: false }).catch((error) => {
        console.warn("[fitness-source] background sheet prefetch failed", error);
      });
    });
  };
  var setSourceSheet = (name, reset = true) => {
    sourceActiveSheet = name;
    sourceSheetTabs.forEach((tab) => {
      const active = tab.dataset.sourceSheet === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    sourceDocuments.forEach((document2, key) => {
      document2.hidden = key !== name;
    });
    sourceSheetViewport.setAttribute("aria-label", translate(name));
    siteEntryButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.siteEntry === (name === "\u91CF\u5316" ? "quantification" : "diet")
      );
    });
    if (reset) {
      sourceSheetViewport.scrollLeft = 0;
      sourceSheetViewport.scrollTop = 0;
    }
    requestAnimationFrame(() => applySourceFreezePanes(sourceDocuments.get(name)));
  };
  var syncSiteEntryButtons = (entry) => {
    siteEntryButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.siteEntry === entry);
    });
  };
  var syncStrengthFilterButtons = () => {
    strengthFilterButtons.forEach((button) => {
      const active = button.dataset.strengthFilter === selectedStrengthFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  var postStrengthFilter = () => {
    trainingFrame.contentWindow?.postMessage(
      { type: "fitness-training-filter", filter: selectedStrengthFilter },
      window.location.origin
    );
  };
  var postTrainingData = () => {
    trainingFrame.contentWindow?.postMessage(
      {
        type: "fitness-training-data",
        version: window.fitnessDataVersion || "",
        data: {
          dates: data?.dates || [],
          training: data?.training || []
        }
      },
      window.location.origin
    );
  };
  var applyFitnessDataUpdate = async ({ data: nextData, version }) => {
    if (!nextData || !Array.isArray(nextData.dates) || !Array.isArray(nextData.groups)) return;
    const scroll = preserveViewportScroll();
    data = nextData;
    visibleData = createVisibleData(nextData);
    window.fitnessData = nextData;
    window.fitnessDataVersion = version || window.fitnessDataVersion;
    try {
      sessionStorage.setItem("whatsup.bio.visible-days.v1", JSON.stringify({
        count: visibleData.dates.length,
        date: getLocalIsoDate()
      }));
    } catch (error) {
      console.warn("[fitness-summary] cache write failed", error);
    }
    refreshTimeline();
    renderGroups();
    restoreViewportScroll(scroll);
    if (!sourceDataView.hidden) {
      sourceLoadedVersion = "";
      await loadSourceSheet(sourceActiveSheet);
      applySourceFreezePanes(sourceDocuments.get(sourceActiveSheet));
    }
    if (trainingViewReady) postTrainingData();
  };
  var trainingViewReady = false;
  var trainingViewLoadPromise = null;
  var resolveTrainingViewReady = null;
  var ensureTrainingView = () => {
    if (trainingViewReady) return Promise.resolve();
    if (trainingViewLoadPromise) return trainingViewLoadPromise;
    trainingViewLoadPromise = new Promise((resolve, reject) => {
      const cleanup = () => {
        trainingFrame.removeEventListener("load", handleLoad);
        trainingFrame.removeEventListener("error", handleError);
        resolveTrainingViewReady = null;
      };
      const settleReady = () => {
        if (trainingViewReady) return;
        trainingViewReady = true;
        cleanup();
        trainingFrame.contentWindow?.postMessage(
          { type: "fitness-language", language: getLanguage() },
          window.location.origin
        );
        resolve();
      };
      const handleLoad = () => {
        window.setTimeout(() => {
          if (!trainingViewReady) settleReady();
        }, 0);
      };
      const handleError = () => {
        cleanup();
        trainingViewLoadPromise = null;
        reject(new Error("\u529B\u8BAD\u9875\u9762\u52A0\u8F7D\u5931\u8D25"));
      };
      trainingFrame.addEventListener("load", handleLoad, { once: true });
      trainingFrame.addEventListener("error", handleError, { once: true });
      resolveTrainingViewReady = settleReady;
      if (trainingFrame.getAttribute("src") !== trainingDocumentUrl) {
        trainingFrame.src = trainingDocumentUrl;
      }
    });
    return trainingViewLoadPromise;
  };
  var prefetchTrainingView = () => {
    if (trainingViewReady || trainingFrame.getAttribute("src")) return;
    window.setTimeout(() => {
      ensureTrainingView().catch((error) => {
        console.warn("[fitness-training] background view prefetch failed", error);
      });
    }, 1200);
  };
  var hideTrainingView = (updateRoute = true) => {
    appShell.classList.remove("is-training-mode");
    strengthFilterNavigation.hidden = true;
    trainingEmbeddedView.hidden = true;
    viewport.hidden = false;
    if (updateRoute && isTrainingRoute()) history.pushState(null, "", "/");
    syncSiteEntryButtons("overview");
  };
  var showTrainingView = async (updateRoute = true) => {
    appShell.classList.remove("is-source-mode");
    appShell.classList.add("is-training-mode");
    strengthFilterNavigation.hidden = false;
    viewport.hidden = true;
    sourceDataView.hidden = true;
    trainingEmbeddedView.hidden = false;
    syncSiteEntryButtons("strength");
    syncStrengthFilterButtons();
    if (updateRoute && normalizeRoutePath() !== "/training") {
      history.pushState(null, "", trainingRoute);
    }
    appShell.dataset.appReady = "true";
    try {
      await ensureTrainingView();
      postTrainingData();
      postStrengthFilter();
      appShell.dataset.appReady = "true";
    } catch (error) {
      appShell.dataset.appReady = "true";
      trainingEmbeddedView.hidden = true;
      viewport.hidden = false;
      setDataLoadStatus(error instanceof Error ? error.message : String(error), "error");
    }
  };
  var hideSourceView = (updateRoute = true) => {
    hideTrainingView(false);
    appShell.classList.remove("is-source-mode");
    sourceDataView.hidden = true;
    viewport.hidden = false;
    siteEntryButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.siteEntry === "overview");
    });
    if (updateRoute && (isSourceRoute() || isTrainingRoute())) history.pushState(null, "", "/");
    requestAnimationFrame(() => {
      const viewportWidth = viewport.clientWidth;
      if (Math.abs(viewportWidth - renderedViewportWidth) > 1) {
        const fittedZoom = getInitialZoom();
        if (Math.abs(fittedZoom - zoomPercent) > 1e-3) {
          zoomPercent = fittedZoom;
          timelineZoom.value = String(fittedZoom);
          syncRangeButtons(modeForZoom(fittedZoom));
        }
        renderedViewportWidth = viewportWidth;
      }
      refreshTimeline();
      renderGroups();
      syncFocusRowHeight();
      locateCurrentDate();
    });
  };
  var showSourceView = async (nameOrUpdateRoute = sourceActiveSheet, updateRoute = true) => {
    const name = typeof nameOrUpdateRoute === "boolean" ? sourceActiveSheet : nameOrUpdateRoute;
    if (typeof nameOrUpdateRoute === "boolean") updateRoute = nameOrUpdateRoute;
    sourceActiveSheet = name === "\u996E\u98DF\u8BB0\u5F55" ? "\u996E\u98DF\u8BB0\u5F55" : "\u91CF\u5316";
    hideTrainingView(false);
    syncSiteEntryButtons(sourceActiveSheet === "\u91CF\u5316" ? "quantification" : "diet");
    appShell.classList.add("is-source-mode");
    viewport.hidden = true;
    sourceDataView.hidden = false;
    const route = sourceRouteBySheet[sourceActiveSheet];
    if (updateRoute && normalizeRoutePath() !== route) history.pushState(null, "", route);
    try {
      await loadSourceSheet(sourceActiveSheet);
      setSourceSheet(sourceActiveSheet, false);
      prefetchSourceSheet(sourceActiveSheet === "\u91CF\u5316" ? "\u996E\u98DF\u8BB0\u5F55" : "\u91CF\u5316");
      appShell.dataset.appReady = "true";
    } catch (error) {
      appShell.dataset.appReady = "true";
      setDataLoadStatus(error instanceof Error ? error.message : String(error), "error");
    }
  };
  var showSiteEntry = (entry) => {
    if (entry === "overview") {
      hideSourceView();
      return;
    }
    if (entry === "strength") {
      void showTrainingView();
      return;
    }
    if (entry === "quantification" || entry === "diet") {
      void showSourceView(entry === "diet" ? "\u996E\u98DF\u8BB0\u5F55" : "\u91CF\u5316");
    }
  };
  var focusRowTarget = (row) => {
    const viewportRect = viewport.getBoundingClientRect();
    const rowContentTop = row.getBoundingClientRect().top - viewportRect.top + viewport.scrollTop;
    return Math.max(0, rowContentTop - timelineHeader.getBoundingClientRect().height);
  };
  var snapToFocusRow = () => {
    if (isFocusSnapping || performance.now() < focusSnapSuppressedUntil) return;
    const rows = focusRows();
    if (!rows.length) return;
    const viewportRect = viewport.getBoundingClientRect();
    const headerHeight = timelineHeader.getBoundingClientRect().height;
    const visibleTop = viewportRect.top + headerHeight;
    const visibleBottom = viewportRect.bottom;
    const candidate = rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, visibleBottom) - Math.max(rect.top, visibleTop));
      return {
        target: focusRowTarget(row),
        ratio: rect.height > 0 ? visibleHeight / rect.height : 0
      };
    }).filter(({ ratio }) => ratio >= FOCUS_ROW_VISIBLE_RATIO).sort((left, right) => right.ratio - left.ratio)[0];
    if (!candidate || Math.abs(candidate.target - viewport.scrollTop) < 2) return;
    isFocusSnapping = true;
    viewport.scrollTo({ top: candidate.target, behavior: "smooth" });
    window.setTimeout(() => {
      isFocusSnapping = false;
    }, 420);
  };
  var observeViewportScroll = () => {
    if (focusSnapTimer !== null) window.clearTimeout(focusSnapTimer);
    focusSnapTimer = window.setTimeout(() => {
      focusSnapTimer = null;
      snapToFocusRow();
    }, 140);
  };
  var applyLanguage = (nextLanguage) => {
    const scroll = preserveViewportScroll();
    setLanguage(nextLanguage);
    tooltip.style.display = "none";
    syncStaticText();
    refreshTimeline();
    renderGroups({ preserveScroll: true });
    restoreViewportScroll(scroll);
    if (!sourceDataView.hidden) setSourceSheet(sourceActiveSheet, false);
    trainingFrame.contentWindow?.postMessage(
      { type: "fitness-language", language: getLanguage() },
      window.location.origin
    );
    postStrengthFilter();
  };
  languageButtons.forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.language)));
  strengthFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedStrengthFilter = button.dataset.strengthFilter || "all";
      syncStrengthFilterButtons();
      postStrengthFilter();
    });
  });
  siteEntryButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const entry = button.dataset.siteEntry;
      if (!["overview", "strength", "quantification", "diet"].includes(entry)) return;
      event.preventDefault();
      showSiteEntry(entry);
    });
  });
  rangeButtons.forEach((button) => button.addEventListener("click", () => setRange(button.dataset.range)));
  timelineZoom.addEventListener("input", () => {
    const anchor = captureScrollAnchor();
    setZoom(Number(timelineZoom.value), anchor);
  });
  showPoints.addEventListener("change", () => renderGroups({ preserveScroll: true }));
  showAllValues.addEventListener("change", () => renderGroups({ preserveScroll: true }));
  var resetToInitialView = () => {
    if (appShell.classList.contains("is-training-mode")) {
      trainingFrame.contentWindow?.postMessage(
        { type: "fitness-training-reset-position" },
        window.location.origin
      );
      return;
    }
    if (appShell.classList.contains("is-source-mode")) {
      sourceSheetViewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      return;
    }
    setZoom(getInitialZoom(), null);
    requestAnimationFrame(locateCurrentDate);
  };
  dateRange.addEventListener("click", resetToInitialView);
  var isViewportTarget = (target) => {
    if (target === timelineViewport) return true;
    return Boolean(target && typeof target.nodeType === "number" && timelineViewport.contains(target));
  };
  var isZoomTarget = (target) => isViewportTarget(target) || timelineViewport.matches(":hover");
  var normalizedWheelDelta = (event) => {
    const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? timelineViewport.clientHeight : 1;
    const delta = event.deltaY * modeMultiplier;
    return Math.sign(delta) * Math.min(8, Math.abs(delta));
  };
  var wheelZoomState = null;
  var flushWheelZoom = () => {
    if (!wheelZoomState) return;
    wheelZoomState.frame = null;
    setZoom(wheelZoomState.targetZoom, wheelZoomState.anchor, true);
  };
  window.addEventListener("wheel", (event) => {
    if (!isZoomTarget(event.target) && !wheelZoomState || !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (gestureState) return;
    if (!wheelZoomState) {
      wheelZoomState = {
        anchor: captureScrollAnchorAt(event.clientX),
        frame: null,
        idleTimer: null,
        startZoom: zoomPercent,
        targetZoom: zoomPercent
      };
    }
    wheelZoomState.targetZoom *= Math.exp(-normalizedWheelDelta(event) * WHEEL_ZOOM_SENSITIVITY);
    wheelZoomState.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, wheelZoomState.targetZoom));
    if (wheelZoomState.frame === null) wheelZoomState.frame = requestAnimationFrame(flushWheelZoom);
    if (wheelZoomState.idleTimer !== null) window.clearTimeout(wheelZoomState.idleTimer);
    wheelZoomState.idleTimer = window.setTimeout(() => {
      const { targetZoom, anchor } = wheelZoomState;
      wheelZoomState = null;
      setZoom(targetZoom, anchor);
    }, 150);
  }, { passive: false, capture: true });
  var gestureState = null;
  var gestureClientX = (event) => {
    if (Number.isFinite(event.clientX) && event.clientX !== 0) return event.clientX;
    const rect = timelineViewport.getBoundingClientRect();
    return rect.left + rect.width / 2;
  };
  var amplifyGestureScale = (scale) => {
    const normalized = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return normalized ** GESTURE_ZOOM_GAIN;
  };
  var flushGestureZoom = () => {
    if (!gestureState) return;
    gestureState.frame = null;
    setZoom(gestureState.startZoom * amplifyGestureScale(gestureState.scale), gestureState.anchor, true);
  };
  window.addEventListener("gesturestart", (event) => {
    if (!isZoomTarget(event.target)) return;
    event.preventDefault();
    if (wheelZoomState?.frame !== null) cancelAnimationFrame(wheelZoomState.frame);
    if (wheelZoomState?.idleTimer !== null) window.clearTimeout(wheelZoomState.idleTimer);
    wheelZoomState = null;
    if (gestureState && gestureState.frame !== null) cancelAnimationFrame(gestureState.frame);
    gestureState = {
      anchor: captureScrollAnchorAt(gestureClientX(event)),
      frame: null,
      scale: 1,
      startZoom: zoomPercent
    };
  }, { passive: false, capture: true });
  window.addEventListener("gesturechange", (event) => {
    if (!gestureState) return;
    event.preventDefault();
    gestureState.scale = Number.isFinite(event.scale) && event.scale > 0 ? event.scale : 1;
    if (gestureState.frame === null) {
      gestureState.frame = requestAnimationFrame(flushGestureZoom);
    }
  }, { passive: false, capture: true });
  window.addEventListener("gestureend", (event) => {
    if (!gestureState) return;
    event.preventDefault();
    if (gestureState.frame !== null) cancelAnimationFrame(gestureState.frame);
    const { startZoom, scale, anchor } = gestureState;
    gestureState = null;
    setZoom(startZoom * amplifyGestureScale(scale), anchor);
  }, { passive: false, capture: true });
  var activePointers = /* @__PURE__ */ new Map();
  var pinchState = null;
  var flushPinchZoom = () => {
    if (!pinchState) return;
    pinchState.frame = null;
    const next = pinchState.startZoom * pinchState.scale ** POINTER_PINCH_ZOOM_GAIN;
    setZoom(next, pinchState.anchor, true);
  };
  timelineViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    timelineViewport.setPointerCapture?.(event.pointerId);
    activePointers.set(event.pointerId, event);
    if (activePointers.size === 2) {
      timelineViewport.style.touchAction = "none";
      const [first, second] = [...activePointers.values()];
      pinchState = {
        anchor: captureScrollAnchorAt((first.clientX + second.clientX) / 2),
        frame: null,
        scale: 1,
        startDistance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
        startZoom: zoomPercent
      };
    }
  });
  timelineViewport.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId) || activePointers.size !== 2 || !pinchState) return;
    activePointers.set(event.pointerId, event);
    const [first, second] = [...activePointers.values()];
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    pinchState.scale = distance / pinchState.startDistance;
    if (pinchState.frame === null) {
      pinchState.frame = requestAnimationFrame(flushPinchZoom);
    }
  });
  var finishPinchZoom = () => {
    if (!pinchState) return;
    const state = pinchState;
    if (pinchState.frame !== null) cancelAnimationFrame(pinchState.frame);
    pinchState = null;
    setZoom(state.startZoom * state.scale ** POINTER_PINCH_ZOOM_GAIN, state.anchor);
  };
  var clearPointer = (event) => {
    finishPinchZoom();
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) {
      pinchState = null;
      timelineViewport.style.touchAction = "";
    }
  };
  timelineViewport.addEventListener("pointerup", clearPointer);
  timelineViewport.addEventListener("pointercancel", clearPointer);
  timelineViewport.addEventListener("pointerleave", clearTimelineHeaderHover, { passive: true });
  window.addEventListener("fitness-date-preview", (event) => {
    setTimelineHeaderSelection(event.detail?.index);
  });
  viewport.addEventListener("scroll", () => {
    observeViewportScroll();
  }, { passive: true });
  if ("onscrollend" in window) viewport.addEventListener("scrollend", snapToFocusRow, { passive: true });
  var resizeFrame = null;
  window.addEventListener("resize", () => {
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      if (!sourceDataView.hidden) {
        applySourceFreezePanes(sourceDocuments.get(sourceActiveSheet));
        return;
      }
      const scrollTop = viewport.scrollTop;
      const anchor = captureScrollAnchor();
      refreshTimeline();
      syncFocusRowHeight();
      renderGroups();
      renderedViewportWidth = viewport.clientWidth;
      viewport.scrollTop = scrollTop;
      restoreScrollAnchor(anchor);
    });
  });
  sourceSheetTabs.forEach((tab) => tab.addEventListener("click", () => {
    void showSourceView(tab.dataset.sourceSheet);
  }));
  var stopSourcePanning = (event) => {
    if (!sourcePanState || event && event.pointerId !== sourcePanState.pointerId) return;
    if (event && sourceSheetViewport.hasPointerCapture(event.pointerId)) {
      sourceSheetViewport.releasePointerCapture(event.pointerId);
    }
    sourcePanState = null;
    sourceSheetViewport.classList.remove("is-panning");
  };
  sourceSheetViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a, button, input, select, textarea")) return;
    sourcePanState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: sourceSheetViewport.scrollLeft,
      scrollTop: sourceSheetViewport.scrollTop
    };
    sourceSheetViewport.setPointerCapture(event.pointerId);
    sourceSheetViewport.classList.add("is-panning");
    event.preventDefault();
  });
  window.addEventListener("pointermove", (event) => {
    if (!sourcePanState || event.pointerId !== sourcePanState.pointerId) return;
    sourceSheetViewport.scrollLeft = sourcePanState.scrollLeft - (event.clientX - sourcePanState.startX);
    sourceSheetViewport.scrollTop = sourcePanState.scrollTop - (event.clientY - sourcePanState.startY);
    event.preventDefault();
  }, { passive: false });
  window.addEventListener("pointerup", stopSourcePanning);
  window.addEventListener("pointercancel", stopSourcePanning);
  sourceSheetViewport.addEventListener("lostpointercapture", stopSourcePanning);
  window.addEventListener("popstate", () => {
    if (isTrainingRoute()) {
      void showTrainingView(false);
      return;
    }
    const sheet = sourceSheetFromRoute();
    if (sheet) void showSourceView(sheet, false);
    else hideSourceView(false);
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "fitness-training-ready") {
      if (event.source === trainingFrame.contentWindow) resolveTrainingViewReady?.();
      event.source?.postMessage(
        { type: "fitness-language", language: getLanguage() },
        window.location.origin
      );
      event.source?.postMessage(
        {
          type: "fitness-training-data",
          version: window.fitnessDataVersion || "live",
          data: {
            dates: data?.dates || [],
            training: data?.training || []
          }
        },
        window.location.origin
      );
      event.source?.postMessage(
        { type: "fitness-training-filter", filter: selectedStrengthFilter },
        window.location.origin
      );
      return;
    }
    if (event.data?.type !== "fitness-route") return;
    const route = event.data.route;
    if (route === trainingRoute) {
      void showTrainingView();
      return;
    }
    if (route === "/source-data/metrics" || route === "/source-data/diet") {
      history.pushState(null, "", route);
      void showSourceView(route.endsWith("/diet") ? "\u996E\u98DF\u8BB0\u5F55" : "\u91CF\u5316", false);
      return;
    }
    if (route === "/") {
      history.pushState(null, "", "/");
      hideTrainingView(false);
      hideSourceView(false);
    }
  });
  window.applyFitnessDataUpdate = applyFitnessDataUpdate;
  var initialZoom = getInitialZoom();
  var shouldOpenTraining = isTrainingRoute() || sessionStorage.getItem("whatsup.bio.open-training") === "1";
  var initialSourceSheet = sourceSheetFromRoute();
  syncStaticText();
  var initializeOverview = ({ fitZoom = false, locate = false } = {}) => {
    if (fitZoom) {
      zoomPercent = getInitialZoom();
      timelineZoom.value = String(zoomPercent);
      syncRangeButtons("day");
    }
    refreshTimeline();
    renderGroups();
    root.classList.toggle("show-points-mode", showPoints.checked);
    if (locate) requestAnimationFrame(locateCurrentDate);
  };
  if (shouldOpenTraining) {
    sessionStorage.removeItem("whatsup.bio.open-training");
    initializeOverview({ fitZoom: true });
    void showTrainingView(false);
  } else {
    zoomPercent = initialZoom;
    timelineZoom.value = String(initialZoom);
    syncRangeButtons("day");
    initializeOverview({ locate: true });
    if (initialSourceSheet) void showSourceView(initialSourceSheet, false);
    else prefetchTrainingView();
    if (!initialSourceSheet) appShell.dataset.appReady = "true";
  }
})();
