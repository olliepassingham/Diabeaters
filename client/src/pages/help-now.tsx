import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Phone, Plus, User, Trash2, Heart, Volume2, MapPin, Clock, ArrowLeft, Ambulance, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, EmergencyContact, UserSettings, UserProfile } from "@/lib/storage";

type HelpNowMode = "main" | "treat-low" | "bystander" | "contacts-setup";
type BystanderStep = 1 | 2 | 3 | 4 | 5;

export default function HelpNow() {
  const { toast } = useToast();
  const [mode, setMode] = useState<HelpNowMode>("main");
  const [bystanderStep, setBystanderStep] = useState<BystanderStep>(1);
  const [bystanderSpeaking, setBystanderSpeaking] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelationship, setNewContactRelationship] = useState("");
  
  const [treatmentTimer, setTreatmentTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [treatmentStarted, setTreatmentStarted] = useState(false);
  
  const [inactivityTimer, setInactivityTimer] = useState(60);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [autoCallTriggered, setAutoCallTriggered] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(10);

  useEffect(() => {
    setContacts(storage.getEmergencyContacts());
    setSettings(storage.getSettings());
    setProfile(storage.getProfile());
  }, []);

  const resetInactivityTimer = useCallback(() => {
    setInactivityTimer(60);
    setShowInactivityWarning(false);
    setAutoCallTriggered(false);
    setAutoCallCountdown(10);
  }, []);

  useEffect(() => {
    if (mode === "main" && !autoCallTriggered) {
      const interval = setInterval(() => {
        setInactivityTimer(prev => {
          if (prev <= 1) {
            setShowInactivityWarning(true);
            setAutoCallTriggered(true);
            return 0;
          }
          if (prev <= 15) {
            setShowInactivityWarning(true);
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mode, autoCallTriggered]);

  useEffect(() => {
    if (autoCallTriggered && autoCallCountdown > 0) {
      const interval = setInterval(() => {
        setAutoCallCountdown(prev => {
          if (prev <= 1) {
            const storedContacts = storage.getEmergencyContacts();
            const primary = storedContacts.find(c => c.isPrimary) || storedContacts[0];
            if (primary) {
              window.location.href = `tel:${primary.phone}`;
            } else {
              window.location.href = `tel:999`;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoCallTriggered, autoCallCountdown]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && treatmentTimer > 0) {
      interval = setInterval(() => {
        setTreatmentTimer(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            speakMessage("Time is up. Please check your blood sugar now.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, treatmentTimer]);

  const refreshContacts = () => {
    setContacts(storage.getEmergencyContacts());
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both name and phone number.",
        variant: "destructive",
      });
      return;
    }

    storage.addEmergencyContact({
      name: newContactName,
      phone: newContactPhone,
      relationship: newContactRelationship || undefined,
      isPrimary: contacts.length === 0,
    });

    toast({ title: "Contact added", description: `${newContactName} has been added.` });
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRelationship("");
    setDialogOpen(false);
    refreshContacts();
  };

  const handleDeleteContact = (id: string) => {
    storage.deleteEmergencyContact(id);
    refreshContacts();
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const speakMessage = (message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startTreatLow = () => {
    resetInactivityTimer();
    setMode("treat-low");
    setTreatmentStarted(false);
    setTreatmentTimer(0);
    setTimerActive(false);
    speakMessage("You may be low. Get 15 grams of fast carbs now. Juice, glucose tablets, or regular soda.");
  };

  const startTreatmentTimer = () => {
    setTreatmentStarted(true);
    setTreatmentTimer(15 * 60);
    setTimerActive(true);
    speakMessage("Timer started. Wait 15 minutes, then check your blood sugar.");
  };

  const callPrimaryContact = () => {
    resetInactivityTimer();
    const primary = contacts.find(c => c.isPrimary) || contacts[0];
    if (primary) {
      handleCall(primary.phone);
    } else {
      toast({
        title: "No emergency contact",
        description: "Please add an emergency contact first.",
        variant: "destructive",
      });
    }
  };

  const callEmergencyServices = () => {
    resetInactivityTimer();
    handleCall("999");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speakBystanderContent = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => setBystanderSpeaking(false);
      utterance.onerror = () => setBystanderSpeaking(false);
      setBystanderSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopBystanderSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setBystanderSpeaking(false);
    }
  };

  const bystanderContent = {
    1: {
      title: "What's Happening?",
      speech: "This person has Type 1 Diabetes. Their blood sugar may be dangerously low. This is called hypoglycemia. Low blood sugar can cause confusion, shaking, loss of consciousness, or seizures."
    },
    2: {
      title: "Signs of a Low",
      speech: "Signs of low blood sugar include: Shaking or trembling. Sweating. Confusion or unusual behaviour. Slurred speech. Drowsiness. Pale skin."
    },
    3: {
      title: "If They Are Awake",
      speech: "If they are awake and can swallow: Give them fast sugar like juice, regular soda, glucose tablets, or sugar. Stay with them. Do not let them walk alone. Wait 10 to 15 minutes. Repeat sugar if they do not improve."
    },
    4: {
      title: "Call 999 Now",
      speech: "Call 999 immediately if: They are unconscious. They cannot swallow. They are having a seizure. Do NOT give food or drink. Do NOT put anything in their mouth. Turn them on their side. Stay with them until help arrives."
    },
    5: {
      title: "You're Helping",
      speech: "You are doing the right thing. Low blood sugar is treatable. Stay with them until help arrives or they recover."
    }
  };

  if (mode === "bystander") {
    const goToStep = (step: BystanderStep) => {
      stopBystanderSpeech();
      setBystanderStep(step);
    };

    const exitBystander = () => {
      stopBystanderSpeech();
      setBystanderStep(1);
      setMode("main");
    };

    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col" onClick={resetInactivityTimer}>
        <div className="p-3 border-b flex items-center justify-between gap-2 bg-red-50 dark:bg-red-950">
          <Button
            variant="ghost"
            size="sm"
            onClick={exitBystander}
            className="text-red-700 dark:text-red-300"
            data-testid="button-exit-bystander"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">BYSTANDER INSTRUCTIONS</p>
            <p className="text-xs text-red-600 dark:text-red-400">Step {bystanderStep} of 5</p>
          </div>
          <Button
            variant={bystanderSpeaking ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (bystanderSpeaking) {
                stopBystanderSpeech();
              } else {
                speakBystanderContent(bystanderContent[bystanderStep].speech);
              }
            }}
            className={bystanderSpeaking ? "bg-red-600 hover:bg-red-700" : ""}
            data-testid="button-speak-bystander"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {bystanderStep === 1 && (
            <div className="p-6 text-center" data-testid="bystander-step-1">
              <Heart className="h-20 w-20 text-red-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-6 text-foreground">What's Happening?</h1>
              <div className="space-y-4 text-xl text-left max-w-md mx-auto">
                <p className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border-l-4 border-red-500">
                  <strong>This person has Type 1 Diabetes.</strong>
                </p>
                <p className="text-lg">
                  Their blood sugar may be <strong>dangerously low</strong>. This is called <em>hypoglycemia</em>.
                </p>
                <p className="text-lg">
                  Low blood sugar can cause:
                </p>
                <ul className="text-lg space-y-2 pl-4">
                  <li>Confusion</li>
                  <li>Shaking</li>
                  <li>Loss of consciousness</li>
                  <li>Seizures</li>
                </ul>
              </div>
              {profile?.name && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Their name is</p>
                  <p className="font-bold text-2xl">{profile.name}</p>
                </div>
              )}
            </div>
          )}

          {bystanderStep === 2 && (
            <div className="p-6" data-testid="bystander-step-2">
              <h1 className="text-3xl font-bold mb-6 text-center">Signs of a Low</h1>
              <p className="text-center text-muted-foreground mb-6">Look for these symptoms:</p>
              <div className="space-y-3 max-w-md mx-auto">
                {[
                  "Shaking or trembling",
                  "Sweating",
                  "Confusion or unusual behaviour",
                  "Slurred speech",
                  "Drowsiness",
                  "Pale skin",
                ].map((symptom, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-muted rounded-lg text-xl">
                    <div className="h-3 w-3 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span>{symptom}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bystanderStep === 3 && (
            <div className="p-6" data-testid="bystander-step-3">
              <h1 className="text-3xl font-bold mb-2 text-center text-green-700 dark:text-green-400">If They Are Awake</h1>
              <p className="text-center text-muted-foreground mb-6">And can swallow safely</p>
              
              <div className="space-y-4 max-w-md mx-auto">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-500">
                  <h2 className="font-bold text-xl mb-3 text-green-700 dark:text-green-400">1. Give Fast Sugar</h2>
                  <ul className="space-y-2 text-lg">
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Juice
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Regular (non-diet) soda
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Glucose tablets
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> Sugar or honey
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h2 className="font-bold text-xl mb-2">2. Stay With Them</h2>
                  <p className="text-lg">Do not let them walk alone</p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h2 className="font-bold text-xl mb-2">3. Wait 10-15 Minutes</h2>
                  <p className="text-lg">Repeat sugar if they don't improve</p>
                </div>
              </div>
            </div>
          )}

          {bystanderStep === 4 && (
            <div className="p-6" data-testid="bystander-step-4">
              <div className="bg-red-600 text-white p-4 rounded-lg mb-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                <h1 className="text-2xl font-bold">CALL 999 NOW IF:</h1>
              </div>
              
              <div className="space-y-3 max-w-md mx-auto mb-6">
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border-l-4 border-red-600 text-lg">
                  They are <strong>unconscious</strong>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border-l-4 border-red-600 text-lg">
                  They <strong>cannot swallow</strong>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border-l-4 border-red-600 text-lg">
                  They are having a <strong>seizure</strong>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <h2 className="font-bold text-xl text-center">What To Do:</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-red-100 dark:bg-red-900 rounded-lg text-lg">
                    <X className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <span><strong>Do NOT</strong> give food or drink</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-100 dark:bg-red-900 rounded-lg text-lg">
                    <X className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <span><strong>Do NOT</strong> put anything in their mouth</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900 rounded-lg text-lg">
                    <span className="text-green-600 text-xl flex-shrink-0">✓</span>
                    <span>Turn them on their side</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900 rounded-lg text-lg">
                    <span className="text-green-600 text-xl flex-shrink-0">✓</span>
                    <span>Stay with them until help arrives</span>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full mt-6 h-16 text-xl bg-red-600 hover:bg-red-700"
                onClick={() => handleCall("999")}
                data-testid="button-call-999-bystander"
              >
                <Phone className="h-6 w-6 mr-3" />
                Call 999
              </Button>

              {contacts.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full mt-3 h-14 text-lg"
                  onClick={() => handleCall(contacts.find(c => c.isPrimary)?.phone || contacts[0].phone)}
                  data-testid="button-call-contact-bystander"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call {contacts.find(c => c.isPrimary)?.name || contacts[0].name}
                </Button>
              )}
            </div>
          )}

          {bystanderStep === 5 && (
            <div className="p-6 text-center flex flex-col items-center justify-center min-h-[60vh]" data-testid="bystander-step-5">
              <Heart className="h-24 w-24 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-6 text-green-700 dark:text-green-400">You're Helping</h1>
              <div className="space-y-4 text-xl max-w-md">
                <p className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <strong>You are doing the right thing.</strong>
                </p>
                <p>Low blood sugar is treatable.</p>
                <p className="font-semibold">
                  Stay with them until help arrives or they recover.
                </p>
              </div>
              <p className="mt-8 text-sm text-muted-foreground max-w-sm">
                This information is for emergency guidance only and is not medical advice.
              </p>
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-muted/50">
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((step) => (
              <button
                key={step}
                onClick={() => goToStep(step as BystanderStep)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step === bystanderStep 
                    ? "bg-red-500" 
                    : step < bystanderStep 
                      ? "bg-red-300 dark:bg-red-700" 
                      : "bg-muted-foreground/30"
                }`}
                data-testid={`bystander-step-indicator-${step}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {bystanderStep > 1 && (
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-14 text-lg"
                onClick={() => goToStep((bystanderStep - 1) as BystanderStep)}
                data-testid="button-bystander-prev"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            )}
            {bystanderStep < 5 ? (
              <Button
                size="lg"
                className="flex-1 h-14 text-lg bg-red-600 hover:bg-red-700"
                onClick={() => goToStep((bystanderStep + 1) as BystanderStep)}
                data-testid="button-bystander-next"
              >
                Next
                <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1 h-14 text-lg"
                onClick={exitBystander}
                data-testid="button-bystander-done"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "treat-low") {
    return (
      <div className="fixed inset-0 z-50 bg-yellow-50 dark:bg-yellow-950 flex flex-col" onClick={resetInactivityTimer}>
        <div className="p-4 border-b bg-yellow-100 dark:bg-yellow-900">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setMode("main")}
            className="text-yellow-800 dark:text-yellow-200"
            data-testid="button-back-from-treat"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Help Now
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-16 w-16 text-yellow-600 mb-4" />
          <h1 className="text-3xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
            TREAT YOUR LOW
          </h1>
          <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-6">
            Eat 15g of fast-acting carbs now
          </p>

          <Card className="max-w-lg w-full border-yellow-500 border-2 bg-white dark:bg-yellow-950">
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <p className="text-3xl font-bold">4</p>
                  <p className="text-sm text-muted-foreground">Glucose tablets</p>
                </div>
                <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <p className="text-3xl font-bold">4oz</p>
                  <p className="text-sm text-muted-foreground">Juice or soda</p>
                </div>
                <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <p className="text-3xl font-bold">1</p>
                  <p className="text-sm text-muted-foreground">Tbsp honey</p>
                </div>
              </div>

              <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg">
                <p className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
                  Wait 15 minutes, then recheck your blood sugar
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  If still low, eat another 15g of carbs
                </p>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            size="lg"
            className="mt-6"
            onClick={() => speakMessage("Eat 15 grams of fast carbs. Juice, glucose tablets, or soda. Wait 15 minutes, then check your blood sugar.")}
            data-testid="button-speak-instructions"
          >
            <Volume2 className="h-5 w-5 mr-2" />
            Speak Instructions
          </Button>
        </div>

        <div className="p-4 border-t bg-yellow-100 dark:bg-yellow-900">
          <Button
            size="lg"
            className="w-full h-14 text-lg bg-red-600 hover:bg-red-700"
            onClick={callEmergencyServices}
            data-testid="button-treat-call-999"
          >
            Still feel bad? Call 999
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "contacts-setup") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode("main")}
            data-testid="button-back-from-contacts"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Emergency Contacts</h1>
            <p className="text-muted-foreground">Manage your emergency contacts</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Your Contacts</CardTitle>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg mb-4">No emergency contacts yet</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contact.name}</p>
                        {contact.isPrimary && <Badge>Primary</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone}
                        {contact.relationship && ` • ${contact.relationship}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCall(contact.phone)}
                        data-testid={`button-call-${contact.id}`}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContact(contact.id)}
                        data-testid={`button-delete-${contact.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Emergency Contact</DialogTitle>
              <DialogDescription>Add someone to contact in case of an emergency.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  placeholder="e.g., Mom"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone Number</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="e.g., 555-123-4567"
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  data-testid="input-contact-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-relationship">Relationship (optional)</Label>
                <Input
                  id="contact-relationship"
                  placeholder="e.g., Mother, Spouse"
                  value={newContactRelationship}
                  onChange={e => setNewContactRelationship(e.target.value)}
                  data-testid="input-contact-relationship"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddContact} data-testid="button-save-contact">Add Contact</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col" onClick={resetInactivityTimer}>
      {showInactivityWarning && inactivityTimer > 0 && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white p-4 z-50 text-center">
          <p className="text-lg font-bold">
            Are you okay? Tap anywhere if you're fine. ({inactivityTimer}s)
          </p>
        </div>
      )}

      {showInactivityWarning && inactivityTimer === 0 && (
        <div className="fixed inset-0 bg-red-600 z-50 flex flex-col items-center justify-center p-6 text-white text-center">
          <AlertCircle className="h-24 w-24 mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold mb-4">NO RESPONSE DETECTED</h1>
          <p className="text-2xl mb-4">Auto-calling in {autoCallCountdown} seconds</p>
          <p className="text-xl mb-8 opacity-80">Tap "I'm okay" to cancel</p>
          <div className="space-y-4 w-full max-w-md">
            <Button
              size="lg"
              className="w-full h-16 text-xl bg-white text-red-600 hover:bg-gray-100"
              onClick={() => {
                resetInactivityTimer();
                setMode("main");
              }}
              data-testid="button-im-okay"
            >
              I'm okay - Cancel
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-16 text-xl border-white text-white hover:bg-red-700"
              onClick={callPrimaryContact}
              data-testid="button-call-contact-now"
            >
              <Phone className="h-6 w-6 mr-3" />
              Call Contact Now
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-500">HELP NOW</h1>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <Button
          size="lg"
          className="flex-1 text-2xl font-bold bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
          onClick={startTreatLow}
          data-testid="button-treat-low"
        >
          TREAT A LOW
        </Button>

        <Button
          size="lg"
          className="flex-1 text-2xl font-bold bg-blue-500 hover:bg-blue-600"
          onClick={callPrimaryContact}
          data-testid="button-call-emergency-contact"
        >
          <div className="text-center">
            <div>CALL CONTACT</div>
            {contacts.length > 0 && (
              <div className="text-base font-normal opacity-80">
                {contacts.find(c => c.isPrimary)?.name || contacts[0].name}
              </div>
            )}
          </div>
        </Button>

        <Button
          size="lg"
          className="flex-1 text-2xl font-bold bg-red-500 hover:bg-red-600"
          onClick={callEmergencyServices}
          data-testid="button-call-999"
        >
          CALL 999
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-12"
          onClick={() => speakMessage("You may be having a low blood sugar. Drink juice or eat glucose tablets. If you feel worse, call 999.")}
          data-testid="button-speak-help"
        >
          <Volume2 className="h-4 w-4 mr-1" />
          Speak
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-12"
          onClick={() => setMode("bystander")}
          data-testid="button-bystander-mode"
        >
          <Users className="h-4 w-4 mr-1" />
          Bystander
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-12"
          onClick={() => setMode("contacts-setup")}
          data-testid="button-manage-contacts"
        >
          <User className="h-4 w-4 mr-1" />
          Contacts
        </Button>
      </div>

      <Card className="mt-3 border-muted">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p>This app provides information only. Always call 999 for medical emergencies.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
