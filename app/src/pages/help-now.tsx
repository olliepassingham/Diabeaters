import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Phone, User, Heart, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { storage, UserProfile } from "@/lib/storage";
import { useProfile } from "@/lib/profile";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { PageShell } from "@/components/layout";

export default function HelpNow() {
  const { profile: cloudProfile } = useProfile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("awake");
  const { data: emergency, syncGeneration } = useEmergencyProfile();

  useEffect(() => {
    setProfile(storage.getProfile());
  }, []);

  const primaryContact = toLegacyPrimaryContact(emergency);
  const displayName = cloudProfile?.full_name?.trim() || profile?.name?.trim() || "";

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const callEmergencyServices = () => {
    handleCall("999");
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <PageShell variant="standard" className="min-h-[calc(100vh-8rem)] flex flex-col space-y-0">
      <div className="bg-red-600 text-white p-6 -mx-6 -mt-6 mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Heart className="h-10 w-10" />
          <h1 className="text-3xl font-bold">HELP NOW</h1>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold mb-1">This person has Type 1 Diabetes</p>
          {displayName && <p className="text-2xl font-bold">{displayName}</p>}
          <p className="text-lg opacity-90 mt-2">Their blood sugar may be dangerously low (hypoglycemia)</p>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="text-lg bg-red-600 dark:bg-red-700 flex flex-col items-center justify-center gap-1"
            onClick={callEmergencyServices}
            data-testid="button-call-999"
          >
            <Phone className="h-6 w-6" />
            <span>Call 999</span>
          </Button>

          {primaryContact ? (
            <Button
              size="lg"
              variant="default"
              className="text-lg flex flex-col items-center justify-center gap-1 bg-blue-600 dark:bg-blue-700"
              onClick={() => handleCall(primaryContact.phone)}
              data-testid="button-call-contact"
            >
              <User className="h-6 w-6" />
              <span className="text-sm">Call {primaryContact.name}</span>
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="text-lg" asChild data-testid="button-call-contact">
              <Link href="/account#account-emergency" className="flex flex-col items-center justify-center gap-1 py-3">
                <User className="h-6 w-6" />
                <span className="text-sm">Add contact</span>
              </Link>
            </Button>
          )}
        </div>

        <Card className="border-2 border-yellow-500">
          <CardContent className="p-4">
            <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              Signs of Low Blood Sugar
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {["Shaking or trembling", "Sweating", "Confusion", "Slurred speech", "Drowsiness", "Pale skin"].map(
                (symptom, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span>{symptom}</span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-2 transition-colors ${expandedSection === "awake" ? "border-green-500" : "border-muted"}`}
        >
          <button
            type="button"
            onClick={() => toggleSection("awake")}
            className="w-full p-4 flex items-center justify-between text-left"
            data-testid="button-toggle-awake"
          >
            <h2 className="font-bold text-xl flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-2xl">1</span>
              If They Are AWAKE
            </h2>
            <span className="text-muted-foreground">{expandedSection === "awake" ? "▲" : "▼"}</span>
          </button>
          {expandedSection === "awake" && (
            <CardContent className="pt-0 pb-4 px-4">
              <p className="text-muted-foreground mb-4">And can swallow safely</p>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">Give Fast Sugar:</p>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Juice or regular (non-diet) soda
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Glucose tablets
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Sugar, honey, or sweets
                    </li>
                  </ul>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold mb-1">Then:</p>
                  <ul className="text-sm space-y-1">
                    <li>Stay with them</li>
                    <li>Wait 10-15 minutes</li>
                    <li>Repeat sugar if they don&apos;t improve</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {profile?.insulinDeliveryMethod === "pump" && (
          <Card className="border-2 border-indigo-300 dark:border-indigo-700" data-testid="card-pump-emergency">
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <AlertCircle className="h-5 w-5" />
                Pump Users - Important
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3 p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded">
                  <span className="text-indigo-600 font-bold flex-shrink-0">1</span>
                  <span>
                    If blood sugar is LOW: <strong>do NOT disconnect the pump</strong>. Treat the hypo with fast sugar
                    first.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded">
                  <span className="text-indigo-600 font-bold flex-shrink-0">2</span>
                  <span>
                    If blood sugar is VERY HIGH with ketones: check the pump site for kinks or blockages. Consider
                    whether the pump is delivering insulin properly.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded">
                  <span className="text-indigo-600 font-bold flex-shrink-0">3</span>
                  <span>
                    If you suspect DKA (very high BG + ketones + feeling very unwell): give a correction dose by{" "}
                    <strong>pen injection</strong>, not through the pump, in case the pump is not delivering.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-2 bg-red-50 dark:bg-red-900/50 rounded text-sm">
                  <span className="text-red-600 font-bold flex-shrink-0">!</span>
                  <span>
                    <strong>Never remove someone else&apos;s pump</strong> unless you are trained to do so. Call 999 if
                    unsure.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          className={`border-2 transition-colors ${expandedSection === "unconscious" ? "border-red-500" : "border-muted"}`}
        >
          <button
            type="button"
            onClick={() => toggleSection("unconscious")}
            className="w-full p-4 flex items-center justify-between text-left"
            data-testid="button-toggle-unconscious"
          >
            <h2 className="font-bold text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <span className="text-2xl">2</span>
              If UNCONSCIOUS or Having a Seizure
            </h2>
            <span className="text-muted-foreground">{expandedSection === "unconscious" ? "▲" : "▼"}</span>
          </button>
          {expandedSection === "unconscious" && (
            <CardContent className="pt-0 pb-4 px-4">
              <div className="bg-red-100 dark:bg-red-950 p-4 rounded-lg mb-4">
                <p className="font-bold text-red-800 dark:text-red-200 text-lg mb-2">CALL 999 IMMEDIATELY</p>
                <Button
                  size="lg"
                  className="w-full bg-red-600 dark:bg-red-700"
                  onClick={callEmergencyServices}
                  data-testid="button-call-999-unconscious"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call 999 Now
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/50 rounded">
                  <span className="text-red-600 flex-shrink-0">✕</span>
                  <span>
                    <strong>Do NOT</strong> give food or drink
                  </span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/50 rounded">
                  <span className="text-red-600 flex-shrink-0">✕</span>
                  <span>
                    <strong>Do NOT</strong> put anything in their mouth
                  </span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/50 rounded">
                  <span className="text-green-600 text-lg flex-shrink-0">✓</span>
                  <span>Turn them on their side</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/50 rounded">
                  <span className="text-green-600 text-lg flex-shrink-0">✓</span>
                  <span>Stay with them until help arrives</span>
                </div>
                {profile?.insulinDeliveryMethod === "pump" && (
                  <div className="flex items-center gap-3 p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded text-sm mt-2" data-testid="pump-tip-unconscious">
                    <AlertCircle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <span>
                      They have an insulin pump. <strong>Do not remove it.</strong> Tell the paramedics they use a pump.
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="bg-muted/50" key={syncGeneration}>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Emergency contact
            </h3>
            <p className="text-xs text-muted-foreground">
              Same details as Account and Settings — update once, updates everywhere.
            </p>
            {primaryContact ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleCall(primaryContact.phone)}
                  data-testid="button-call-primary-synced"
                >
                  <Phone className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">{primaryContact.name}</p>
                    <p className="text-xs text-muted-foreground">{primaryContact.phone}</p>
                    {primaryContact.relationship && (
                      <p className="text-xs text-muted-foreground">{primaryContact.relationship}</p>
                    )}
                  </div>
                </Button>
                {emergency.phoneSecondary?.trim() ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleCall(emergency.phoneSecondary.trim())}
                    data-testid="button-call-secondary-synced"
                  >
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">Secondary</p>
                      <p className="text-xs text-muted-foreground">{emergency.phoneSecondary}</p>
                    </div>
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contact on file yet.</p>
            )}
            <Button variant="secondary" size="sm" className="w-full" asChild>
              <Link href="/account#account-emergency">Edit emergency details</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pb-4">
          This information is for emergency guidance only and is not medical advice.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pb-4 mt-4">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice — always follow your diabetes team&apos;s guidance
        </span>
        <span className="text-muted-foreground/50">|</span>
        <Link
          href="/settings/about"
          className="flex items-center gap-1 hover:underline text-primary"
          data-testid="link-sources-footer"
        >
          <BookOpen className="h-3 w-3" />
          Sources
        </Link>
      </div>
    </PageShell>
  );
}
