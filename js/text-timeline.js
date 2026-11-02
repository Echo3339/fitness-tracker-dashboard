import { chartConfig } from "./config.js";
import { formatDate, formatValue } from "./formatters.js";
import { t, translate, translateWeekday } from "./i18n.js";
import { append, makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { phaseStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const textLines = (value) => String(value).split(/\r?\n/).filter(Boolean);

export const createTextTimeline = ({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, chartHeight = chartConfig.textChartHeight }) => {
  const axisOffset = 0;
  const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || 15;
  const centerY = Math.round(chartHeight / 2);
  const xScale = (index) => index * cellWidth + cellWidth / 2;
  const svg = makeSvg("svg", {
    viewBox: `0 0 ${timelineWidth} ${chartHeight}`,
    "aria-label": t("textTimeline", translate(group.title)),
  });
  renderAxis({ axisPanel, height: chartHeight, top: phaseGap, bottom: phaseGap, min: 0, max: 1, ticks: [] });
  const baseline = makeSvg("line", {
    x1: axisOffset,
    y1: centerY,
    x2: timelineWidth,
    y2: centerY,
    class: "text-timeline-baseline",
  });
  const phaseDividers = phaseStarts(data).map((start) => makeSvg("line", {
    x1: start * cellWidth,
    y1: phaseGap,
    x2: start * cellWidth,
    y2: chartHeight - phaseGap,
    class: "phase-divider",
  }));
  const markers = [];
  const displayValues = group.series.map((series) => ({
    series,
    values: series.values.map((value) => {
      if (group.chartType === "activity" && series.id === "running-duration") {
        return formatValue(value, "小时");
      }
      return value;
    }),
  }));

  displayValues.forEach(({ series, values }, seriesIndex) => {
    const laneY = group.chartType === "activity"
      ? Math.round((seriesIndex + 1) * chartHeight / (displayValues.length + 1))
      : centerY;
    values.forEach((value, index) => {
      if (value === null || value === undefined) return;
      const x = xScale(index);
      const lines = textLines(value);
      const text = makeSvg("text", {
        x,
        y: laneY - ((lines.length - 1) * 7),
        class: "text-timeline-value",
        fill: series.color,
        "text-anchor": "middle",
      });
      lines.forEach((line, lineIndex) => {
        const tspan = makeSvg("tspan", {
          x,
          dy: lineIndex === 0 ? 0 : 14,
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
    class: "hover-line",
  });
  const hitArea = makeSvg("rect", {
    x: 0,
    y: 0,
    width: timelineWidth,
    height: chartHeight,
    class: "text-timeline-hit-area",
  });

  append(svg, baseline, ...phaseDividers, hoverLine, hitArea);
  chartPanel.appendChild(svg);

  const dataIndexes = [...new Set(markers.map(({ index }) => index))];
  const nearestDataIndex = (rawIndex) => dataIndexes.length
    ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0])
    : rawIndex;

  hitArea.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const rawIndex = Math.max(0, Math.min(
      data.dates.length - 1,
      Math.round((localX - cellWidth / 2) / cellWidth),
    ));
    const index = nearestDataIndex(rawIndex);
    setDatePreview(index);
    const date = data.dates[index];
    const lines = group.series.map((series) => {
      const value = series.values[index];
      return `<div class="tooltip-line"><span class="tooltip-dot" style="background:${series.color}"></span><span>${escapeHtml(translate(series.label))}</span><span class="tooltip-value">${value == null ? "—" : escapeHtml(value).replaceAll("\n", " / ")}</span></div>`;
    }).join("");
    tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} · ${escapeHtml(translateWeekday(date.weekday))}</div>${lines}`;
    const x = xScale(index);
    hoverLine.setAttribute("x1", x);
    hoverLine.setAttribute("x2", x);
    hoverLine.style.opacity = "1";
    positionTooltipBeside({
      tooltip,
      event,
      anchorX: rect.left + x * (rect.width / timelineWidth),
    });
  });
  hitArea.addEventListener("pointerleave", () => {
    tooltip.style.display = "none";
    hoverLine.style.opacity = "0";
    setDatePreview(null);
  });
};
