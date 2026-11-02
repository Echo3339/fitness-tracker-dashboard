import { chartConfig, createTimelineConfig } from "./config.js";
import { createDisplayData } from "./date-range.js";
import { formatDate } from "./formatters.js";
import { createGroupRow } from "./group-renderer.js";
import { getLanguage, setLanguage, t, translate } from "./i18n.js";
import { createTrainingRows } from "./strength-training.js";
import { renderTimelineHeader } from "./timeline-header.js";
import { phasePalette, seriesPalette, trainingPalette } from "./visual-palette.js";

let data = window.fitnessData;
const root = document.documentElement;
const appShell = document.querySelector(".app-shell");
const viewport = document.getElementById("sheetViewport");
const timelineViewport = viewport;
const body = document.getElementById("sheetBody");
const sidebarBody = document.getElementById("sidebarBody");
const timelineHeader = document.getElementById("timelineHeader");
const monthTrack = document.getElementById("monthTrack");
const phaseTrack = document.getElementById("phaseTrack");
const dateTrack = document.getElementById("dateTrack");
const weekTrack = document.getElementById("weekTrack");
const dateRangeFilter = document.getElementById("dateRangeFilter");
const rangeButtons = [...dateRangeFilter.querySelectorAll("[data-range]")];
const timelineZoom = document.getElementById("timelineZoom");
const timelineZoomValue = document.getElementById("timelineZoomValue");
const showPoints = document.getElementById("showPoints") || {
  checked: false,
  addEventListener() {},
  setAttribute() {},
};
const showAllValues = document.getElementById("showAllValues") || {
  checked: false,
  addEventListener() {},
  setAttribute() {},
};
const tooltip = document.getElementById("tooltip");
const dataLoadStatus = document.getElementById("dataLoadStatus");
const dateRange = document.getElementById("dateRange");
const dataSummary = document.getElementById("dataSummary");
const metricCorner = document.getElementById("metricCorner");
const languageSwitch = document.getElementById("languageSwitch");
const languageButtons = [...document.querySelectorAll("[data-language]")];
const strengthFilterNavigation = document.getElementById("strengthFilterNavigation");
const strengthFilterButtons = [...document.querySelectorAll("[data-strength-filter]")];
const sourceDataView = document.getElementById("sourceDataView");
const trainingEmbeddedView = document.getElementById("trainingEmbeddedView");
const trainingFrame = document.getElementById("trainingFrame");
const sourceSheetViewport = document.getElementById("sourceSheetViewport");
const sourceQuantificationDocument = document.getElementById("sourceQuantificationDocument");
const sourceDietDocument = document.getElementById("sourceDietDocument");
const sourceSheetTabs = [...document.querySelectorAll("[data-source-sheet]")];
const siteEntryButtons = [...document.querySelectorAll("[data-site-entry]")];
const sourceDownloadButton = document.querySelector(".source-download-button");
const baseCellWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--cell-width"));
let cellWidth = baseCellWidth;
let previousCellWidth = baseCellWidth;
let zoomPercent = Number(timelineZoom.value || 100);
let appliedZoom = zoomPercent;
const RANGE_PRESETS = { day: 100, week: 65, month: 35 };
const ZOOM_STORAGE_KEY = "whatsup.bio.timeline-zoom.v2";
const MIN_ZOOM = 1;
const MAX_ZOOM = 100;
const WHEEL_ZOOM_SENSITIVITY = 0.022;
const GESTURE_ZOOM_GAIN = 4;
const POINTER_PINCH_ZOOM_GAIN = 4;
const FOCUS_ROW_MIN_HEIGHT = 320;
const FOCUS_ROW_VISIBLE_RATIO = 0.95;
const SCROLL_FIT_TOLERANCE = 12;
const GROUP_DISPLAY_ORDER = [
  "身体质量",
  "睡眠时间带",
  "能量收支",
  "营养素",
  "围度",
  "体脂率",
  "BMI",
  "人体成分",
  "节段脂肪",
  "节段肌肉",
  "心率",
  "欲",
];
const groupDisplayOrder = new Map(GROUP_DISPLAY_ORDER.map((title, index) => [title, index]));
root.style.setProperty("--chart-height", `${chartConfig.chartHeight}px`);

const getLocalIsoDate = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
};

const createVisibleData = (source) => {
  const currentDate = getLocalIsoDate();
  const visibleCount = source.dates.findIndex((item) => item.date > currentDate);
  const dateCount = visibleCount < 0 ? source.dates.length : visibleCount;
  const dates = source.dates.slice(0, dateCount);
  const lastVisibleIndex = dates.length - 1;
  const cumulativeGainValues = source.groups
    .find((group) => group.title === "累计增重")
    ?.series[0]?.values.slice(0, dateCount) || [];
  return {
    ...source,
    currentDate: dates.find((item) => item.date === currentDate)?.date || dates.at(-1)?.date || currentDate,
    dates,
    cumulativeGainValues,
    phases: source.phases
      .filter((phase) => phase.start <= lastVisibleIndex && phase.end >= 0)
      .map((phase, index) => ({
        ...phase,
        end: Math.min(phase.end, lastVisibleIndex),
        color: phasePalette[index % phasePalette.length],
      })),
    groups: source.groups
    .filter((group) => !["累计增重", "增重速度", "跑步"].includes(group.title))
      .map((group) => ({
        ...group,
        chartType: group.title === "欲" ? "count-line" : group.chartType,
        series: group.series
          .filter((series) => (
            !(group.title === "能量收支" && ["baseline-calories", "aerobic-calories", "strength-calories"].includes(series.id))
            && series.id !== "aerobic-heart-rate"
          ))
          .map((series) => ({
            ...series,
            color: group.title === "睡眠时间带" ? "#708eaf" : seriesPalette[group.series.indexOf(series) % seriesPalette.length],
            values: series.values.slice(0, dateCount),
          })),
      }))
      .filter((group) => group.series.length > 0 && group.series.some((series) => (
        series.values.some((value) => value !== null && value !== undefined)
      ))),
    training: source.training.map((action) => ({
      ...action,
      color: trainingPalette[action.id] || action.color,
      values: action.values.slice(0, dateCount),
    })),
  };
};

let visibleData = createVisibleData(data);
try {
  sessionStorage.setItem("whatsup.bio.visible-days.v1", JSON.stringify({
    count: visibleData.dates.length,
    date: getLocalIsoDate(),
  }));
} catch (error) {
  console.warn("[fitness-summary] cache write failed", error);
}
let displayData = visibleData;
let sleepBandAligned = true;
let focusSnapTimer = null;
let isFocusSnapping = false;

const setSleepBandAligned = (aligned) => {
  sleepBandAligned = Boolean(aligned);
  renderGroups({ preserveScroll: true });
};

const latestValue = (item) => {
  const values = item.values || [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && value !== undefined) {
      return typeof value === "object" ? (value.maxWeight ?? value.maxReps ?? Number.NEGATIVE_INFINITY) : value;
    }
  }
  return Number.NEGATIVE_INFINITY;
};

const sortByChartPosition = (items) => items
  .map((item, index) => ({ item, index }))
  .sort((left, right) => {
    const leftValue = latestValue(left.item);
    const rightValue = latestValue(right.item);
    if (leftValue === rightValue) return left.index - right.index;
    if (leftValue === Number.NEGATIVE_INFINITY) return 1;
    if (rightValue === Number.NEGATIVE_INFINITY) return -1;
    return rightValue - leftValue;
  })
  .map(({ item }) => item);

const syncFocusRowHeight = () => {
  const headerHeight = timelineHeader.getBoundingClientRect().height;
  const availableHeight = Math.floor(viewport.clientHeight - headerHeight);
  const focusRowHeight = Math.max(FOCUS_ROW_MIN_HEIGHT, availableHeight);
  root.style.setProperty("--focus-row-height", `${focusRowHeight}px`);
  return focusRowHeight;
};

const getSidebarWidth = () => {
  const sidebar = document.getElementById("sheetSidebar");
  const width = sidebar?.getBoundingClientRect().width || 0;
  return Number.isFinite(width) && width > 0 ? width : 0;
};

const syncPhaseGap = () => {
  const phaseHeight = phaseTrack.getBoundingClientRect().height;
  const phaseGap = Math.max(1, Math.round(phaseHeight / 2));
  root.style.setProperty("--phase-gap", `${phaseGap}px`);
  return phaseGap;
};

const refreshTimeline = () => {
  const mode = dateRangeFilter.dataset.value || "day";
  displayData = createDisplayData(visibleData, mode);
  const orderedGroups = displayData.groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftOrder = groupDisplayOrder.get(left.group.title) ?? GROUP_DISPLAY_ORDER.length;
      const rightOrder = groupDisplayOrder.get(right.group.title) ?? GROUP_DISPLAY_ORDER.length;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ group }) => group);
  displayData = {
    ...displayData,
    groups: orderedGroups.map((group) => ({
      ...group,
      series: group.chartType === "sleep-band" ? group.series : sortByChartPosition(group.series),
    })),
    training: sortByChartPosition(displayData.training),
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
  dateRange.textContent = `${formatDate(rangeStart)} — ${formatDate(rangeEnd)}`;
  dataSummary.textContent = t("dataSummary", visibleData.dates.length);
  const zoomLabel = `${Math.round(zoomPercent)}`;
  timelineZoomValue.value = `${zoomLabel}%`;
  timelineZoomValue.textContent = `${zoomLabel}%`;
  renderTimelineHeader({ data: displayData, monthTrack, weekTrack, phaseTrack, dateTrack });
  syncPhaseGap();
  previousCellWidth = cellWidth;
};

const clearTimelineHeaderHover = () => {
  timelineHeader.querySelectorAll(".is-hovered").forEach((element) => element.classList.remove("is-hovered"));
};

const setTimelineHeaderSelection = (index) => {
  clearTimelineHeaderHover();
  if (!Number.isInteger(index) || index < 0 || index >= displayData.dates.length) return;
  timelineHeader.querySelectorAll("[data-start][data-end]").forEach((element) => {
    if (index >= Number(element.dataset.start) && index <= Number(element.dataset.end)) {
      element.classList.add("is-hovered");
    }
  });
};

let focusSnapSuppressedUntil = 0;
const preserveViewportScroll = () => ({
  left: timelineViewport.scrollLeft,
  top: viewport.scrollTop,
});

const restoreViewportScroll = ({ left, top }) => {
  const restore = () => {
    timelineViewport.scrollLeft = left;
    viewport.scrollTop = top;
  };
  restore();
  requestAnimationFrame(restore);
};

const renderGroups = ({ preserveScroll = false } = {}) => {
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
  const bodyMassGroup = displayData.groups.find((group) => group.title === "身体质量");
  const sleepGroup = displayData.groups.find((group) => group.title === "睡眠时间带");
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
    onSleepBandAlignedChange: setSleepBandAligned,
  });
  displayData.groups
    .filter((group) => group !== bodyMassGroup && group !== sleepGroup)
    .forEach((group) => createGroupRow({ group, data: displayData, body, sidebarBody, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, focusRowHeight }));
  if (scroll) restoreViewportScroll(scroll);
};

const locateCurrentDate = () => {
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

const modeForZoom = (zoomPercent) => (zoomPercent >= 80 ? "day" : "week");

const getInitialZoom = () => {
  const dateCount = Math.max(1, displayData?.dates?.length || visibleData.dates.length);
  const sidebarWidth = getSidebarWidth();
  const viewportWidth = Math.min(timelineViewport.clientWidth, root.clientWidth || timelineViewport.clientWidth);
  const availableWidth = Math.max(1, viewportWidth - sidebarWidth);
  const fitPercent = (availableWidth / (dateCount * baseCellWidth)) * 100;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitPercent));
};

const syncRangeButtons = (mode) => {
  dateRangeFilter.dataset.value = mode;
  rangeButtons.forEach((button) => {
    const active = button.dataset.range === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
};

const setRange = (mode) => {
  const nextZoom = RANGE_PRESETS[mode];
  if (nextZoom === undefined) return;
  syncRangeButtons(mode);
  setZoom(nextZoom, captureScrollAnchor());
};

const setZoom = (value, anchor = null, interactive = false) => {
  const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  if (Math.abs(nextZoom - zoomPercent) < 0.001) return false;
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

/* Keep the pointer's date under the same screen position while zooming. */
const captureScrollAnchorAt = (clientX) => {
  const rect = timelineViewport.getBoundingClientRect();
  const contentX = timelineViewport.scrollLeft + clientX - rect.left;
  return {
    index: Math.max(0, (contentX - getSidebarWidth() - previousCellWidth / 2) / previousCellWidth),
    viewportX: clientX - rect.left,
  };
};

const captureScrollAnchor = () => {
  const sidebarWidth = getSidebarWidth();
  const viewportCenter = timelineViewport.scrollLeft + timelineViewport.clientWidth / 2;
  return {
    index: Math.max(0, (viewportCenter - sidebarWidth - previousCellWidth / 2) / previousCellWidth),
    viewportX: timelineViewport.clientWidth / 2,
  };
};

const restoreScrollAnchor = (anchor) => {
  const normalized = typeof anchor === "number"
    ? { index: anchor, viewportX: timelineViewport.clientWidth / 2 }
    : anchor;
  const sidebarWidth = getSidebarWidth();
  const target = sidebarWidth + normalized.index * cellWidth + cellWidth / 2 - normalized.viewportX;
  timelineViewport.scrollLeft = Math.max(0, Math.min(timelineViewport.scrollWidth - timelineViewport.clientWidth, target));
};

const focusRows = () => [...body.querySelectorAll(".expanded-chart-row, .training-combined-row")];

const sourceDocuments = new Map([
  ["量化", sourceQuantificationDocument],
  ["饮食记录", sourceDietDocument],
]);
const sourceSheetPaths = {
  量化: "/excel-preview/sheets/quantification.html",
  饮食记录: "/excel-preview/sheets/diet.html",
};
const sourceRouteBySheet = {
  量化: "/source-data/metrics",
  饮食记录: "/source-data/diet",
};
const trainingRoute = "/training/";
const trainingDocumentUrl = `/training/index.html?embedded=1&build=20261021-nav-load-fix-v1`;
let selectedStrengthFilter = "all";
const normalizeRoutePath = () => window.location.pathname.replace(/\/+$/, "") || "/";
const isTrainingRoute = () => normalizeRoutePath() === "/training";
const sourceSheetFromRoute = () => {
  const path = normalizeRoutePath();
  if (path === "/source-data/diet") return "饮食记录";
  if (path === "/source-data/metrics") return "量化";
  return null;
};
const isSourceRoute = () => sourceSheetFromRoute() !== null;
let sourceActiveSheet = sourceSheetFromRoute() || "量化";
let sourceLoadedVersion = "";
const sourceLoadedSheets = new Set();
let sourcePanState = null;
const sourceLoadPromises = new Map();
const SOURCE_CACHE_NAME = "whatsup.bio.source-sheets.v3";
let renderedViewportWidth = viewport.clientWidth;

const clearLegacySourceStorage = () => {
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

const pruneSourceCache = async (version) => {
  if (!("caches" in window)) return;
  try {
    const cache = await window.caches.open(SOURCE_CACHE_NAME);
    const requests = await cache.keys();
    await Promise.all(requests
      .filter((request) => new URL(request.url).searchParams.get("v") !== version)
      .map((request) => cache.delete(request)));
  } catch (error) {
    console.warn("[fitness-source] persistent cache cleanup failed", error);
  }
};

clearLegacySourceStorage();

const syncLanguageButtons = () => {
  languageButtons.forEach((button) => {
    const active = button.dataset.language === getLanguage();
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
};

const syncStaticText = () => {
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
    button.textContent = filter === "all" ? (getLanguage() === "zh" ? "全部" : "All") : translate(filter);
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

const setDataLoadStatus = (message, state = "loading") => {
  if (!dataLoadStatus) return;
  dataLoadStatus.textContent = message;
  dataLoadStatus.dataset.state = state;
  dataLoadStatus.hidden = !message;
};

const preserveSourceColumnWidths = (container) => {
  container.querySelectorAll("table").forEach((table) => {
    const width = [...table.querySelectorAll("col")].reduce(
      (total, column) => total + Number.parseFloat(column.style.width || 0),
      0,
    );
    if (width > 0) table.style.width = `${width}px`;
  });
};

const applySourceFreezePanes = (container) => {
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

const fetchSourceSheet = async (name) => {
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
    cache: "force-cache",
  });
  if (!response.ok) throw new Error(t("sourceLoadFailed", translate(name), response.status));
  const html = await response.text();
  try {
    if ("caches" in window) {
      const cache = await window.caches.open(SOURCE_CACHE_NAME);
      await cache.put(cacheUrl, new Response(html, {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      }));
    }
  } catch (error) {
    console.warn("[fitness-source] persistent cache write failed", error);
  }
  return html;
};

const loadSourceSheet = async (name, { showStatus = true } = {}) => {
  const loadingMessage = name === "饮食记录" ? t("loadingDiet") : t("loadingQuantification");
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
    const document = sourceDocuments.get(name);
    const html = await fetchSourceSheet(name);
    document.innerHTML = html;
    preserveSourceColumnWidths(document);
    requestAnimationFrame(() => {
      applySourceFreezePanes(document);
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

const prefetchSourceSheet = (name) => {
  if (sourceLoadedSheets.has(name)) return;
  const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 120));
  idle(() => {
    loadSourceSheet(name, { showStatus: false }).catch((error) => {
      console.warn("[fitness-source] background sheet prefetch failed", error);
    });
  });
};

const setSourceSheet = (name, reset = true) => {
  sourceActiveSheet = name;
  sourceSheetTabs.forEach((tab) => {
    const active = tab.dataset.sourceSheet === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  sourceDocuments.forEach((document, key) => {
    document.hidden = key !== name;
  });
  sourceSheetViewport.setAttribute("aria-label", translate(name));
  siteEntryButtons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.siteEntry === (name === "量化" ? "quantification" : "diet"),
    );
  });
  if (reset) {
    sourceSheetViewport.scrollLeft = 0;
    sourceSheetViewport.scrollTop = 0;
  }
  requestAnimationFrame(() => applySourceFreezePanes(sourceDocuments.get(name)));
};

const syncSiteEntryButtons = (entry) => {
  siteEntryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.siteEntry === entry);
  });
};

const syncStrengthFilterButtons = () => {
  strengthFilterButtons.forEach((button) => {
    const active = button.dataset.strengthFilter === selectedStrengthFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
};

const postStrengthFilter = () => {
  trainingFrame.contentWindow?.postMessage(
    { type: "fitness-training-filter", filter: selectedStrengthFilter },
    window.location.origin,
  );
};

const postTrainingData = () => {
  trainingFrame.contentWindow?.postMessage(
    {
      type: "fitness-training-data",
      version: window.fitnessDataVersion || "",
      data: {
        dates: data?.dates || [],
        training: data?.training || [],
      },
    },
    window.location.origin,
  );
};

const applyFitnessDataUpdate = async ({ data: nextData, version }) => {
  if (!nextData || !Array.isArray(nextData.dates) || !Array.isArray(nextData.groups)) return;
  const scroll = preserveViewportScroll();
  data = nextData;
  visibleData = createVisibleData(nextData);
  window.fitnessData = nextData;
  window.fitnessDataVersion = version || window.fitnessDataVersion;
  try {
    sessionStorage.setItem("whatsup.bio.visible-days.v1", JSON.stringify({
      count: visibleData.dates.length,
      date: getLocalIsoDate(),
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

let trainingViewReady = false;
let trainingViewLoadPromise = null;
let resolveTrainingViewReady = null;
const ensureTrainingView = () => {
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
        window.location.origin,
      );
      resolve();
    };
    const handleLoad = () => {
      // A failed child script can still fire iframe load; the ready message is
      // the normal completion signal, while load remains a conservative fallback.
      window.setTimeout(() => {
        if (!trainingViewReady) settleReady();
      }, 0);
    };
    const handleError = () => {
      cleanup();
      trainingViewLoadPromise = null;
      reject(new Error("力训页面加载失败"));
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

const prefetchTrainingView = () => {
  if (trainingViewReady || trainingFrame.getAttribute("src")) return;
  window.setTimeout(() => {
    ensureTrainingView().catch((error) => {
      console.warn("[fitness-training] background view prefetch failed", error);
    });
  }, 1200);
};

const hideTrainingView = (updateRoute = true) => {
  appShell.classList.remove("is-training-mode");
  strengthFilterNavigation.hidden = true;
  trainingEmbeddedView.hidden = true;
  viewport.hidden = false;
  if (updateRoute && isTrainingRoute()) history.pushState(null, "", "/");
  syncSiteEntryButtons("overview");
};

const showTrainingView = async (updateRoute = true) => {
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

const hideSourceView = (updateRoute = true) => {
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
      if (Math.abs(fittedZoom - zoomPercent) > 0.001) {
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

const showSourceView = async (nameOrUpdateRoute = sourceActiveSheet, updateRoute = true) => {
  const name = typeof nameOrUpdateRoute === "boolean" ? sourceActiveSheet : nameOrUpdateRoute;
  if (typeof nameOrUpdateRoute === "boolean") updateRoute = nameOrUpdateRoute;
  sourceActiveSheet = name === "饮食记录" ? "饮食记录" : "量化";
  hideTrainingView(false);
  syncSiteEntryButtons(sourceActiveSheet === "量化" ? "quantification" : "diet");
  appShell.classList.add("is-source-mode");
  viewport.hidden = true;
  sourceDataView.hidden = false;
  const route = sourceRouteBySheet[sourceActiveSheet];
  if (updateRoute && normalizeRoutePath() !== route) history.pushState(null, "", route);
  try {
    await loadSourceSheet(sourceActiveSheet);
    setSourceSheet(sourceActiveSheet, false);
    prefetchSourceSheet(sourceActiveSheet === "量化" ? "饮食记录" : "量化");
    appShell.dataset.appReady = "true";
  } catch (error) {
    appShell.dataset.appReady = "true";
    setDataLoadStatus(error instanceof Error ? error.message : String(error), "error");
  }
};

const showSiteEntry = (entry) => {
  if (entry === "overview") {
    hideSourceView();
    return;
  }
  if (entry === "strength") {
    void showTrainingView();
    return;
  }
  if (entry === "quantification" || entry === "diet") {
    void showSourceView(entry === "diet" ? "饮食记录" : "量化");
  }
};

const focusRowTarget = (row) => {
  const viewportRect = viewport.getBoundingClientRect();
  const rowContentTop = row.getBoundingClientRect().top - viewportRect.top + viewport.scrollTop;
  return Math.max(0, rowContentTop - timelineHeader.getBoundingClientRect().height);
};

const snapToFocusRow = () => {
  if (isFocusSnapping || performance.now() < focusSnapSuppressedUntil) return;
  const rows = focusRows();
  if (!rows.length) return;
  const viewportRect = viewport.getBoundingClientRect();
  const headerHeight = timelineHeader.getBoundingClientRect().height;
  const visibleTop = viewportRect.top + headerHeight;
  const visibleBottom = viewportRect.bottom;
  const candidate = rows
    .map((row) => {
      const rect = row.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, visibleBottom) - Math.max(rect.top, visibleTop));
      return {
        target: focusRowTarget(row),
        ratio: rect.height > 0 ? visibleHeight / rect.height : 0,
      };
    })
    .filter(({ ratio }) => ratio >= FOCUS_ROW_VISIBLE_RATIO)
    .sort((left, right) => right.ratio - left.ratio)[0];
  if (!candidate || Math.abs(candidate.target - viewport.scrollTop) < 2) return;
  isFocusSnapping = true;
  viewport.scrollTo({ top: candidate.target, behavior: "smooth" });
  window.setTimeout(() => { isFocusSnapping = false; }, 420);
};

const observeViewportScroll = () => {
  if (focusSnapTimer !== null) window.clearTimeout(focusSnapTimer);
  focusSnapTimer = window.setTimeout(() => {
    focusSnapTimer = null;
    snapToFocusRow();
  }, 140);
};

const applyLanguage = (nextLanguage) => {
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
    window.location.origin,
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
const resetToInitialView = () => {
  if (appShell.classList.contains("is-training-mode")) {
    trainingFrame.contentWindow?.postMessage(
      { type: "fitness-training-reset-position" },
      window.location.origin,
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

const isViewportTarget = (target) => {
  if (target === timelineViewport) return true;
  return Boolean(target && typeof target.nodeType === "number" && timelineViewport.contains(target));
};

const isZoomTarget = (target) => isViewportTarget(target) || timelineViewport.matches(":hover");

/* Trackpad pinch is exposed as a modified wheel in Chromium and as gesture*
   events in Safari. Capture both at window level so SVG descendants cannot
   swallow the event before it reaches the timeline viewport. */
const normalizedWheelDelta = (event) => {
  const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? timelineViewport.clientHeight : 1;
  const delta = event.deltaY * modeMultiplier;
  return Math.sign(delta) * Math.min(8, Math.abs(delta));
};

let wheelZoomState = null;
const flushWheelZoom = () => {
  if (!wheelZoomState) return;
  wheelZoomState.frame = null;
  setZoom(wheelZoomState.targetZoom, wheelZoomState.anchor, true);
};

window.addEventListener("wheel", (event) => {
  if ((!isZoomTarget(event.target) && !wheelZoomState) || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  if (gestureState) return;
  if (!wheelZoomState) {
    wheelZoomState = {
      anchor: captureScrollAnchorAt(event.clientX),
      frame: null,
      idleTimer: null,
      startZoom: zoomPercent,
      targetZoom: zoomPercent,
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

let gestureState = null;

const gestureClientX = (event) => {
  if (Number.isFinite(event.clientX) && event.clientX !== 0) return event.clientX;
  const rect = timelineViewport.getBoundingClientRect();
  return rect.left + rect.width / 2;
};

const amplifyGestureScale = (scale) => {
  const normalized = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return normalized ** GESTURE_ZOOM_GAIN;
};

const flushGestureZoom = () => {
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
    startZoom: zoomPercent,
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

const activePointers = new Map();
let pinchState = null;
const flushPinchZoom = () => {
  if (!pinchState) return;
  pinchState.frame = null;
  const next = pinchState.startZoom * (pinchState.scale ** POINTER_PINCH_ZOOM_GAIN);
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
      startZoom: zoomPercent,
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

const finishPinchZoom = () => {
  if (!pinchState) return;
  const state = pinchState;
  if (pinchState.frame !== null) cancelAnimationFrame(pinchState.frame);
  pinchState = null;
  setZoom(state.startZoom * (state.scale ** POINTER_PINCH_ZOOM_GAIN), state.anchor);
};

const clearPointer = (event) => {
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

let resizeFrame = null;
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

const stopSourcePanning = (event) => {
  if (!sourcePanState || (event && event.pointerId !== sourcePanState.pointerId)) return;
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
    scrollTop: sourceSheetViewport.scrollTop,
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
      window.location.origin,
    );
    event.source?.postMessage(
      {
        type: "fitness-training-data",
        version: window.fitnessDataVersion || "live",
        data: {
          dates: data?.dates || [],
          training: data?.training || [],
        },
      },
      window.location.origin,
    );
    event.source?.postMessage(
      { type: "fitness-training-filter", filter: selectedStrengthFilter },
      window.location.origin,
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
    void showSourceView(route.endsWith("/diet") ? "饮食记录" : "量化", false);
    return;
  }
  if (route === "/") {
    history.pushState(null, "", "/");
    hideTrainingView(false);
    hideSourceView(false);
  }
});

window.applyFitnessDataUpdate = applyFitnessDataUpdate;

const initialZoom = getInitialZoom();
const shouldOpenTraining = isTrainingRoute() || sessionStorage.getItem("whatsup.bio.open-training") === "1";
const initialSourceSheet = sourceSheetFromRoute();
syncStaticText();
const initializeOverview = ({ fitZoom = false, locate = false } = {}) => {
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
