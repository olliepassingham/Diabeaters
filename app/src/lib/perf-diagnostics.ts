/**
 * DEV-only helpers to tell WiFi/network latency from app-side waterfalls during demos.
 * See docs/demo-performance.md for the manual mobile-data vs WiFi comparison.
 */

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

function navConnection(): NetworkInformation | undefined {
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  return nav.connection;
}

export function getNetworkSummary(): string {
  const c = navConnection();
  if (!c) return "Network: unknown (API unavailable)";
  const parts = [
    c.effectiveType ? `type=${c.effectiveType}` : null,
    c.downlink != null ? `${c.downlink}Mbps` : null,
    c.rtt != null ? `rtt=${c.rtt}ms` : null,
    c.saveData ? "save-data" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Network: connected";
}

export function markPerf(label: string): void {
  if (!import.meta.env.DEV || typeof performance === "undefined") return;
  try {
    performance.mark(label);
  } catch {
    // ignore duplicate marks
  }
}

export function measurePerf(name: string, startMark: string, endMark: string): number | null {
  if (!import.meta.env.DEV || typeof performance === "undefined") return null;
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    const last = entries[entries.length - 1];
    return last ? last.duration : null;
  } catch {
    return null;
  }
}

/** Log navigation + paint timings to the console (DEV only). */
export function logPagePerfSummary(path: string): void {
  if (!import.meta.env.DEV) return;

  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const lines: string[] = [`[DEV perf] path=${path}`, getNetworkSummary()];

  if (nav) {
    lines.push(
      `html+js: ${Math.round(nav.responseEnd - nav.startTime)}ms`,
      `domInteractive: ${Math.round(nav.domInteractive - nav.startTime)}ms`,
      `loadEvent: ${Math.round(nav.loadEventEnd - nav.startTime)}ms`,
    );
  }

  const paint = performance.getEntriesByType("paint");
  for (const p of paint) {
    lines.push(`${p.name}: ${Math.round(p.startTime)}ms`);
  }

  console.info(lines.join(" · "));
}
