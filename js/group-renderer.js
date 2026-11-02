import { chartConfig } from "./config.js";
import { createLineChart } from "./line-chart.js";
import { createBarChart } from "./bar-chart.js";
import { formatDelta, formatValue, latestValue, seriesDelta } from "./formatters.js";
import { t, translate, translateUnit } from "./i18n.js";
import { createSleepBandChart } from "./sleep-band-chart.js";
import { createTextTimeline } from "./text-timeline.js";
import { createDesireTimeline } from "./desire-timeline.js";
import { weekStarts } from "./timeline-grid.js";

const baseHeightForGroup = (group, focusRowHeight) => {
  const isExpanded = group.title === "围度";
  const isTextChart = ["text", "activity", "count-line"].includes(group.chartType);
  if (group.chartType === "sleep-band") return chartConfig.sleepChartHeight;
  if (isTextChart) return group.title === "欲" ? chartConfig.desireChartHeight : chartConfig.textChartHeight;
  if (["节段脂肪", "节段肌肉"].includes(group.title)) return Math.max(chartConfig.chartHeight, 264);
  return isExpanded ? focusRowHeight : chartConfig.chartHeight;
};

const getPhaseGap = () => {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap"));
  return Number.isFinite(value) && value > 0 ? value : chartConfig.phaseGap;
};

const averageSummaryValue = (series, group, data) => {
  const values = data.rangeMode === "day"
    ? series.values
    : series.summaryValues || [];
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  if (group.chartType === "sleep-band" && series.id !== "sleep-duration") {
    const clockValues = valid.map((value) => (value < 18 ? value + 24 : value));
    return (clockValues.reduce((sum, value) => sum + value, 0) / clockValues.length) % 24;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const setSharedRowHeight = ({ sidebarRow, chartRow, label, axisPanel, chartPanel, baseHeight }) => {
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

export const createGroupRow = ({
  group,
  data,
  body,
  sidebarBody,
  tooltip,
  cellWidth,
  timelineWidth,
  showPoints,
  showAllValues,
  focusRowHeight = chartConfig.expandedChartHeight,
  sleepBandAligned = true,
  onSleepBandAlignedChange,
}) => {
  const isExpanded = group.title === "围度";
  const isTextChart = ["text", "activity", "count-line"].includes(group.chartType);
  const isDesireChart = group.title === "欲";
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
  if (["能量收支", "营养素"].includes(group.title)) label.classList.add("summary-values-hidden");
  const groupAccent = group.series.find((series) => series.color)?.color || "#15766e";
  label.style.setProperty("--group-accent", groupAccent);
  chartRow.style.setProperty("--group-accent", groupAccent);
  sidebarRow.style.setProperty("--group-accent", groupAccent);

  const list = group.series
    .map((series) => {
      const deltaUnit = group.chartType === "sleep-band" && series.id === "sleep-duration" ? "小时" : group.unit;
      const deltaValue = group.title === "欲" ? null : seriesDelta(series, deltaUnit);
      const isBodyWeight = group.title === "身体质量" && series.id === "body-weight";
      const cumulativeGain = data.cumulativeGainSummaryValues?.at(-1);
      const bodyWeightDelta = isBodyWeight
        ? (Number.isFinite(cumulativeGain) ? cumulativeGain : deltaValue)
        : null;
      const isAverageSummary = group.title === "欲"
        || group.title === "心率"
        || group.title === "睡眠时间带";
      const desireWeeklyMean = group.title === "欲"
        ? (() => {
          const values = series.desireDailyValues || series.values;
          const starts = weekStarts(data.dates);
          const weeklyCounts = starts.map((start, index) => {
            const end = (starts[index + 1] ?? data.dates.length) - 1;
            return values.slice(start, end + 1).reduce((sum, value) => (
              sum + (Number.isFinite(value) ? value : [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length)
            ), 0);
          });
          return weeklyCounts.length
            ? weeklyCounts.reduce((sum, value) => sum + value, 0) / weeklyCounts.length
            : 0;
        })()
        : null;
      const delta = isAverageSummary
        ? ""
        : isBodyWeight
          ? formatDelta(bodyWeightDelta, "kg")
          : formatDelta(deltaValue, deltaUnit);
      const deltaForColor = isBodyWeight ? bodyWeightDelta : deltaValue;
      const deltaClass = deltaForColor > 0 ? "is-positive" : deltaForColor < 0 ? "is-negative" : "is-neutral";
      const currentValue = group.title === "欲"
        ? desireWeeklyMean
        : isAverageSummary
          ? averageSummaryValue(series, group, data)
          : (series.latestSummaryValues?.at(-1) ?? latestValue(series));
      const valueUnit = group.title === "欲"
        ? `${group.unit}/周`
        : group.chartType === "sleep-band" && series.id === "sleep-duration"
          ? "小时"
          : group.unit;
      const current = formatValue(currentValue, valueUnit);
      const averageClass = isAverageSummary
        ? ` summary-average ${group.title === "心率" ? "summary-average-heart" : group.title === "欲" ? "summary-average-desire" : "summary-average-sleep"}`
        : "";
      const averageMark = isAverageSummary
        ? `<span class="series-average-mark">${t("average")}</span>`
        : "";
      return `<li class="series-item"><span class="series-swatch" style="background:${series.color}"></span><span class="series-name">${translate(series.label)}</span><span class="series-values${averageClass}"><span class="series-current-value">${current}</span>${averageMark}${delta ? `<span class="series-change ${deltaClass}">${delta}</span>` : ""}</span></li>`;
    })
    .join("");
  const unitLabel = group.chartType === "sleep-band"
    ? ""
    : translateUnit(group.title === "欲" ? `${group.unit}/周` : group.unit);
  const sleepButton = group.chartType === "sleep-band"
    ? `<button class="sleep-alignment-toggle${sleepBandAligned ? "" : " is-active"}" type="button" data-sleep-alignment aria-pressed="${!sleepBandAligned}" title="${t(sleepBandAligned ? "sleepAlignToActual" : "sleepAlignToDuration")}" aria-label="${t(sleepBandAligned ? "sleepAlignToActual" : "sleepAlignToDuration")}"><span class="sleep-align-icon" aria-hidden="true"><span></span><span></span></span></button>`
    : "";
  label.innerHTML = `<div class="label-title"><span class="label-title-name"><strong>${translate(group.title)}</strong>${unitLabel ? `<span class="unit-chip">${unitLabel}</span>` : ""}</span>${sleepButton}</div><ul class="series-list">${list}</ul>`;
  label.querySelector("[data-sleep-alignment]")?.addEventListener("click", () => {
    onSleepBandAlignedChange?.(!sleepBandAligned);
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
    baseHeight,
  });

  sidebarRow.append(label, axisPanel);
  chartRow.append(chartPanel);
  sidebarBody.appendChild(sidebarRow);
  body.appendChild(chartRow);

  if (group.chartType === "sleep-band") {
    createSleepBandChart({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showAllValues, aligned: sleepBandAligned, chartHeight: contentHeight });
  } else if (group.chartType === "activity") {
    createTextTimeline({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, chartHeight: contentHeight });
  } else if (group.chartType === "count-line") {
    createDesireTimeline({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, chartHeight: contentHeight });
  } else if (group.chartType === "bar") {
    createBarChart({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, chartHeight: contentHeight });
  } else {
    createLineChart({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, chartHeight: contentHeight });
  }

  return { sidebarRow, chartRow };
};
