// Validated data-viz palette (light mode) — see dataviz reference palette.
// Categorical slots are assigned in fixed order, never cycled.
export const series = {
  s1: "#2a78d6", // blue
  s2: "#1baf7a", // aqua
  s3: "#eda100", // yellow
  s4: "#008300", // green
  s5: "#4a3aa7", // violet
};

// Fixed assignments: color follows the entity.
export const variantColor: Record<string, string> = {
  classic: series.s1,
  agile: series.s2,
  agentic: series.s3,
};

export const phaseColor: Record<string, string> = {
  analysis: series.s1,
  design: series.s2,
  implementation: series.s3,
  test: series.s4,
  rollout: series.s5,
};

// Diverging pair for deltas (waterfall): blue = increase, red = decrease,
// neutral gray for totals.
export const diverging = {
  positive: "#2a78d6",
  negative: "#e34948",
  neutral: "#898781",
};

export const ink = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  surface: "#ffffff",
};
