// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewCard } from "./review-card";
import { makeCard } from "../test/factories";

describe("ReviewCard", () => {
  it("renders a relearn familiarity progress label", () => {
    render(
      <ReviewCard
        card={makeCard(1, {
          status: "relearn",
          relearnMode: "BLURRY",
          relearnCorrectCount: 1,
        })}
        phase="front"
        statusLabel="Relearn"
        stageLabel="Stage 0"
        familiarProgressLabel="Familiar 1/3"
        frontLabel="Front"
        backLabel="Back"
      />,
    );

    expect(screen.getByText("Familiar 1/3")).toBeInTheDocument();
  });

  it("keeps the header compact when no progress label is provided", () => {
    render(
      <ReviewCard
        card={makeCard(1)}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
      />,
    );

    expect(screen.queryByText("Familiar")).not.toBeInTheDocument();
  });
});
