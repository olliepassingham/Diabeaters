import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getNetworkSummary, logPagePerfSummary } from "@/lib/perf-diagnostics";

/**
 * DEV-only: surfaces network type + logs route timing to help distinguish WiFi from app waterfalls.
 */
export function DevPerfDiagnostics() {
  const [location] = useLocation();
  const [network, setNetwork] = useState(() => getNetworkSummary());

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setNetwork(getNetworkSummary());
    logPagePerfSummary(location.split("?")[0] ?? location);
  }, [location]);

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="bg-slate-900 text-slate-200 px-3 py-1 text-[11px] font-mono border-b border-slate-700 z-[59] relative"
      data-testid="dev-perf-diagnostics"
    >
      <span className="text-slate-400 mr-2">Dev · perf</span>
      <span>{network}</span>
      <span className="text-slate-500 ml-2">· route timings in console</span>
    </div>
  );
}
