import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AskAnythingModal } from "@/components/ai-coach/AskAnythingModal";
import type { CoachAudience } from "@/lib/ai-coach/types";

type AskCtx = {
  openAskModal: (source: string, options?: { audience?: CoachAudience }) => void;
};

const Ctx = createContext<AskCtx | null>(null);

export function AskAnythingProvider({
  children,
  defaultAudience = "patient",
}: {
  children: ReactNode;
  defaultAudience?: CoachAudience;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("topbar");
  const [audience, setAudience] = useState<CoachAudience>(defaultAudience);

  const openAskModal = useCallback((src: string, options?: { audience?: CoachAudience }) => {
    setSource(src);
    if (options?.audience) setAudience(options.audience);
    else setAudience(defaultAudience);
    setOpen(true);
  }, [defaultAudience]);

  useEffect(() => {
    setAudience(defaultAudience);
  }, [defaultAudience]);

  const value = useMemo(() => ({ openAskModal }), [openAskModal]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AskAnythingModal open={open} onOpenChange={setOpen} audience={audience} source={source} />
    </Ctx.Provider>
  );
}

export function useAskAnything(): AskCtx {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useAskAnything must be used within AskAnythingProvider");
  }
  return v;
}
