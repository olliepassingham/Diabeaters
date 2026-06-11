const POST_LOGIN_TOAST_KEY = "diabeater:post_login_toast:v1";

export const POST_LOGIN_TOAST_STASHED_EVENT = "diabeater:post-login-toast-stashed";

export type PostLoginToastMessage = {
  title: string;
  description: string;
};

export function stashPostLoginToast(message: PostLoginToastMessage): void {
  try {
    sessionStorage.setItem(POST_LOGIN_TOAST_KEY, JSON.stringify(message));
    window.dispatchEvent(new CustomEvent(POST_LOGIN_TOAST_STASHED_EVENT));
  } catch {
    // ignore
  }
}

export function consumePostLoginToast(): PostLoginToastMessage | null {
  try {
    const raw = sessionStorage.getItem(POST_LOGIN_TOAST_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POST_LOGIN_TOAST_KEY);
    const parsed = JSON.parse(raw) as { title?: string; description?: string };
    if (!parsed.title || !parsed.description) return null;
    return { title: parsed.title, description: parsed.description };
  } catch {
    return null;
  }
}
