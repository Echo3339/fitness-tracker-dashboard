const STORAGE_KEY = "whatsup.bio.language.v2";

let language = localStorage.getItem(STORAGE_KEY) || "zh";

const dictionary = {
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
    desireWeeklyAverage: (count) => `${Number.isFinite(count) ? (Number.isInteger(count) ? count : count.toFixed(1)) : "0"}`,
    average: "Avg",
    phaseFallback: (index) => `Phase ${index}`,
    monthLabel: (month) => `${month} mo`,
    weekLabel: (week) => `Week ${week}`,
  },
  zh: {
    appTitle: "量化·力量训练",
    logoAlt: "量化·力量训练",
    dataSummary: (count) => `${count}天`,
    metric: "指标",
    pointsShort: "点",
    valuesShort: "值",
    showPoints: "显示节点",
    showValues: "显示全部值",
    zoom: "缩放",
    dateRange: "日期范围",
    locateToday: "定位到当前日期",
    day: "日",
    week: "周",
    month: "月",
    sourceViewTitle: "源数据",
    sourceDownload: "Excel",
    sourceDownloadTitle: "下载健身计划 Excel",
    sourceDataAria: "源数据",
    trendAria: "量化趋势时间轴",
    filterAria: "图表筛选",
    strengthFilterAria: "动作筛选",
    sourceSheetTabs: "源数据工作表",
    siteOverview: "总览",
    siteTraining: "力训",
    siteMetrics: "量化",
    siteDiet: "饮食",
    quantification: "量化",
    diet: "饮食记录",
    loadingData: "正在加载数据…",
    loadingQuantification: "正在加载量化数据…",
    loadingDiet: "正在加载饮食数据…",
    loadingFailed: "数据加载失败，请稍后刷新",
    loadingAppFailed: "应用脚本加载失败",
    sourceLoadFailed: (name, status) => `${name} 加载失败（${status}）`,
    lineChart: (title, unit) => `${title} ${unit} 折线图`,
    barChart: (title, unit) => `${title} ${unit} 柱状图`,
    textTimeline: (title) => `${title}离散记录`,
    sleepChart: "睡眠时间带，时间轴 21:00 至次日 13:00，含 22:00 和 07:30 刻度",
    strengthChart: "力量训练最大重量趋势",
    strengthTraining: "力量训练",
    maxWeight: "最大重量",
    maxReps: "最大次数",
    totalReps: "总量",
    setCount: "数量",
    totalVolume: "总训练量",
    formalSet: "正式",
    sleepOnset: "入睡时间",
    wakeTime: "起床时间",
    sleepDuration: "睡眠时长",
    sleepAlignToActual: "切换为实际入睡/起床时间",
    sleepAlignToDuration: "切换为统一起点的时长对比",
    desireCount: (count) => `${count}`,
    desireWeeklyAverage: (count) => `${Number.isFinite(count) ? (Number.isInteger(count) ? count : count.toFixed(1)) : "0"}`,
    average: "均值",
    phaseFallback: (index) => `阶段 ${index}`,
    monthLabel: (month) => `${month} 月`,
    weekLabel: (week) => `第${week}周`,
  },
};

const textMap = {
  "睡眠时间带": "Sleep Window",
  "身体质量": "Body Mass",
  "围度": "Circumference",
  "体脂率": "Body Fat",
  "人体成分": "Body Composition",
  "节段脂肪": "Segmental Fat",
  "节段肌肉": "Segmental Muscle",
  "心率": "Heart Rate",
  "能量收支": "Energy Balance",
  "营养素": "Macros",
  "欲": "Desire",
  "跑步组": "Running sets",
  "跑步时长": "Run duration",
  "次数": "Count",
  "累计增重": "Cumulative Gain",
  "增重速度": "Gain Pace",
  "入睡时间": "Sleep onset",
  "起床时间": "Wake time",
  "睡眠时长": "Sleep duration",
  "静息心率": "Resting HR",
  "有氧心率": "Cardio HR",
  "基准热量": "Baseline",
  "有氧消耗": "Cardio burn",
  "力量训练": "Strength",
  "摄入热量": "Intake",
  "碳水": "Carbs",
  "蛋白质": "Protein",
  "脂肪": "Fat",
  "体重": "Weight",
  "肌肉": "Muscle",
  "日增幅": "Daily gain",
  "水分": "Water",
  "骨盐": "Bone mineral",
  "左上肢": "Left arm",
  "右上肢": "Right arm",
  "左下肢": "Left leg",
  "右下肢": "Right leg",
  "躯干": "Torso",
  "左大臂围(直)": "Left arm straight",
  "左大臂围(曲)": "Left arm flexed",
  "右大臂围(直)": "Right arm straight",
  "右大臂围(曲)": "Right arm flexed",
  "胸围": "Chest",
  "腰围": "Waist",
  "大腿(左)": "Left thigh",
  "大腿(右)": "Right thigh",
  "小腿(左)": "Left calf",
  "小腿(右)": "Right calf",
  "状态": "State",
  "记录": "Notes",
  "时刻": "Clock",
  "小时": "h",
  "kg/日": "kg/day",
  "深蹲": "Squat",
  "推举": "Press",
  "高翻": "Clean",
  "卧推": "Bench",
  "硬拉": "Deadlift",
  "自重反手引体向上": "Bodyweight Chin-up",
  "负重反手引体向上": "Weighted Chin-up",
  "次": "reps",
  "次/周": "reps/week",
  "组": "sets",
  "量化": "Metrics",
  "饮食记录": "Diet",
};

const weekdayMap = {
  周一: "Mon",
  周二: "Tue",
  周三: "Wed",
  周四: "Thu",
  周五: "Fri",
  周六: "Sat",
  周日: "Sun",
};

const phaseMap = {
  "阶段1：1周康复训练计划：7/7-7/12（第1周）": "Phase 1: Recovery week, Jul 7-Jul 12",
  "阶段2：1周无氧训练计划试行：7/13-7/19（第2周）": "Phase 2: Strength trial week, Jul 13-Jul 19",
  "阶段3：3周无氧训练（硬拉）冲刺计划：7/19-8/09（第3、4、5周）": "Phase 3: Deadlift push, Jul 19-Aug 9",
  "阶段4：1周常规无氧训练计划：8/10-8/16（第6周）": "Phase 4: Standard strength week, Aug 10-Aug 16",
  "阶段5：（懈怠）无氧训练计划：8/17-8/30（第7/8周）": "Phase 5: Low-adherence strength block, Aug 17-Aug 30",
  "阶段6：无氧训练优化计划：8/31-10/04（第9/10/11/12/13周）": "Phase 6: Strength optimization, Aug 31-Oct 4",
};

export const getLanguage = () => language;

export const setLanguage = (nextLanguage) => {
  language = nextLanguage === "zh" ? "zh" : "en";
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.lang = language;
};

export const t = (key, ...args) => {
  const value = dictionary[language][key] ?? dictionary.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
};

export const translate = (value) => {
  if (language === "zh") {
    if (value === "自重反手引体向上") return "自重反手";
    if (value === "负重反手引体向上") return "负重反手";
    return value;
  }
  return textMap[value] || value;
};

export const translateUnit = (unit) => (language === "zh" ? unit : textMap[unit] || unit);

export const translateWeekday = (weekday) => (language === "zh" ? weekday : weekdayMap[weekday] || weekday);

export const translatePhaseLabel = (label) => {
  if (language === "zh") return label;
  const match = String(label).match(/阶段\s*(\d+)/);
  return match ? `Phase ${match[1]}` : label;
};

export const translatePhaseTitle = (title) => (language === "zh" ? title : phaseMap[title] || title);

export const phaseShortName = (phase) => {
  if (phase.phaseCell) return "";
  if (language === "zh") return phase.title.replace(/^阶段\d+：/, "").replace(/：.*$/, "").replace(/（.*$/, "");
  return translatePhaseTitle(phase.title).replace(/^Phase\s+\d+:\s*/, "").replace(/,\s.*$/, "");
};

setLanguage(language);
