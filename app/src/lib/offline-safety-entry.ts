/**
 * Side-effect imports: keep offline-critical safety pages in the main entry
 * chunk so Help Now / emergency / hypo help never need a network chunk fetch.
 */
import "@/pages/help-now";
import "@/pages/emergency-card";
import "@/pages/tools/hypo-help";
