import { cn } from "@/lib/utils";

/** Chat scroll area wallpaper — see `.chat-thread-wallpaper` in index.css */
export function chatThreadScrollClasses(className?: string) {
  return cn("chat-thread-wallpaper", className);
}
