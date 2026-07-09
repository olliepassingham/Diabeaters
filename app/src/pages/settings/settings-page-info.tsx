import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

export function SettingsHubInfoDialog() {
  return (
    <PageInfoDialog title="About Settings" description="Configure your personal diabetes management preferences">
      <InfoSection title="Personal & usage">
        <p>Your units, insulin habits, supply pack sizes, and backup.</p>
      </InfoSection>
      <InfoSection title="Appearance">
        <p>Light, dark, or Auto (day/night), plus primary accent colour.</p>
      </InfoSection>
      <InfoSection title="Notifications">
        <p>
          Hypo alerts, supply trend alerts, travel and sick-day guide alerts, community feed likes and comments.
        </p>
      </InfoSection>
      <InfoSection title="About">
        <p>
          Version, privacy, terms, support, third-party references, and medical disclaimers. Backup and restore is at
          the bottom of Personal & usage.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsAppearanceInfoDialog() {
  return (
    <PageInfoDialog title="About appearance" description="Theme and accent colour for this device">
      <InfoSection title="Theme mode">
        <p>
          Choose light, dark, or Auto (day/night). Auto uses dark between 7pm and 7am so evening use is easier on your eyes.
        </p>
      </InfoSection>
      <InfoSection title="Primary colour">
        <p>Sets the accent for buttons, links, and highlights across the app. Your choice is saved on this device.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsUsageInfoDialog() {
  return (
    <PageInfoDialog title="About personal & usage" description="Profile details, habits, and supply defaults">
      <InfoSection title="Personal & units">
        <p>
          Your name (used for Help now), region, glucose and carb units, insulin delivery method, body weight, and
          optional date of birth.
        </p>
      </InfoSection>
      <InfoSection title="Usage & supplies">
        <p>
          Typical insulin use, CGM and site-change timing, and pack sizes. These feed the supply tracker forecasts.
        </p>
      </InfoSection>
      <InfoSection title="Backup">
        <p>Export or import your Diabeaters data from the backup section at the bottom of this page.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsRatiosInfoDialog() {
  return (
    <PageInfoDialog title="About ratios" description="Clinical defaults used across tools and advisers">
      <InfoSection title="What these control">
        <p>
          Total daily dose, correction factor, target glucose range, and meal ratios power meal planning, correction
          help, and other advisers.
        </p>
      </InfoSection>
      <InfoSection title="Keeping them current">
        <p>Update these when your clinician changes your insulin plan so suggestions stay in line with your care.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsNotificationsInfoDialog({ supporterMode = false }: { supporterMode?: boolean }) {
  return (
    <PageInfoDialog
      title="About notifications"
      description={
        supporterMode
          ? "Alerts for the person you support and your community activity"
          : "Device alerts for hypos, supplies, guides, and community"
      }
    >
      {supporterMode ? (
        <InfoSection title="Supporter alerts">
          <p>Hypo and scenario alerts from the person you support, plus feed and message notifications for your account.</p>
        </InfoSection>
      ) : (
        <>
          <InfoSection title="Clinical & supplies">
            <p>Hypo alerts for linked supporters, low-supply forecasts, and reminders for travel or sick-day guides.</p>
          </InfoSection>
          <InfoSection title="Community">
            <p>Likes, comments, and direct messages when someone interacts with your feed activity.</p>
          </InfoSection>
        </>
      )}
      <InfoSection title="On your phone">
        <p>
          For sound and banners, also open your device Settings → Notifications → Diabeaters and make sure alerts are
          allowed.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsAboutInfoDialog() {
  return (
    <PageInfoDialog title="About this page" description="Legal, support, and safety information">
      <InfoSection title="Legal & support">
        <p>Privacy policy, terms, support contact, and third-party medical references used in the app.</p>
      </InfoSection>
      <InfoSection title="Safety">
        <p>
          Diabeaters offers educational lifestyle support. It is not a medical device and does not replace care from
          your healthcare team.
        </p>
      </InfoSection>
      <InfoSection title="Moving your data">
        <p>Backup and restore is under Settings → Personal & usage, at the bottom of that page.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsCgmInfoDialog() {
  return (
    <PageInfoDialog
      title="About CGM prefill"
      description="Optional blood glucose suggestions from near-live bridges or your phone health app"
    >
      <InfoSection title="Near-live (recommended)">
        <p>
          <strong>Dexcom Share</strong> or <strong>LibreLink Up</strong> give the freshest readings, trend arrows,
          glucose trend charts, bedtime overnight review, and live BG for linked supporters. Logins stay on this device
          only — they are never uploaded to Diabeaters.
        </p>
      </InfoSection>
      <InfoSection title="Apple Health / Health Connect (fallback)">
        <p>
          Reads the latest blood glucose sample your CGM app has already shared with Apple Health (iPhone) or Health
          Connect (Android). No extra login in Diabeaters — only an OS permission. Readings are often delayed (Dexcom
          may write to Apple Health about three hours late). Use this if you prefer not to connect Share/LibreLink Up,
          or only sync via your CGM app to the health store.
        </p>
      </InfoSection>
      <InfoSection title="How prefill works">
        <p>
          When you open a tool like Driving or Exercise, you can tap to apply a recent value — you can always edit or
          ignore it. If more than one source is enabled, Diabeaters uses whichever reading is freshest.
        </p>
      </InfoSection>
      <InfoSection title="Delays & freshness">
        <p>
          Diabeaters shows how old each reading is. Readings over three hours old are not offered for automatic prefill.
        </p>
      </InfoSection>
      <InfoSection title="Privacy">
        <p>
          CGM history is not uploaded. Share/Libre credentials stay on your phone. When you allow Live glucose for a
          supporter, only the latest snapshot (value, trend, time) may sync — not charts or logins.
        </p>
      </InfoSection>
      <InfoSection title="Safety">
        <p>
          Diabeaters is not a medical device. CGM prefill is a convenience only — always confirm on your CGM receiver or
          meter before treating.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function SettingsFeedbackInfoDialog() {
  return (
    <PageInfoDialog title="About feedback" description="How we use your suggestions and bug reports">
      <InfoSection title="What to send">
        <p>Ideas for improvements, things that confused you, or bugs with steps to reproduce.</p>
      </InfoSection>
      <InfoSection title="What we attach">
        <p>
          Your app version and sign-in email are included automatically so we can follow up. We read every submission.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );
}
