export type SpeechLocale = "zh-CN" | "en-US";

export interface SpeechSegment {
  text: string;
  lang: SpeechLocale;
}

export function stripMarkdownForSpeech(front: string): string {
  let text = front ?? "";
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/[*_`~#>]/g, "");
  return text.trim().replace(/\s+/g, " ");
}

export function splitSpeechSegments(front: string): SpeechSegment[] | null {
  const text = stripMarkdownForSpeech(front);
  if (!text) return null;

  const chars = Array.from(text);
  if (chars.some((char) => isOtherScript(char))) {
    return null;
  }

  const segments: SpeechSegment[] = [];
  let current: SpeechSegment | null = null;

  const append = (char: string, lang: SpeechLocale): SpeechSegment => {
    if (!current || current.lang !== lang) {
      if (current && current.text.trim()) {
        segments.push(current);
      }
      return { text: char, lang };
    }
    current.text += char;
    return current;
  };

  for (const char of chars) {
    if (isChinese(char)) {
      current = append(char, "zh-CN");
    } else if (isLatin(char)) {
      current = append(char, "en-US");
    } else if (current) {
      current.text += char;
    }
  }

  if (current && current.text.trim()) {
    segments.push(current);
  }
  return segments.length > 0 ? segments : null;
}

export function canSpeakFront(front: string): boolean {
  return splitSpeechSegments(front) !== null;
}

export function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis;
}

export function speakFront(front: string, synth?: SpeechSynthesis | null): boolean {
  const segments = splitSpeechSegments(front);
  const synthesis = synth ?? (typeof window !== "undefined" ? window.speechSynthesis : null);
  if (!segments || !synthesis || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }
  synthesis.cancel();
  for (const segment of segments) {
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = segment.lang;
    synthesis.speak(utterance);
  }
  return true;
}

function isChinese(char: string): boolean {
  return /\p{Script=Han}/u.test(char);
}

function isLatin(char: string): boolean {
  return /\p{Script=Latin}/u.test(char);
}

function isOtherScript(char: string): boolean {
  return !(
    isChinese(char) ||
    isLatin(char) ||
    /\p{White_Space}/u.test(char) ||
    /\p{Punctuation}/u.test(char) ||
    /\p{Number}/u.test(char) ||
    /\p{Symbol}/u.test(char)
  );
}
