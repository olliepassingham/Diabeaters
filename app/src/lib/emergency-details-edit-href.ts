/** Where the signed-in user edits emergency details (Help now, widgets). */
export function emergencyDetailsEditHref(inSupporterSession: boolean): string {
  return inSupporterSession ? "/carer-view#carer-emergency" : "/account#account-emergency";
}
