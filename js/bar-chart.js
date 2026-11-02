import { chartConfig } from "./config.js";
import { formatDate, formatValue } from "./formatters.js";
import { t, translate, translateUnit, translateWeekday } from "./i18n.js";
import { append, makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { phaseStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const niceDomain = (group) => {
  const values = group.series.flatMap((series) => series.values).filter((value) => value !== null && value !== undefined);
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, (max - min) * 0.08);
  return [Math.max(0, min - padding), max + padding];
};

export const createBarChart = ({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, chartHeight = chartConfig.chartHeight }) => {
  const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
  const chartMargin = { ...chartConfig.chartMargin, top: phaseGap, bottom: phaseGap };
  const innerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
  const [min, max] = niceDomain(group);
  const xScale = (index) => index * cellWidth + cellWidth / 2;
  const yScale = (value) => chartMargin.top + ((max - value) / (max - min)) * innerHeight;
  const svg = makeSvg("svg", { viewBox: `0 0 ${timelineWidth} ${chartHeight}`, "aria-label": t("barChart", translate(group.title), translateUnit(group.unit)) });
  const ticks = [];
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = min + ((max - min) * tick) / 4;
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
    format: (value) => formatValue(value, group.unit),
  });

  phaseStarts(data).forEach((start) => {
    const x = start * cellWidth;
    svg.appendChild(makeSvg("line", { x1: x, y1: chartMargin.top, x2: x, y2: chartHeight - chartMargin.bottom, class: "phase-divider" }));
  });

  const dataIndexes = group.series.reduce((indexes, series) => {
    series.values.forEach((value, index) => {
      if (value !== null && value !== undefined && !indexes.includes(index)) indexes.push(index);
    });
    return indexes;
  }, []).sort((left, right) => left - right);
  const nearestDataIndex = (rawIndex) => dataIndexes.length
    ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0])
    : rawIndex;
  const hoverLine = makeSvg("line", { x1: 0, y1: chartMargin.top, x2: 0, y2: chartHeight - chartMargin.bottom, class: "hover-line" });
  const hitArea = makeSvg("rect", {
    x: 0,
    y: chartMargin.top,
    width: timelineWidth,
    height: innerHeight,
    class: "chart-hit-area",
  });
  hitArea.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const rawIndex = Math.max(0, Math.min(data.dates.length - 1, Math.round((localX - cellWidth / 2) / cellWidth)));
    const index = nearestDataIndex(rawIndex);
    setDatePreview(index);
    const date = data.dates[index];
    tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} · ${translateWeekday(date.weekday)}</div>${group.series.map((series) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${series.color}"></span><span>${translate(series.label)}</span><span class="tooltip-value">${formatValue(series.values[index], group.unit)}</span></div>`).join("")}`;
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
  append(svg, hoverLine, hitArea);

  const barWidth = Math.max(4, Math.min(14, (cellWidth - 14) / group.series.length));
  const valueNodes = [];
  group.series.forEach((series, seriesIndex) => {
    series.values.forEach((value, index) => {
      if (value === null || value === undefined) return;
      const x = xScale(index) - ((group.series.length - 1) * barWidth) / 2 + seriesIndex * barWidth;
      const y = yScale(value);
      const bar = makeSvg("rect", { x, y, width: Math.max(3, barWidth - 2), height: Math.max(2, chartHeight - chartMargin.bottom - y), rx: 2, fill: series.color, class: "data-bar" });
      bar.addEventListener("pointerenter", (event) => {
        setDatePreview(index);
        const date = data.dates[index];
        tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} · ${translateWeekday(date.weekday)}</div>${group.series.map((item) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${item.color}"></span><span>${translate(item.label)}</span><span class="tooltip-value">${formatValue(item.values[index], group.unit)}</span></div>`).join("")}`;
        positionTooltipBeside({ tooltip, event });
      });
      bar.addEventListener("pointerleave", () => {
        tooltip.style.display = "none";
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
  const updateVisibility = () => valueNodes.forEach((node) => { node.style.display = showAllValues.checked ? "" : "none"; });
  updateVisibility();
  return updateVisibility;
};
