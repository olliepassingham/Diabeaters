import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupporterStopSupporting } from "./supporter-stop-supporting";
import { leaveCarerLink } from "@/lib/carers";
import type { LinkedPatientWithProfile } from "@/lib/carers.types";
import { DEFAULT_CARER_SCOPES } from "@/lib/carers.types";

vi.mock("@/lib/carers", () => ({
  leaveCarerLink: vi.fn(),
}));

function person(linkId: string, patientId: string, name: string): LinkedPatientWithProfile {
  return {
    linkId,
    patientId,
    carerId: "carer-1",
    scopes: DEFAULT_CARER_SCOPES,
    patient_full_name: name,
    patient_avatar_url: null,
  };
}

describe("SupporterStopSupporting", () => {
  beforeEach(() => {
    vi.mocked(leaveCarerLink).mockReset();
    vi.mocked(leaveCarerLink).mockResolvedValue({ error: null });
  });

  it("ends one link and stays with the other person", async () => {
    const onSwitched = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <SupporterStopSupporting
          userId="carer-1"
          linkId="link-a"
          displayName="Alex Smith"
          people={[person("link-a", "patient-a", "Alex Smith"), person("link-b", "patient-b", "Sam Jones")]}
          onSwitched={onSwitched}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("button-stop-supporting"));
    expect(screen.getByText(/Sam stays linked/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-stop-supporting-confirm"));

    await waitFor(() => {
      expect(onSwitched).toHaveBeenCalledWith("patient-b");
    });
    expect(leaveCarerLink).toHaveBeenCalledWith("link-a");
  });
});
