// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";
import { makeUser } from "../test/factories";

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.status = status;
    }
  }

  return {
    api: vi.fn(),
    MockApiError,
    setLanguage: vi.fn(),
    setMode: vi.fn(),
    usePathname: vi.fn(() => "/"),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  ApiError: mocks.MockApiError,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "EN",
    t: (key: string) => key,
    setLanguage: mocks.setLanguage,
  }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({
    mode: "SYSTEM",
    setMode: mocks.setMode,
  }),
}));

const USER_CACHE_KEY = "karisanki-user-cache";

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user?.email ?? ""}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <button onClick={() => void auth.login("a@b.com", "secret123", true)}>login</button>
      <button onClick={() => void auth.register("a@b.com", "secret123", "INVITE", true)}>
        register
      </button>
      <button onClick={() => void auth.logoutCurrent().catch(() => undefined)}>logout</button>
      <button onClick={() => void auth.logoutAll().catch(() => undefined)}>logout all</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.api.mockReset();
  mocks.setLanguage.mockReset();
  mocks.setMode.mockReset();
  mocks.usePathname.mockReturnValue("/");
});

describe("AuthProvider", () => {
  it("renders a cached user before making a network request", async () => {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(makeUser({ email: "cached@example.com" })));

    renderAuth();

    expect(await screen.findByText("cached@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("keeps a cached user when the network fails", async () => {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(makeUser({ email: "kept@example.com" })));
    mocks.usePathname.mockReturnValue("/decks");
    mocks.api.mockRejectedValue(new Error("offline"));

    renderAuth();

    expect(await screen.findByText("kept@example.com")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(localStorage.getItem(USER_CACHE_KEY)).toContain("kept@example.com");
  });

  it("clears the user and cached identity on a 401", async () => {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(makeUser({ email: "expired@example.com" })));
    mocks.usePathname.mockReturnValue("/decks");
    mocks.api.mockRejectedValue(new mocks.MockApiError("unauthenticated", "expired", 401));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(""));
    expect(localStorage.getItem(USER_CACHE_KEY)).toBeNull();
  });

  it("does not persist passwords in the user cache after login", async () => {
    const user = makeUser({ email: "a@b.com" });
    mocks.api.mockResolvedValue(user);

    renderAuth();
    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "secret123", rememberMe: true }),
      }),
    );
    const cached = localStorage.getItem(USER_CACHE_KEY);
    expect(cached).toContain("a@b.com");
    expect(cached).not.toContain("secret123");
  });

  it("registers with the expected payload and caches only the user model", async () => {
    const user = makeUser({ email: "a@b.com" });
    mocks.api.mockResolvedValue(user);

    renderAuth();
    await userEvent.click(screen.getByRole("button", { name: "register" }));

    expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "a@b.com",
          password: "secret123",
          inviteCode: "INVITE",
          rememberMe: true,
          language: "EN",
        }),
      }),
    );
    expect(localStorage.getItem(USER_CACHE_KEY)).not.toContain("secret123");
  });

  it("clears the user after logout while still returning after API failure", async () => {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(makeUser()));
    mocks.api.mockRejectedValue(new Error("network"));

    renderAuth();
    await screen.findByText("user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(""));
    expect(localStorage.getItem(USER_CACHE_KEY)).toBeNull();
    expect(mocks.api).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
