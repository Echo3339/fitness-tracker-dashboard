export const setDatePreview = (index) => {
  window.dispatchEvent(new CustomEvent("fitness-date-preview", {
    detail: { index: Number.isFinite(index) ? index : null },
  }));
};
