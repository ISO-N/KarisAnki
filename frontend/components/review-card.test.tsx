// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewCard } from "./review-card";
import { makeCard } from "../test/factories";

function installSpeechSynthesis() {
  const speak = vi.fn();
  const cancel = vi.fn();
  class FakeUtterance {
    lang = "";
    text = "";
  }
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: { cancel, speak },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { cancel, speak };
}

beforeEach(() => {
  installSpeechSynthesis();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as Window & { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
});

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

  it("shows phonetic and plays English pronunciation for a word card", () => {
    const { speak } = installSpeechSynthesis();

    render(
      <ReviewCard
        card={makeCard(1, { front: "apple", phonetic: "ˈæpəl" })}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
        pronunciationLabel="Play pronunciation"
      />,
    );

    expect(screen.getByText("/ˈæpəl/")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Play pronunciation" });
    fireEvent.click(button);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("shows a button for an English phrase without phonetic", () => {
    render(
      <ReviewCard
        card={makeCard(1, { front: "take up", phonetic: null })}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
        pronunciationLabel="Play pronunciation"
      />,
    );

    expect(screen.queryByText("/null/")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play pronunciation" })).toBeInTheDocument();
  });

  it("shows a button for Chinese and mixed text", () => {
    render(
      <ReviewCard
        card={makeCard(1, { front: "学习 English", phonetic: null })}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
        pronunciationLabel="Play pronunciation"
      />,
    );

    expect(screen.getByRole("button", { name: "Play pronunciation" })).toBeInTheDocument();
  });

  it("hides the pronunciation button for other scripts", () => {
    render(
      <ReviewCard
        card={makeCard(1, { front: "Привет", phonetic: null })}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
        pronunciationLabel="Play pronunciation"
      />,
    );

    expect(screen.queryByRole("button", { name: "Play pronunciation" })).not.toBeInTheDocument();
  });

  it("hides the pronunciation button when TTS is unavailable", () => {
    delete (window as Window & { speechSynthesis?: SpeechSynthesis }).speechSynthesis;

    render(
      <ReviewCard
        card={makeCard(1, { front: "apple", phonetic: "ˈæpəl" })}
        phase="front"
        statusLabel="New"
        stageLabel="Stage -1"
        frontLabel="Front"
        backLabel="Back"
        pronunciationLabel="Play pronunciation"
      />,
    );

    expect(screen.getByText("/ˈæpəl/")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play pronunciation" })).not.toBeInTheDocument();
  });
});
