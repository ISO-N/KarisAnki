// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundSync } from "./background-sync";

const mocks = vi.hoisted(() => ({
  syncAllPending: vi.fn(),
  user: { id: 1 },
  online: true,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/lib/network", () => ({
  useNetworkStatus: () => mocks.online,
}));

vi.mock("@/lib/offline/sync-engine", () => ({
  syncAllPending: mocks.syncAllPending,
}));

beforeEach(() => {
  mocks.syncAllPending.mockReset();
  mocks.syncAllPending.mockResolvedValue([]);
});

describe("BackgroundSync", () => {
  it("starts a background sync for the authenticated user", async () => {
    render(<BackgroundSync />);

    await waitFor(() => expect(mocks.syncAllPending).toHaveBeenCalledWith(1));
  });
});
