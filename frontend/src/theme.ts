import { BrandVariants, createLightTheme, Theme } from "@fluentui/react-components";

// Black & white look: the Fluent brand ramp is a neutral gray scale so the
// highlight color is black (Office-like, reduced aesthetic).
const blackBrand: BrandVariants = {
  10: "#fafaf9", 20: "#f0efec", 30: "#e1e0d9", 40: "#c3c2b7",
  50: "#a6a49a", 60: "#898781", 70: "#6d6b66", 80: "#52514e",
  90: "#3a3936", 100: "#2c2c2a", 110: "#232322", 120: "#1a1a19",
  130: "#141413", 140: "#0f0f0e", 150: "#0b0b0b", 160: "#000000",
};

export const emTheme: Theme = {
  ...createLightTheme(blackBrand),
  colorBrandForegroundLink: "#0b0b0b",
  colorBrandForegroundLinkHover: "#000000",
};
