import { chartConfig } from "./config.js";
import { formatDate } from "./formatters.js";
import { t, translate, translateWeekday } from "./i18n.js";
import { makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { weekStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const countSymbols = (value) => [...String(value ?? "")].filter((character) => !/\s/u.test(character)).length;
const countLabel = (value) => `${Number.isFinite(value) ? value : 0}`;

const createWeeklyPeriods = (series, dates) => {
  const starts = weekStarts(dates);
  const dailyValues = series.desireDailyValues || series.values;
  return starts.map((start, index) => {
    const end = (starts[index + 1] ?? dates.length) - 1;
    const value = dailyValues
      .slice(start, end + 1)
      .reduce((total, item) => total + countSymbols(item), 0);
    return { start, end, value, week: index };
  });
};

export const createDesireTimeline = ({ group, data, chartPanel, axisPanel, tooltip, cellWidth, timelineWidth, chartHeight = chartConfig.desireChartHeight }) => {
  const chartHeightValue = chartHeight;
  const left = 0;
  const phaseGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--phase-gap")) || 15;
  const top = phaseGap;
  const baseline = chartHeightValue - phaseGap - 7;
  const series = group.series[0];
  const periods = createWeeklyPeriods(series, data.dates);
  const maxValue = Math.max(1, ...periods.map(({ value }) => value));
  const svg = makeSvg("svg", {
    viewBox: `0 0 ${timelineWidth} ${chartHeightValue}`,
    "aria-label": t("textTimeline", translate(group.title)),
    fill: "none",
  });
  renderAxis({ axisPanel, height: chartHeightValue, top: phaseGap, bottom: phaseGap, min: 0, max: 1, ticks: [] });

  const selectedBand = makeSvg("rect", {
    x: left,
    y: top,
    width: cellWidth,
    height: chartHeightValue - top - phaseGap,
    class: "desire-week-selection",
    visibility: "hidden",
    fill: "#707e84",
    "fill-opacity": "0.08",
  });
  svg.appendChild(selectedBand);

  periods.forEach(({ start, end, value, week }) => {
    const x = left + start * cellWidth;
    const width = Math.max(cellWidth, (end - start + 1) * cellWidth);
    const center = x + width / 2;
    const density = width >= 68 ? "full" : width >= 42 ? "compact" : "minimal";
    const barWidth = value > 0
      ? Math.max(4, Math.min(width * 0.58, (value / maxValue) * 34))
      : 4;
    const barY = baseline + 3;
    const bar = makeSvg("rect", {
      x: center - barWidth / 2,
      y: barY,
      width: barWidth,
      height: 6,
      rx: 3,
      class: value > 0 ? "desire-period-bar" : "desire-period-bar is-zero",
      "data-week": week,
    });
    const title = makeSvg("title");
    title.textContent = `${countLabel(value)}`;
    bar.appendChild(title);
    svg.appendChild(bar);

    const pointY = baseline - (value / maxValue) * 46;
    const point = makeSvg("circle", {
      cx: center,
      cy: pointY,
      r: 3.2,
      class: "desire-period-point",
      "data-week": week,
    });
    svg.appendChild(point);

    if (density !== "minimal") {
      const valueLabel = makeSvg("text", {
        x: center,
        y: Math.max(14, pointY - 8),
        class: "desire-period-value",
        "text-anchor": "middle",
        "data-week": week,
      });
      valueLabel.textContent = countLabel(value);
      svg.appendChild(valueLabel);
    }
  });

  const linePoints = periods.map(({ start, end, value }) => {
    const width = Math.max(cellWidth, (end - start + 1) * cellWidth);
    const center = left + start * cellWidth + width / 2;
    const y = baseline - (value / maxValue) * 46;
    return `${center.toFixed(2)},${y.toFixed(2)}`;
  });
  if (linePoints.length > 1) {
    svg.insertBefore(makeSvg("polyline", {
      points: linePoints.join(" "),
      class: "desire-period-line",
    }), svg.children[1] || null);
  }

  svg.appendChild(makeSvg("line", {
    x1: left,
    y1: baseline,
    x2: timelineWidth,
    y2: baseline,
    class: "desire-value-rule",
  }));
  svg.dataset.density = periods.length
    ? (periods[0].end - periods[0].start + 1) * cellWidth >= 68 ? "full"
      : (periods[0].end - periods[0].start + 1) * cellWidth >= 42 ? "compact" : "minimal"
    : "minimal";

  const hoverLine = makeSvg("line", {
    x1: 0,
    y1: top,
    x2: 0,
    y2: chartHeightValue - phaseGap,
    class: "hover-line",
  });
  const hitArea = makeSvg("rect", {
    x: left,
    y: 0,
    width: timelineWidth,
    height: chartHeightValue,
    class: "desire-timeline-hit-area",
    fill: "none",
    "pointer-events": "all",
  });
  svg.append(hoverLine, hitArea);
  chartPanel.appendChild(svg);

  let selectedWeek = -1;
  let touchSelection = false;
  const selectWeekAtPointer = (event) => {
    const rect = svg.getBoundingClientRect();
    const rawIndex = Math.max(0, Math.min(
      data.dates.length - 1,
      Math.round((event.clientX - rect.left - cellWidth / 2) / cellWidth),
    ));
    const period = periods.find(({ start, end }) => rawIndex >= start && rawIndex <= end);
    if (!period) return;
    const { start, end, value, week } = period;
    setDatePreview(rawIndex);
    const x = left + start * cellWidth;
    const anchor = x + ((end - start + 1) * cellWidth) / 2;
    const previewX = left + rawIndex * cellWidth + cellWidth / 2;
    if (selectedWeek !== week) {
      selectedWeek = week;
      selectedBand.setAttribute("x", x);
      selectedBand.setAttribute("width", Math.max(cellWidth, (end - start + 1) * cellWidth));
      selectedBand.setAttribute("visibility", "visible");
    }
    const date = data.dates[start];
    tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)}–${formatDate(data.dates[end].date)}</div><div class="tooltip-line"><span>${translate(series.label)}</span><span class="tooltip-value">${countLabel(value)}</span></div>`;
    hoverLine.setAttribute("x1", previewX);
    hoverLine.setAttribute("x2", previewX);
    hoverLine.style.opacity = "1";
    positionTooltipBeside({
      tooltip,
      event,
      anchorX: rect.left + anchor * (rect.width / timelineWidth),
      horizontalGap: 48,
      flipVertically: false,
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
    tooltip.style.display = "none";
    hoverLine.style.opacity = "0";
    selectedBand.setAttribute("visibility", "hidden");
    selectedWeek = -1;
    setDatePreview(null);
  });
};
