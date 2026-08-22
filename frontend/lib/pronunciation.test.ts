import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSpeakFront,
  speakFront,
  splitSpeechSegments,
  stripMarkdownForSpeech,
} from "./pronunciation";

describe("pronunciation text segmentation", () => {
  it("extracts plain text from markdown", () => {
    expect(stripMarkdownForSpeech("**apple**")).toBe("apple");
    expect(stripMarkdownForSpeech("[take up](https://example.com)")).toBe("take up");
    expect(stripMarkdownForSpeech("`don't`")).toBe("don't");
  });

  it("segments English words and phrases", () => {
    expect(splitSpeechSegments("apple")).toEqual([{ text: "apple", lang: "en-US" }]);
    expect(splitSpeechSegments("take up")).toEqual([{ text: "take up", lang: "en-US" }]);
  });

  it("segments Chinese text", () => {
    expect(splitSpeechSegments("苹果很好吃")).toEqual([
      { text: "苹果很好吃", lang: "zh-CN" },
    ]);
  });

  it("splits mixed Chinese and English into language segments", () => {
    expect(splitSpeechSegments("学习 English")).toEqual([
      { text: "学习 ", lang: "zh-CN" },
      { text: "English", lang: "en-US" },
    ]);
  });

  it("rejects other scripts and empty text", () => {
    expect(splitSpeechSegments("Привет")).toBeNull();
    expect(splitSpeechSegments("こんにちは")).toBeNull();
    expect(splitSpeechSegments("")).toBeNull();
    expect(canSpeakFront("Привет")).toBe(false);
  });
});

describe("speakFront", () => {
  class FakeUtterance {
    lang = "";
    text = "";
  }

  const synthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
  } as unknown as SpeechSynthesis;

  afterEach(() => {
    vi.unstubAllGlobals();
    synthesis.cancel.mockReset();
    synthesis.speak.mockReset();
  });

  it("speaks one utterance per language segment", () => {
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    expect(speakFront("学习 English", synthesis)).toBe(true);
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(synthesis.speak).toHaveBeenCalledTimes(2);

    const calls = synthesis.speak.mock.calls as SpeechSynthesisUtterance[][];
    expect(calls[0][0].lang).toBe("zh-CN");
    expect(calls[1][0].lang).toBe("en-US");
  });

  it("returns false when speech synthesis is unavailable", () => {
    expect(speakFront("apple", null)).toBe(false);
  });
});
