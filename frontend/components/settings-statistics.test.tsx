// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import StatisticsPage from "../app/statistics/page";
import { MetricCard } from "./metric-card";
import { makeStatistics, makeUser } from "../test/factories";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  updateSettings: vi.fn(),
  logoutCurrent: vi.fn(),
  logoutAll: vi.fn(),
  setLanguage: vi.fn(),
  setMode: vi.fn(),
  useApiData: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  user: null as unknown,
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  clientTimezone: () => "UTC",
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
    updateSettings: mocks.updateSettings,
    logoutCurrent: mocks.logoutCurrent,
    logoutAll: mocks.logoutAll,
  }),
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

vi.mock("@/lib/use-api-data", () => ({
  useApiData: mocks.useApiData,
}));

vi.mock("@/components/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  mocks.api.mockReset();
  mocks.updateSettings.mockReset();
  mocks.logoutCurrent.mockReset();
  mocks.logoutAll.mockReset();
  mocks.setLanguage.mockReset();
  mocks.setMode.mockReset();
  mocks.useApiData.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.user = makeUser({
    settings: {
      userId: 1,
      refreshTime: "04:00:00",
      language: "EN",
      theme: "SYSTEM",
    },
  });
});

describe("SettingsPage", () => {
  it("persists refresh time and theme changes", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue({
      userId: 1,
      refreshTime: "05:15:00",
      language: "EN",
      theme: "DARK",
    });

    render(<SettingsPage />);

    const refresh = screen.getByLabelText("refreshTime");
    await user.clear(refresh);
    await user.type(refresh, "05:15");
    await user.click(screen.getByRole("button", { name: "themeDark" }));
    await user.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ refreshTime: "05:15:00", language: "EN", theme: "DARK" }),
        }),
      ),
    );
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ refreshTime: "05:15:00", theme: "DARK" }),
    );
  });

  it("shows the user language and theme in the controls", () => {
    mocks.user = makeUser({
      settings: {
        userId: 1,
        refreshTime: "04:00:00",
        language: "ZH",
        theme: "DARK",
      },
    });

    render(<SettingsPage />);

    expect(screen.getByText("中文")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "themeDark" })).toBeInTheDocument();
  });

  it("rejects a new password shorter than eight characters", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.type(screen.getByLabelText("currentPassword"), "old-password");
    await user.type(screen.getByLabelText("newPassword"), "short");
    await user.click(screen.getAllByRole("button", { name: "save" }).at(-1)!);

    expect(screen.getByText("error")).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});

describe("StatisticsPage", () => {
  it("renders deleted deck options and metric values", async () => {
    const user = userEvent.setup();
    mocks.useApiData.mockReturnValue({
      data: makeStatistics(),
      loading: false,
      error: "",
      refresh: mocks.refresh,
    });

    render(<StatisticsPage />);

    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText("allDecks"));
    expect(
      await screen.findByRole("option", { name: "Archived (deletedDeck)" }),
    ).toBeInTheDocument();
  });

  it("renders an empty state when statistics are unavailable", () => {
    mocks.useApiData.mockReturnValue({
      data: null,
      loading: false,
      error: "",
      refresh: mocks.refresh,
    });

    render(<StatisticsPage />);

    expect(screen.getByText("emptyStatistics")).toBeInTheDocument();
  });
});

describe("MetricCard", () => {
  it("renders a label and formatted value", () => {
    render(<MetricCard icon={Layers} label="Learned" value={42} tone="success" />);

    expect(screen.getByText("Learned")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
