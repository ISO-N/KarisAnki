// @vitest-environment jsdom
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig, useReducedMotion } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOnline, useNetworkStatus } from "./network";
import { ThemeProvider, useTheme } from "./theme";

function matchMediaFor(matches: Record<string, boolean>) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("network status", () => {
  it("tracks browser online and offline events", async () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current).toBe(true);

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event("offline"));
    await waitFor(() => expect(result.current).toBe(false));

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("exposes a helper for imperative online checks", () => {
    expect(isOnline()).toBe(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    expect(isOnline()).toBe(false);
  });
});

describe("theme", () => {
  function ThemeProbe() {
    const { mode, setMode } = useTheme();
    return (
      <button type="button" onClick={() => setMode("DARK")}>
        {mode}
      </button>
    );
  }

  it("persists a selected theme and applies the dark class", async () => {
    localStorage.setItem("karisanki-theme", "LIGHT");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "LIGHT" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("dark");

    await userEvent.click(screen.getByRole("button", { name: "LIGHT" }));
    expect(localStorage.getItem("karisanki-theme")).toBe("DARK");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("resolves system theme from the browser media query", () => {
    window.matchMedia = matchMediaFor({ "(prefers-color-scheme: dark)": true });
    localStorage.setItem("karisanki-theme", "SYSTEM");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "SYSTEM" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });
});

describe("prefers-reduced-motion", () => {
  it("honors MotionConfig reducedMotion user preference", async () => {
    window.matchMedia = matchMediaFor({ "(prefers-reduced-motion)": true });

    function ReducedProbe() {
      const reduced = useReducedMotion();
      return <span data-testid="reduced">{reduced ? "reduced" : "motion"}</span>;
    }

    render(
      <MotionConfig reducedMotion="user">
        <ReducedProbe />
      </MotionConfig>,
    );

    await waitFor(() => expect(screen.getByTestId("reduced")).toHaveTextContent("reduced"));
  });
});
