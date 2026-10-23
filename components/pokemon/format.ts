export function nationalNumber(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export function measure(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
