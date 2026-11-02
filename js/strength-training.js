import { chartConfig } from "./config.js";
import { formatDate, formatDelta, formatTrainingMax, formatTrainingSet, formatTrainingVolume, trainingDelta } from "./formatters.js";
import { getLanguage, t, translate, translateWeekday } from "./i18n.js";
import { append, makeSvg } from "./svg.js";
import { positionTooltipBeside } from "./tooltip.js";
import { phaseStarts } from "./timeline-grid.js";
import { renderAxis } from "./axis.js";
import { setDatePreview } from "./date-preview.js";

const formatWeight = (value) => {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const getTrainingDomain = (training) => {
  const values = training.flatMap((action) => action.values)
    .map((entry) => entry?.maxWeight)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return { axisMin: 0, axisMax: 10, step: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const magnitude = 10 ** Math.floor(Math.log10(range / 5));
  const normalized = (range / 5) / magnitude;
  const step = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
  const axisMin = Math.max(0, Math.floor(min / step) * step);
  const axisMax = Math.ceil(max / step) * step;
  return { axisMin, axisMax, step };
};

const renderTrainingAction = (action, entry) => {
  if (!entry) {
    return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div>`;
  }
  if (action.kind === "bodyweight") {
    const bodyweightLabel = getLanguage() === "zh" ? "自重" : "Bodyweight";
    return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div><div class="tooltip-line"><span>${t("maxReps")}</span><span class="tooltip-value">${entry.maxReps ?? "—"}${entry.maxReps == null ? "" : "次"}</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${bodyweightLabel} × ${entry.maxReps ?? "—"} × ${entry.setCount ?? "—"}</span></div>`;
  }
  if (action.kind === "weighted-chin-up") {
    return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span><span>${translate(action.label)}</span></div><div class="tooltip-line"><span>${getLanguage() === "zh" ? "负重" : "Load"}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg</span></div><div class="tooltip-line"><span>${t("maxReps")}</span><span class="tooltip-value">${entry.maxReps ?? "—"}${entry.maxReps == null ? "" : "次"}</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg × ${entry.maxReps ?? "—"} × ${entry.setCount ?? "—"}</span></div>`;
  }
  return `<div class="tooltip-training-title"><span class="tooltip-dot" style="background:${action.color}"></span>${translate(action.label)}</div><div class="tooltip-line"><span>${t("maxWeight")}</span><span class="tooltip-value">${formatWeight(entry.maxWeight)} kg</span></div><div class="tooltip-line"><span>${t("totalVolume")}</span><span class="tooltip-value">${formatTrainingVolume(entry.totalVolume)} kg</span></div><div class="tooltip-line"><span>${t("formalSet")}</span><span class="tooltip-value">${formatTrainingSet(entry.formalSet)}</span></div>`;
};

const getTrainingCardWidths = (training) => {
  const measureHost = document.createElement("div");
  measureHost.className = "tooltip is-training-tooltip";
  measureHost.style.cssText = "position:absolute;left:-100000px;top:0;width:max-content;max-width:none;visibility:hidden;display:block;";
  document.body.appendChild(measureHost);
  const widths = new Map();
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

const getTrainingPanelWidth = (training, cardWidths) => {
  const findAction = (label) => training.find((action) => action.label === label);
  const rows = [
    [findAction("深蹲")],
    [findAction("卧推"), findAction("推举")],
    [findAction("硬拉"), findAction("高翻"), findAction("自重反手引体向上"), findAction("负重反手引体向上")],
  ];
  return Math.max(...rows.map((actions) => {
    const visibleActions = actions.filter(Boolean);
    return visibleActions.reduce((total, action) => total + (cardWidths.get(action) || 0), 0)
      + Math.max(0, visibleActions.length - 1) * 8;
  }), 0);
};

const createTooltip = ({ tooltip, training, data, index, cardWidths }) => {
  const date = data.dates[index];
  const renderAction = (action) => {
    const entry = action.values[index];
    return renderTrainingAction(action, entry);
  };
  const findAction = (label) => training.find((action) => action.label === label);
  const bodyweightAction = findAction("自重反手引体向上");
  const weightedAction = findAction("负重反手引体向上");
  const renderCard = (actions, className = "") => {
    const visibleActions = actions.filter(Boolean);
    const isEmpty = visibleActions.length === 0 || visibleActions.every((action) => !action.values[index]);
    const action = visibleActions[0];
    const width = isEmpty ? cardWidths.emptyWidth : action ? cardWidths.get(action) : null;
    const widthStyle = width ? `min-width:${width}px` : "";
    return `<section class="tooltip-training-card${isEmpty ? " is-empty" : ""} ${className}"${widthStyle ? ` style="${widthStyle}"` : ""}>${visibleActions.map(renderAction).join("")}</section>`;
  };
  const sortActions = (actions) => [...actions]
    .sort((left, right) => Number(Boolean(right?.values[index])) - Number(Boolean(left?.values[index])));
  const renderRow = (actions) => sortActions(actions)
    .map((action) => renderCard([action]))
    .join("");
  const alignedFirstColumnWidth = Math.max(
    cardWidths.get(findAction("卧推")) || 0,
    cardWidths.get(findAction("推举")) || 0,
    cardWidths.get(findAction("硬拉")) || 0,
    cardWidths.emptyWidth || 0,
  );
  const getRowStyle = (actions, alignFirstColumn = false) => {
    const sortedActions = sortActions(actions);
    if (sortedActions.length === 1) return "grid-template-columns:minmax(0, 1fr)";
    return `grid-template-columns:${sortedActions.map((action, actionIndex) => {
      if (alignFirstColumn && actionIndex === 0) return `${alignedFirstColumnWidth}px`;
      return action.values[index]
        ? `${cardWidths.get(action)}px`
        : `minmax(${cardWidths.emptyWidth}px, 1fr)`;
    }).join(" ")}`;
  };
  tooltip.style.width = `${getTrainingPanelWidth(training, cardWidths) + 32}px`;
  const squatActions = [findAction("深蹲")];
  const pressActions = [findAction("卧推"), findAction("推举")];
  const pullActions = [findAction("硬拉"), findAction("高翻"), bodyweightAction, weightedAction];
  tooltip.innerHTML = `<div class="tooltip-date">${formatDate(date.date)} · ${translateWeekday(date.weekday)}</div><div class="tooltip-training-grid${training.some((action) => !action.values[index]) ? " has-empty-actions" : ""}"><div class="tooltip-training-row tooltip-training-row-one" style="${getRowStyle(squatActions)}">${renderRow(squatActions)}</div><div class="tooltip-training-row tooltip-training-row-two" style="${getRowStyle(pressActions, true)}">${renderRow(pressActions)}</div><div class="tooltip-training-row tooltip-training-row-three" style="${getRowStyle(pullActions, true)}">${renderRow(pullActions)}</div></div>`;
  tooltip.classList.add("is-training-tooltip");
  tooltip.style.display = "block";
  const trainingGrid = tooltip.querySelector(".tooltip-training-grid");
  trainingGrid.classList.remove("has-card-height");
  trainingGrid.style.removeProperty("--training-card-height");
  return () => {
    const cards = [...trainingGrid.querySelectorAll(".tooltip-training-card")];
    const previousCardHeights = cards.map((card) => card.style.height);
    cards.forEach((card) => { card.style.height = "auto"; });
    const ordinaryCardHeight = Math.max(...cards.map((card) => card.getBoundingClientRect().height), 0);
    cards.forEach((card, index) => { card.style.height = previousCardHeights[index]; });
    if (ordinaryCardHeight > 0) {
      trainingGrid.classList.add("has-card-height");
      trainingGrid.style.setProperty("--training-card-height", `${ordinaryCardHeight}px`);
    }
  };
};

export const createTrainingRows = ({ training, data, body, sidebarBody, tooltip, cellWidth, timelineWidth, showPoints, showAllValues, focusRowHeight = chartConfig.trainingChartHeight }) => {
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
    const deltaValue = trainingDelta(action, data);
    const deltaUnit = action.kind === "bodyweight" ? "次" : "kg";
    const isBodyweight = action.kind === "bodyweight";
    const hasBodyweightRecord = action.values.some(Boolean) || Boolean(action.summaryValues?.some(Boolean));
    const delta = isBodyweight
      ? (hasBodyweightRecord ? (getLanguage() === "zh" ? "自重" : "Bodyweight") : "")
      : formatDelta(deltaValue, deltaUnit);
    const deltaClass = isBodyweight
      ? "is-bodyweight"
      : deltaValue > 0 ? "is-positive" : deltaValue < 0 ? "is-negative" : "is-neutral";
    return `<li class="series-item"><span class="series-swatch" style="background:${action.color}"></span><span class="series-name">${translate(action.label)}</span><span class="series-values"><span class="series-current-value">${formatTrainingMax(action, data)}</span>${delta ? `<span class="series-change ${deltaClass}">${delta}</span>` : ""}</span></li>`;
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
  sidebarBody.appendChild(sidebarRow);
  body.appendChild(row);

  const trainingMargin = { ...chartConfig.trainingMargin, top: phaseGap, bottom: phaseGap };
  const trainingChartHeight = rowHeight;
  const plotHeight = trainingChartHeight - trainingMargin.top - trainingMargin.bottom;
  const { axisMin, axisMax, step } = getTrainingDomain(training);
  const xScale = (index) => index * cellWidth + cellWidth / 2;
  const yScale = (value) => trainingMargin.top + ((axisMax - value) / (axisMax - axisMin)) * plotHeight;
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
  phaseStarts(data).forEach((start) => {
    const x = start * cellWidth;
    svg.appendChild(makeSvg("line", { x1: x, y1: trainingMargin.top, x2: x, y2: trainingChartHeight - trainingMargin.bottom, class: "phase-divider" }));
  });

  const seriesNodes = [];
  const dataIndexes = training.reduce((indexes, action) => {
    action.values.forEach((entry, index) => {
      if (entry && !indexes.includes(index)) indexes.push(index);
    });
    return indexes;
  }, []).sort((left, right) => left - right);
  const nearestDataIndex = (rawIndex) => dataIndexes.length
    ? dataIndexes.reduce((nearest, index) => Math.abs(index - rawIndex) < Math.abs(nearest - rawIndex) ? index : nearest, dataIndexes[0])
    : rawIndex;
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
    const rawIndex = Math.max(0, Math.min(data.dates.length - 1, Math.round((localX - cellWidth / 2) / cellWidth)));
    const index = nearestDataIndex(rawIndex);
    setDatePreview(index);
    const prepareTrainingTooltip = createTooltip({ tooltip, training, data, index, cardWidths });
    const x = xScale(index);
    hoverLine.setAttribute("x1", x);
    hoverLine.setAttribute("x2", x);
    hoverLine.style.opacity = "1";
    positionTooltipBeside({
      tooltip,
      event,
      anchorX: rect.left + x * (rect.width / timelineWidth),
      flipVertically: false,
      prepareLayout: prepareTrainingTooltip,
    });
  });
  hitArea.addEventListener("pointerleave", () => {
    tooltip.style.display = "none";
    hoverLine.style.opacity = "0";
    setDatePreview(null);
  });

  const updateVisibility = () => {
    seriesNodes.forEach(({ pathNodes, pointNodes, valueNodes }) => {
      pathNodes.forEach((path) => {
        path.style.display = showPoints.checked ? "none" : "";
      });
      pointNodes.forEach((point) => { point.style.display = showPoints.checked ? "" : "none"; });
      valueNodes.forEach((value) => { value.style.display = showAllValues.checked ? "" : "none"; });
    });
  };
  updateVisibility();
};
