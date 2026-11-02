import { makeSvg } from "./svg.js";

const readAxisWidth = () => {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--axis-offset"));
  return Number.isFinite(value) && value > 0 ? value : 44;
};

const normalizeTicks = ({ min, max, step, ticks }) => {
  if (Array.isArray(ticks)) return ticks;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) return [];
  const values = [];
  for (let value = min; value <= max + step / 2; value += step) {
    values.push(Number(value.toFixed(8)));
  }
  return values;
};

export const renderAxis = ({
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
  skipLine = () => false,
}) => {
  axisPanel.replaceChildren();
  const width = readAxisWidth();
  const safeHeight = Math.max(1, Number(height) || 1);
  const safeTop = Math.max(0, Number(top) || 0);
  const safeBottom = Math.max(0, Number(bottom) || 0);
  const plotHeight = Math.max(1, safeHeight - safeTop - safeBottom);
  const range = Math.max(0.000001, Number(max) - Number(min));
  const yScale = typeof yPosition === "function"
    ? (value) => yPosition(Number(value))
    : (value) => safeTop + ((Number(max) - Number(value)) / range) * plotHeight;
  const svg = makeSvg("svg", {
    viewBox: `0 0 ${width} ${safeHeight}`,
    width,
    height: safeHeight,
    "aria-hidden": "true",
  });
  svg.appendChild(makeSvg("line", {
    x1: width - 0.5,
    y1: safeTop,
    x2: width - 0.5,
    y2: safeHeight - safeBottom,
    class: "axis-spine",
  }));
  normalizeTicks({ min, max, step, ticks }).forEach((value) => {
    const y = yScale(value);
    const label = makeSvg("text", {
      x: width - 5,
      y: y + 4,
      class: classes,
      "text-anchor": "end",
    });
    label.textContent = format(value);
    svg.appendChild(label);
  });
  axisPanel.appendChild(svg);
  return { yScale, width };
};

export const clearAxis = (axisPanel, height = 1) => {
  axisPanel.replaceChildren();
  axisPanel.appendChild(makeSvg("svg", {
    viewBox: `0 0 ${readAxisWidth()} ${Math.max(1, height)}`,
    width: readAxisWidth(),
    height: Math.max(1, height),
    "aria-hidden": "true",
  }));
};
