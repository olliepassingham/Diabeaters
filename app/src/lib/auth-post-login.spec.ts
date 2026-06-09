import { describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

import { prepareAuthSessionBeforeNavigation } from "@/lib/auth-post-login";

describe("prepareAuthSessionBeforeNavigation", () => {
  it("applies session synchronously before navigation", () => {
    const syncAuthSession = vi.fn();
    const session = { user: { id: "u1" } } as Session;

    prepareAuthSessionBeforeNavigation(syncAuthSession, session);

    expect(syncAuthSession).toHaveBeenCalledTimes(1);
    expect(syncAuthSession).toHaveBeenCalledWith(session);
  });

  it("no-ops when session is missing", () => {
    const syncAuthSession = vi.fn();
    prepareAuthSessionBeforeNavigation(syncAuthSession, null);
    expect(syncAuthSession).not.toHaveBeenCalled();
  });
});
