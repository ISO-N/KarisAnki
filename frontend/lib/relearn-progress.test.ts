import { describe, expect, it } from "vitest";
import { relearnProgressLabel, relearnRequiredCount } from "./relearn-progress";

describe("relearn progress", () => {
  it("derives required familiar counts from relearn mode", () => {
    expect(relearnRequiredCount("BLURRY")).toBe(3);
    expect(relearnRequiredCount("FORGOT")).toBe(5);
    expect(relearnRequiredCount("NONE")).toBe(0);
  });

  it("formats progress labels with the current and required count", () => {
    expect(relearnProgressLabel(1, "BLURRY", "Familiar")).toBe("Familiar 1/3");
    expect(relearnProgressLabel(2, "FORGOT", "Familiar")).toBe("Familiar 2/5");
  });

  it("does not render progress for non-relearn modes", () => {
    expect(relearnProgressLabel(0, "NONE", "Familiar")).toBeNull();
  });
});
