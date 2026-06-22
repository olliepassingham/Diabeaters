export const PASSWORD_MIN_LENGTH = 6;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  return { ok: true };
}

export function passwordMeetsRequirements(password: string): boolean {
  return validatePassword(password).ok;
}
