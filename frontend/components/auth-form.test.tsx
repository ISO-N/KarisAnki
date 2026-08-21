// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { I18nProvider } from "../lib/i18n";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    login: mocks.login,
    register: mocks.register,
  }),
}));

function renderAuthForm(mode: "login" | "register") {
  return render(
    <I18nProvider>
      <AuthForm mode={mode} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.api.mockReset();
  mocks.login.mockReset();
  mocks.register.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

describe("AuthForm", () => {
  it("toggles password visibility on the login form", async () => {
    const user = userEvent.setup();
    renderAuthForm("login");

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("rejects a mismatched confirm password on registration", async () => {
    mocks.api.mockResolvedValue({ enabled: true, inviteRequired: true });
    const user = userEvent.setup();
    renderAuthForm("register");

    await screen.findByRole("button", { name: "Sign up" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "different123");
    await user.type(screen.getByLabelText("Invite code"), "INVITE");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("requires an invite code on registration", async () => {
    mocks.api.mockResolvedValue({ enabled: true, inviteRequired: true });
    const user = userEvent.setup();
    renderAuthForm("register");

    await screen.findByRole("button", { name: "Sign up" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByLabelText("Invite code")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("disables registration while registration is unavailable", async () => {
    mocks.api.mockResolvedValue({ enabled: false, inviteRequired: true });

    renderAuthForm("register");

    const submit = await screen.findByRole("button", { name: "Sign up" });
    expect(submit).toBeDisabled();
    expect(
      screen.getAllByText(
        "Registration is not available. Ask the deployer to configure an invite code.",
      ).length,
    ).toBeGreaterThan(0);
  });
});
