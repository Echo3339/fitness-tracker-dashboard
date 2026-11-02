const tooltipGap = 22;
const viewportPadding = 12;

export const positionTooltipBeside = ({
  tooltip,
  event,
  anchorX = event.clientX,
  anchorY = event.clientY,
  horizontalGap = tooltipGap,
  flipVertically = false,
  prepareLayout,
}) => {
  const isTrainingTooltip = Boolean(tooltip.querySelector(".tooltip-training-grid"));
  tooltip.classList.toggle("is-training-tooltip", isTrainingTooltip);
  tooltip.style.display = "block";
  tooltip.style.width = "";
  tooltip.style.minWidth = "";
  tooltip.style.maxWidth = `calc(100vw - ${viewportPadding * 2}px)`;
  tooltip.style.height = "";
  tooltip.style.maxHeight = "";
  const naturalWidth = tooltip.offsetWidth;
  const rightSpace = window.innerWidth - anchorX - horizontalGap - viewportPadding;
  const leftSpace = anchorX - horizontalGap - viewportPadding;
  const placeRight = rightSpace >= naturalWidth || rightSpace >= leftSpace;
  const availableWidth = Math.max(1, placeRight ? rightSpace : leftSpace);
  if (!isTrainingTooltip) {
    tooltip.style.minWidth = `${Math.min(154, availableWidth)}px`;
    tooltip.style.maxWidth = `${availableWidth}px`;
  } else {
    tooltip.style.maxWidth = `${availableWidth}px`;
  }

  prepareLayout?.();
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const preferredLeft = placeRight
    ? anchorX + horizontalGap
    : anchorX - horizontalGap - width;
  const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
  const alignedTop = anchorY - height / 2;
  const maxTop = Math.max(viewportPadding, window.innerHeight - height - viewportPadding);
  const top = !flipVertically
    ? alignedTop
    : anchorY + 16 + height > window.innerHeight - viewportPadding
      ? anchorY - height - 16
      : anchorY + 16;

  tooltip.style.left = `${Math.max(viewportPadding, Math.min(preferredLeft, maxLeft))}px`;
  tooltip.style.top = `${Math.max(viewportPadding, Math.min(top, maxTop))}px`;
};
