/** Where the signed-in user edits their own emergency details (Help now, widgets). */
export function emergencyDetailsEditHref(isCarer: boolean): string {
  return isCarer ? "/settings/emergency" : "/account#account-emergency";
}
