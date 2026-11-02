const timelineAxisOffset = 44;

export const chartConfig = {
  chartHeight: 220,
  expandedChartHeight: 640,
  sleepChartHeight: 330,
  trainingChartHeight: 640,
  textChartHeight: 132,
  desireChartHeight: 104,
  phaseGap: 15,
  chartMargin: { top: 8, right: 0, bottom: 15, left: 0 },
  sleepMargin: { top: 15, right: 0, bottom: 15, left: 0 },
  trainingMargin: { top: 15, right: 0, bottom: 15, left: 0 },
};

export const createTimelineConfig = (dateCount, cellWidth) => ({
  cellWidth,
  leftOffset: 0,
  rightOffset: 0,
  timelineWidth: dateCount * cellWidth,
  axisWidth: timelineAxisOffset,
});
