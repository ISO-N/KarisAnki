import type { Card } from "@/lib/types";

export function relearnRequiredCount(mode: Card["relearnMode"]): number {
  if (mode === "FORGOT") return 5;
  if (mode === "BLURRY") return 3;
  return 0;
}

export function relearnProgressLabel(
  count: number,
  mode: Card["relearnMode"],
  familiarLabel: string,
): string | null {
  const required = relearnRequiredCount(mode);
  return required > 0 ? `${familiarLabel} ${count}/${required}` : null;
}
