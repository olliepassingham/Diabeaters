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

export default function HelpNow() {
  const { toast } = useToast();
  const [mode, setMode] = useState<HelpNowMode>("main");
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

  if (mode === "bystander") {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col" onClick={resetInactivityTimer}>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-8">
            <Heart className="h-24 w-24 text-red-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-red-600 mb-2">I HAVE TYPE 1 DIABETES</h1>
            <p className="text-2xl text-muted-foreground">I may need help</p>
          </div>
          
          <Card className="max-w-md w-full border-red-500 border-2">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">IF I AM CONFUSED OR UNRESPONSIVE:</h2>
              <ol className="text-left text-xl space-y-3">
                <li className="flex gap-3">
                  <span className="font-bold text-red-600">1.</span>
                  <span>Call 999 immediately</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-red-600">2.</span>
                  <span>Do NOT give food or drink</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-red-600">3.</span>
                  <span>Place me on my side</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-red-600">4.</span>
                  <span>Stay with me until help arrives</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {profile?.name && (
            <div className="mt-6 text-xl">
              <p className="text-muted-foreground">My name is</p>
              <p className="font-bold text-2xl">{profile.name}</p>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="mt-6">
              <p className="text-lg text-muted-foreground mb-2">Emergency Contact:</p>
              <Button
                size="lg"
                className="h-16 text-xl bg-red-600 hover:bg-red-700"
                onClick={() => handleCall(contacts.find(c => c.isPrimary)?.phone || contacts[0].phone)}
              >
                <Phone className="h-6 w-6 mr-3" />
                Call {contacts.find(c => c.isPrimary)?.name || contacts[0].name}
              </Button>
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={() => setMode("main")}
            data-testid="button-exit-bystander"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Help Now
          </Button>
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
