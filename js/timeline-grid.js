const isMonday = (weekday) => String(weekday || "").includes("一");

export const phaseStarts = (data) => (
  [...new Set((data.phases || []).slice(1).map((phase) => phase.start))]
    .filter((start) => Number.isFinite(start))
);

export const weekStarts = (dates) => (
  dates.reduce((starts, item, index) => {
    if (index === 0 || isMonday(item.weekday)) starts.push(index);
    return starts;
  }, [])
);
