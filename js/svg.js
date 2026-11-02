export const makeSvg = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

export const buildPath = (series, xScale, yScale) => {
  let path = "";
  let started = false;
  series.values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const x = xScale(index);
    const y = yScale(value);
    path += `${started ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    started = true;
  });
  return path.trim();
};

export const append = (parent, ...children) => {
  parent.append(...children);
  return parent;
};
