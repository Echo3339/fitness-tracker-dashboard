import { chartConfig } from "./config.js";
import { formatClock, formatDate, formatValue, toSleepTimelineHour } from "./formatters.js";
import { t, translateWeekday } from "./i18n.js";
import { append, makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { phaseStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const sleepStart = (group) => group.series.find((series) => series.id === "sleep-onset");
const wakeTime = (group) => group.series.find((series) => series.id === "wake-time");
const sleepDuration = (group) => group.series.find((series) => series.id === "sleep-duration");
const sleepBandColor = (duration) => duration >= 9.5 ? "#5479a8" : "#8ea9c4";
const sleepBandHoverColor = (duration) => duration >= 9.5 ? "#46698f" : "#7895b0";

export const createSleepBandChart = ({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showAllValues, aligned = true, chartHeight = chartConfig.sleepChartHeight }) => {
  const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
  const sleepMargin = { ...chartConfig.sleepMargin, top: phaseGap, bottom: phaseGap };
  const sleepChartHeight = chartHeight;
  const [min, max] = aligned ? [0, 12] : group.domain;
  const innerHeight = sleepChartHeight - sleepMargin.top - sleepMargin.bottom;
  const xScale = (index) => index * cellWidth + cellWidth / 2;
  const actualPosition = (value) => {
    const normalized = (value - min) / (max - min);
    return normalized ** 1.35;
  };
  const yScale = (value) => aligned
    ? sleepChartHeight - sleepMargin.bottom - ((value - min) / (max - min)) * innerHeight
    : sleepMargin.top + actualPosition(value) * innerHeight;
  const bandWidth = Math.max(1, Math.min(12, cellWidth * 0.72));
  const sleepLabelMode = cellWidth >= 18 ? "full" : cellWidth >= 9 ? "compact" : "sparse";
  const sleepLabelStride = sleepLabelMode === "sparse" ? Math.max(1, Math.ceil(14 / Math.max(cellWidth, 1))) : 1;
  const svg = makeSvg("svg", {
    viewBox: `0 0 ${timelineWidth} ${sleepChartHeight}`,
    "aria-label": t("sleepChart"),
  });
  const onset = sleepStart(group);
  const wake = wakeTime(group);
  const duration = sleepDuration(group);
  const dataIndexes = data.dates.reduce((indexes, _, index) => {
    if (toSleepTimelineHour(onset.values[index]) !== null && toSleepTimelineHour(wake.values[index]) !== null) indexes.push(index);
    return indexes;
  }, []);
  const nearestDataIndex = (rawIndex) => dataIndexes.length
    ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0])
    : rawIndex;
  const guideTime = aligned ? null : 31.5;
  const guideTimes = new Set(guideTime === null ? [] : [guideTime]);
  const majorTicks = aligned
    ? [0, 2, 4, 6, 8, 10, 12]
    : [22, 25, 28, 31.5, 35, 37];
  const axisTicks = [];
  [...new Set([...majorTicks, ...guideTimes])].sort((a, b) => a - b).forEach((value) => {
    const y = yScale(value);
    const isGuide = value !== null && guideTimes.has(value);
    const line = makeSvg("line", {
      x1: 0,
      y1: y,
      x2: timelineWidth,
      y2: y,
      class: `axis-line${isGuide ? " sleep-guide-line" : ""}`,
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
    yPosition: aligned ? undefined : actualTickPosition,
    classes: "sleep-axis-label",
    format: (value) => aligned
      ? `${String(value).padStart(2, "0")}h`
      : ({
        22: "22:00",
        25: "01:00",
        28: "04:00",
        31.5: "07:30",
        35: "11:00",
        37: "13:00",
      }[value] || `${String(value).padStart(2, "0")}:00`),
  });
  if (aligned) {
    svg.appendChild(makeSvg("line", {
      x1: 0,
      y1: yScale(0),
      x2: timelineWidth,
      y2: yScale(0),
      class: "sleep-aligned-baseline",
    }));
  }

  phaseStarts(data).forEach((start) => {
    const x = start * cellWidth;
    svg.appendChild(makeSvg("line", { x1: x, y1: sleepMargin.top, x2: x, y2: sleepChartHeight - sleepMargin.bottom, class: "phase-divider" }));
  });

  const hoverLine = makeSvg("line", { x1: 0, y1: sleepMargin.top, x2: 0, y2: sleepChartHeight - sleepMargin.bottom, class: "hover-line" });
  const hitArea = makeSvg("rect", {
    x: 0,
    y: sleepMargin.top,
    width: timelineWidth,
    height: innerHeight,
    class: "chart-hit-area",
  });
  const showTooltip = (event, index) => {
    const start = toSleepTimelineHour(onset.values[index]);
    const end = toSleepTimelineHour(wake.values[index]);
    const durationValue = duration.values[index] ?? (start !== null && end !== null ? end - start : null);
    tooltip.innerHTML = `<div class="tooltip-date">${formatDate(data.dates[index].date)} · ${translateWeekday(data.dates[index].weekday)}</div><div class="tooltip-line"><span>${t("sleepOnset")}</span><span class="tooltip-value">${formatClock(onset.values[index])}</span></div><div class="tooltip-line"><span>${t("wakeTime")}</span><span class="tooltip-value">${formatClock(wake.values[index])}</span></div><div class="tooltip-line"><span>${t("sleepDuration")}</span><span class="tooltip-value">${formatValue(durationValue, "小时")}</span></div>`;
    const rect = svg.getBoundingClientRect();
    positionTooltipBeside({
      tooltip,
      event,
      anchorX: rect.left + xScale(index) * (rect.width / timelineWidth),
    });
  };
  hitArea.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const rawIndex = Math.max(0, Math.min(data.dates.length - 1, Math.round((localX - cellWidth / 2) / cellWidth)));
    const index = nearestDataIndex(rawIndex);
    setDatePreview(index);
    showTooltip(event, index);
    const x = xScale(index);
    hoverLine.setAttribute("x1", x);
    hoverLine.setAttribute("x2", x);
    hoverLine.style.opacity = "1";
  });
  hitArea.addEventListener("pointerleave", () => {
    tooltip.style.display = "none";
    hoverLine.style.opacity = "0";
    setDatePreview(null);
  });
  append(svg, hoverLine, hitArea);

  data.dates.forEach((_, index) => {
    const start = toSleepTimelineHour(onset.values[index]);
    const end = toSleepTimelineHour(wake.values[index]);
    if (start === null || end === null) return;
    const durationValue = duration.values[index] ?? end - start;
    if (!Number.isFinite(durationValue)) return;
    const top = aligned ? yScale(durationValue) : yScale(Math.min(start, end));
    const bottom = aligned
      ? yScale(0)
      : yScale(Math.max(start, end));
    const bar = makeSvg("rect", {
      x: xScale(index) - bandWidth / 2,
      y: top,
      width: bandWidth,
      height: Math.max(8, bottom - top),
      rx: bandWidth / 2,
      fill: sleepBandColor(durationValue),
      class: "sleep-band",
    });
    bar.style.setProperty("--sleep-band-hover", sleepBandHoverColor(durationValue));
    bar.addEventListener("pointerenter", (event) => {
      setDatePreview(index);
      showTooltip(event, index);
    });
    bar.addEventListener("pointerleave", () => {
      tooltip.style.display = "none";
      setDatePreview(null);
    });
    svg.appendChild(bar);

    if (showAllValues.checked && index % sleepLabelStride === 0) {
      const valueLabel = makeSvg("text", {
        x: xScale(index) + (sleepLabelMode === "full" ? 9 : 0),
        y: top + 4,
        class: `sleep-value-label ${sleepLabelMode}`,
        "text-anchor": sleepLabelMode === "full" ? "start" : "middle",
      });
      valueLabel.textContent = `${(Math.round((end - start) * 10) / 10).toFixed(1)}h`;
      svg.appendChild(valueLabel);
    }
  });

  chartPanel.classList.add("sleep-chart-panel");
  chartPanel.classList.toggle("is-duration-aligned", aligned);
  chartPanel.appendChild(svg);
};
