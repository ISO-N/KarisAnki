// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySession } from "./study-session";
import { SessionHeader } from "./session-header";
import { makeCard } from "../test/factories";

const mocks = vi.hoisted(() => ({
  sessionState: {
    session: null as unknown,
    phase: "front",
    card: null as unknown,
    error: "",
    syncStatus: "synced",
    pendingCount: 0,
    online: true,
    resume: vi.fn(),
    refresh: vi.fn(),
    discardLocalAndRefresh: vi.fn(),
    continueAfterConflict: vi.fn(),
    submit: vi.fn(),
    setPhase: vi.fn(),
  },
}));

vi.mock("@/lib/offline/session-sync", () => ({
  useOfflineSession: () => mocks.sessionState,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "EN",
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

function renderStudy(phase: string) {
  mocks.sessionState.phase = phase;
  mocks.sessionState.card = makeCard(1);
  mocks.sessionState.session = {
    deckId: 1,
    type: "LEARN",
    timezone: "UTC",
    order: [1],
    cards: [makeCard(1)],
    total: 3,
    completedCount: 1,
  };
  const view = render(<StudySession deckId={1} type="LEARN" />);
  return view;
}

beforeEach(() => {
  mocks.sessionState.submit.mockReset();
  mocks.sessionState.setPhase.mockReset();
});

describe("StudySession", () => {
  it("hides the answer on front and shows it after flipping", async () => {
    const user = userEvent.setup();
    const { rerender } = renderStudy("front");

    expect(screen.getByText("frontLabel")).toBeInTheDocument();
    expect(screen.queryByText("backLabel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "flip" }));
    expect(mocks.sessionState.setPhase).toHaveBeenCalledWith("answer");

    mocks.sessionState.phase = "answer";
    rerender(<StudySession deckId={1} type="LEARN" />);

    expect(screen.getByText("backLabel")).toBeInTheDocument();
  });

  it("submits ratings from keyboard shortcuts 1, 2 and 3", () => {
    renderStudy("answer");

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "3" });

    expect(mocks.sessionState.submit).toHaveBeenNthCalledWith(1, "FORGOT");
    expect(mocks.sessionState.submit).toHaveBeenNthCalledWith(2, "BLURRY");
    expect(mocks.sessionState.submit).toHaveBeenNthCalledWith(3, "FAMILIAR");
  });

  it("disables ratings while a submission is in progress", () => {
    renderStudy("submitting");

    expect(screen.getByRole("button", { name: "1 · forgot" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "2 · blurry" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "3 · familiar" })).toBeDisabled();
  });

  it("shows progress from completed and total counts", () => {
    render(
      <SessionHeader
        backHref="/decks/1"
        backLabel="Back"
        progressLabel="Study progress"
        completed={3}
        total={10}
        statusLabel="Review"
      />,
    );

    expect(screen.getByText("4 / 10")).toBeInTheDocument();
    expect(screen.getByText("Study progress")).toBeInTheDocument();
  });

  it("opens graduate confirmation and sends the chosen option", async () => {
    const user = userEvent.setup();
    renderStudy("graduate");

    await user.click(screen.getByRole("button", { name: "graduate" }));
    expect(mocks.sessionState.submit).toHaveBeenCalledWith("FAMILIAR", { graduate: true });

    await user.click(screen.getByRole("button", { name: "continueReview" }));
    expect(mocks.sessionState.submit).toHaveBeenCalledWith("FAMILIAR", { graduate: false });
  });

  it("confirms a forget switch or cancels back to the answer", async () => {
    const user = userEvent.setup();
    renderStudy("confirmForget");

    await user.click(screen.getByRole("button", { name: "confirmForget" }));
    expect(mocks.sessionState.submit).toHaveBeenCalledWith("FORGOT", { confirmForget: true });

    await user.click(screen.getByRole("button", { name: "cancel" }));
    expect(mocks.sessionState.setPhase).toHaveBeenCalledWith("answer");
  });
});
