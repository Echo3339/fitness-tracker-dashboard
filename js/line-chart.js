import { chartConfig } from "./config.js";
import { formatDate, formatValue } from "./formatters.js";
import { t, translate, translateUnit, translateWeekday } from "./i18n.js";
import { append, buildPath, makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { phaseStarts, weekStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const negativeGrowthColor = "#2f8b70";

const niceStep = (rough) => {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
};

const niceDomain = (group) => {
  const values = group.series.flatMap((series) => series.values).filter((value) => value !== null && value !== undefined);
  if (!values.length) return { min: 0, max: 1, step: 0.25 };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = Math.max(0.01, dataMax - dataMin);
  const step = niceStep(span / 5);
  const min = Math.max(0, Math.floor(dataMin / step) * step);
  const max = Math.ceil(dataMax / step) * step;
  return { min, max: max === min ? min + step : max, step };
};

const valueColor = (group, series, value) => (
  group.title === "增重速度" && value < 0 ? negativeGrowthColor : series.color
);

export const createLineChart = ({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, chartHeight = chartConfig.chartHeight }) => {
  const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || chartConfig.phaseGap;
  const chartMargin = { ...chartConfig.chartMargin, top: phaseGap, bottom: phaseGap };
  const innerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
  const chartGroup = {
    ...group,
    series: group.series.map((series) => ({
      ...series,
      values: series.values.map((value) => (
        Number.isFinite(value) && value < 0 ? null : value
      )),
    })),
  };
  const { min, max, step } = niceDomain(chartGroup);
  const xScale = (index) => index * cellWidth + cellWidth / 2;
  const yScale = (value) => chartMargin.top + ((max - value) / (max - min)) * innerHeight;
  const valueLabelY = (value) => Math.max(chartMargin.top + 12, Math.min(chartHeight - chartMargin.bottom - 4, yScale(value) - 8));
  const svg = makeSvg("svg", {
    viewBox: `0 0 ${timelineWidth} ${chartHeight}`,
    "aria-label": t("lineChart", translate(group.title), translateUnit(group.unit)),
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
    format: (value) => formatValue(value, group.unit),
  });

  phaseStarts(data).forEach((start) => {
    const x = start * cellWidth;
    svg.appendChild(makeSvg("line", { x1: x, y1: chartMargin.top, x2: x, y2: chartHeight - chartMargin.bottom, class: "phase-divider" }));
  });
  weekStarts(data.dates).slice(1).forEach((start) => {
    if (phaseStarts(data).includes(start)) return;
    const x = start * cellWidth;
    svg.appendChild(makeSvg("line", {
      x1: x,
      y1: chartMargin.top,
      x2: x,
      y2: chartHeight - chartMargin.bottom,
      class: "week-divider",
    }));
  });

  const seriesNodes = [];
  chartGroup.series.forEach((series) => {
    const pathNodes = [];
    if (series.pointOnly) {
      // Point-only series intentionally omit the connecting path.
    } else if (chartGroup.title === "增重速度") {
      const validValues = series.values
        .map((value, index) => (value === null || value === undefined ? null : { value, index }))
        .filter(Boolean);
      for (let index = 1; index < validValues.length; index += 1) {
        const previous = validValues[index - 1];
        const current = validValues[index];
        const startX = xScale(previous.index);
        const startY = yScale(previous.value);
        const endX = xScale(current.index);
        const endY = yScale(current.value);
        const crossesZero = (previous.value < 0 && current.value > 0) || (previous.value > 0 && current.value < 0);
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
    class: "chart-hit-area",
  });
  append(svg, hoverLine, hitArea);
  chartPanel.appendChild(svg);

  const dataIndexes = chartGroup.series.reduce((indexes, series) => {
    series.values.forEach((value, index) => {
      if (value !== null && value !== undefined && !indexes.includes(index)) indexes.push(index);
    });
    return indexes;
  }, []).sort((left, right) => left - right);
  const nearestDataIndex = (rawIndex) => dataIndexes.length
    ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0])
    : rawIndex;

  const updateVisibility = () => {
    seriesNodes.forEach(({ pathNodes, pointNodes, valueNodes, pointOnly }) => {
      pathNodes.forEach((path) => {
        path.style.display = showPoints.checked ? "none" : "";
      });
      pointNodes.forEach((point) => {
        point.style.display = pointOnly || showPoints.checked ? "" : "none";
      });
      valueNodes.forEach((value) => {
        value.style.display = showAllValues.checked ? "" : "none";
      });
    });
  };

  hitArea.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const rawIndex = Math.max(0, Math.min(data.dates.length - 1, Math.round((localX - cellWidth / 2) / cellWidth)));
    const index = nearestDataIndex(rawIndex);
    setDatePreview(index);
    const date = data.dates[index];
    tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} · ${translateWeekday(date.weekday)}</div>${chartGroup.series.map((series) => `<div class="tooltip-line"><span class="tooltip-dot" style="background:${valueColor(chartGroup, series, series.values[index])}"></span><span>${translate(series.label)}</span><span class="tooltip-value">${formatValue(series.values[index], chartGroup.unit)}</span></div>`).join("")}`;
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

  updateVisibility();
  return updateVisibility;
};
