import { useEffect, useState } from "react";

const TYPING_TTL_MS = 3_500;

let activeThreadId: string | null = null;
let typingUntil = 0;
const listeners = new Set<() => void>();

function notifyTypingListeners() {
  for (const listener of listeners) listener();
}

export function signalPeerTyping(threadId: string, active: boolean): void {
  if (active) {
    activeThreadId = threadId;
    typingUntil = Date.now() + TYPING_TTL_MS;
  } else if (activeThreadId === threadId) {
    typingUntil = 0;
  }
  notifyTypingListeners();
}

export function isPeerTypingInThread(threadId: string | null | undefined): boolean {
  if (!threadId) return false;
  if (activeThreadId !== threadId) return false;
  if (Date.now() >= typingUntil) return false;
  return true;
}

/** True while the other person is typing in this thread (updated via broadcast). */
export function usePeerTypingActive(threadId: string | null | undefined): boolean {
  const [, tick] = useState(0);

  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    listeners.add(bump);
    const interval = window.setInterval(bump, 400);
    return () => {
      listeners.delete(bump);
      window.clearInterval(interval);
    };
  }, []);

  return isPeerTypingInThread(threadId);
}
