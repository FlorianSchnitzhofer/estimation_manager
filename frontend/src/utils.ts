import i18n from "./i18n";

function locale(): string {
  return i18n.language === "de" ? "de-AT" : "en-GB";
}

export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat(locale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtEur(n: number): string {
  return new Intl.NumberFormat(locale(), {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat(locale(), {
    notation: "compact", maximumFractionDigits: 1,
  }).format(n);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
