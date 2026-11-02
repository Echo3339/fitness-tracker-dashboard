import { formatDate } from "./formatters.js";
import { t, translatePhaseTitle, translateWeekday } from "./i18n.js";
import { weekStarts } from "./timeline-grid.js";

const textWidth = (text, font, letterSpacing) => {
  const context = document.createElement("canvas").getContext("2d");
  context.font = font;
  return context.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
};

export const renderTimelineHeader = ({ data, monthTrack, weekTrack, phaseTrack, dateTrack }) => {
  const hasDateValue = (index) => (
    data.groups.some((group) => group.series?.some((series) => series.values?.[index] != null))
    || data.training.some((action) => action.values?.[index] != null)
  );
  const monthGroups = new Map();
  data.dates.forEach((item, index) => {
    const key = item.date.slice(0, 7);
    if (!monthGroups.has(key)) monthGroups.set(key, []);
    monthGroups.get(key).push(index);
  });
  monthGroups.forEach((indexes, key) => {
    const monthEl = document.createElement("div");
    monthEl.className = "month-cell";
    monthEl.dataset.start = indexes[0];
    monthEl.dataset.end = indexes.at(-1);
    monthEl.style.gridColumn = `${indexes[0] + 1} / ${indexes.at(-1) + 2}`;
    monthEl.textContent = t("monthLabel", Number(key.slice(5)));
    monthTrack.appendChild(monthEl);
  });

  const starts = weekStarts(data.dates);
  starts.map((start, index) => ({
    start,
    end: (starts[index + 1] ?? data.dates.length) - 1,
    index,
  })).forEach(({ start, end, index }) => {
    const weekEl = document.createElement("div");
    weekEl.className = "week-cell";
    weekEl.dataset.start = start;
    weekEl.dataset.end = end;
    weekEl.style.gridColumn = `${start + 1} / ${end + 2}`;
    const weekLabel = t("weekLabel", index + 1);
    const weekNumber = String(index + 1);
    const [prefix, suffix = ""] = weekLabel.split(weekNumber);
    weekEl.innerHTML = `<span class="week-prefix">${prefix}</span><span class="week-number">${weekNumber}</span><span class="week-suffix">${suffix}</span>`;
    weekTrack.appendChild(weekEl);
  });
  (data.phaseCells || data.phases).forEach((phase) => {
    const phaseEl = document.createElement("div");
    phaseEl.className = "phase-cell";
    phaseEl.dataset.start = phase.start;
    phaseEl.dataset.end = phase.end;
    phaseEl.style.gridColumn = `${phase.start + 1} / ${phase.end + 2}`;
    phaseEl.style.background = phase.background || phase.color;
    const phaseTitle = translatePhaseTitle(phase.title);
    phaseEl.title = phaseTitle;
    phaseEl.setAttribute("aria-label", phaseTitle);
    const phaseNumber = String(phase.title).match(/^\s*(\d+)\s*[.、：:]/)?.[1] || "";
    const numberEl = document.createElement("span");
    numberEl.className = "phase-number";
    numberEl.textContent = phaseNumber;
    const titleEl = document.createElement("span");
    titleEl.className = "phase-title";
    titleEl.textContent = phaseTitle;
    phaseEl.append(numberEl, titleEl);
    phaseTrack.appendChild(phaseEl);
    const phaseWidth = phaseEl.getBoundingClientRect().width;
    const phaseStyle = getComputedStyle(phaseEl);
    const horizontalPadding = Number.parseFloat(phaseStyle.paddingLeft) + Number.parseFloat(phaseStyle.paddingRight);
    const letterSpacing = Number.parseFloat(phaseStyle.letterSpacing) || 0;
    const titleWidth = textWidth(phaseTitle, phaseStyle.font, letterSpacing);
    phaseEl.classList.toggle("has-title", phaseWidth >= titleWidth + horizontalPadding + 2);
  });

  data.dates.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = "date-cell";
    if (!hasDateValue(index)) cell.classList.add("is-empty-day");
    cell.dataset.start = index;
    cell.dataset.end = index;
    cell.dataset.dateLabel = formatDate(item.date);
    if (item.date === data.currentDate || item.isCurrent) cell.classList.add("is-today");
    if (item.date === data.currentDate) cell.dataset.currentDate = "true";
    cell.innerHTML = `<span class="date-label">${item.date.slice(-2)}</span>`;
    dateTrack.appendChild(cell);
  });
};
