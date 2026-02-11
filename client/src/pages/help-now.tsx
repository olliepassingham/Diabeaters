import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Phone, Plus, User, Trash2, Heart, Settings, X, ChevronDown, ChevronUp, CheckCircle2, Clock, Users, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, EmergencyContact, UserProfile, HypoTreatment, CarerLink } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

export default function HelpNow() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageContactsOpen, setManageContactsOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelationship, setNewContactRelationship] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>("awake");
  const [hypoDialogOpen, setHypoDialogOpen] = useState(false);
  const [hypoGlucose, setHypoGlucose] = useState("");
  const [hypoTreatment, setHypoTreatment] = useState("");
  const [hypoNotes, setHypoNotes] = useState("");
  const [recentHypos, setRecentHypos] = useState<HypoTreatment[]>([]);
  const [carers, setCarers] = useState<CarerLink[]>([]);
  const [hypoConfirmed, setHypoConfirmed] = useState(false);

  useEffect(() => {
    setContacts(storage.getEmergencyContacts());
    setProfile(storage.getProfile());
    setRecentHypos(storage.getHypoTreatments());
    setCarers(storage.getCarerLinks());
  }, []);

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

  const callPrimaryContact = () => {
    const primary = contacts.find(c => c.isPrimary) || contacts[0];
    if (primary) {
      handleCall(primary.phone);
    } else {
      setDialogOpen(true);
    }
  };

  const callEmergencyServices = () => {
    handleCall("999");
  };

  const handleLogHypo = () => {
    const hasCarers = carers.length > 0;
    storage.addHypoTreatment({
      timestamp: new Date().toISOString(),
      glucoseLevel: hypoGlucose ? parseFloat(hypoGlucose) : undefined,
      treatment: hypoTreatment || undefined,
      notes: hypoNotes || undefined,
      carerNotified: hasCarers,
    });
    setRecentHypos(storage.getHypoTreatments());
    setHypoDialogOpen(false);
    setHypoConfirmed(true);
    setHypoGlucose("");
    setHypoTreatment("");
    setHypoNotes("");
    toast({
      title: hasCarers ? "Hypo logged & carers notified" : "Hypo treatment logged",
      description: hasCarers
        ? `${carers.length} linked carer${carers.length > 1 ? "s" : ""} ${carers.length > 1 ? "have" : "has"} been notified that you've treated a hypo.`
        : "Your hypo treatment has been recorded. Link carers in Family & Carers to notify them automatically.",
    });
    setTimeout(() => setHypoConfirmed(false), 5000);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col">
      <div className="bg-red-600 text-white p-6 -mx-6 -mt-6 mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Heart className="h-10 w-10" />
          <h1 className="text-3xl font-bold">HELP NOW</h1>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold mb-1">This person has Type 1 Diabetes</p>
          {profile?.name && (
            <p className="text-2xl font-bold">{profile.name}</p>
          )}
          <p className="text-lg opacity-90 mt-2">
            Their blood sugar may be dangerously low (hypoglycemia)
          </p>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-20 text-lg bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-1"
            onClick={callEmergencyServices}
            data-testid="button-call-999"
          >
            <Phone className="h-6 w-6" />
            <span>Call 999</span>
          </Button>
          
          <Button
            size="lg"
            variant={primaryContact ? "default" : "outline"}
            className={`h-20 text-lg flex flex-col items-center justify-center gap-1 ${primaryContact ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={callPrimaryContact}
            data-testid="button-call-contact"
          >
            <User className="h-6 w-6" />
            <span className="text-sm">
              {primaryContact ? `Call ${primaryContact.name}` : "Add Contact"}
            </span>
          </Button>
        </div>

        <Card className="border-2 border-yellow-500">
          <CardContent className="p-4">
            <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              Signs of Low Blood Sugar
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                "Shaking or trembling",
                "Sweating",
                "Confusion",
                "Slurred speech",
                "Drowsiness",
                "Pale skin",
              ].map((symptom, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <div className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                  <span>{symptom}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-2 transition-colors ${expandedSection === "awake" ? "border-green-500" : "border-muted"}`}
        >
          <button
            onClick={() => toggleSection("awake")}
            className="w-full p-4 flex items-center justify-between text-left"
            data-testid="button-toggle-awake"
          >
            <h2 className="font-bold text-xl flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-2xl">1</span>
              If They Are AWAKE
            </h2>
            {expandedSection === "awake" ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
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
                    <li>Repeat sugar if they don't improve</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card 
          className={`border-2 transition-colors ${expandedSection === "unconscious" ? "border-red-500" : "border-muted"}`}
        >
          <button
            onClick={() => toggleSection("unconscious")}
            className="w-full p-4 flex items-center justify-between text-left"
            data-testid="button-toggle-unconscious"
          >
            <h2 className="font-bold text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <span className="text-2xl">2</span>
              If UNCONSCIOUS or Having a Seizure
            </h2>
            {expandedSection === "unconscious" ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
          {expandedSection === "unconscious" && (
            <CardContent className="pt-0 pb-4 px-4">
              <div className="bg-red-100 dark:bg-red-950 p-4 rounded-lg mb-4">
                <p className="font-bold text-red-800 dark:text-red-200 text-lg mb-2">
                  CALL 999 IMMEDIATELY
                </p>
                <Button
                  className="w-full bg-red-600 hover:bg-red-700 h-12"
                  onClick={callEmergencyServices}
                  data-testid="button-call-999-unconscious"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call 999 Now
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/50 rounded text-sm">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <span><strong>Do NOT</strong> give food or drink</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/50 rounded text-sm">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <span><strong>Do NOT</strong> put anything in their mouth</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/50 rounded text-sm">
                  <span className="text-green-600 text-lg flex-shrink-0">✓</span>
                  <span>Turn them on their side</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/50 rounded text-sm">
                  <span className="text-green-600 text-lg flex-shrink-0">✓</span>
                  <span>Stay with them until help arrives</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Emergency Contacts
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManageContactsOpen(true)}
                data-testid="button-manage-contacts"
              >
                <Settings className="h-4 w-4 mr-1" />
                Manage
              </Button>
            </div>
            
            {contacts.length === 0 ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDialogOpen(true)}
                data-testid="button-add-first-contact"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Emergency Contact
              </Button>
            ) : (
              <div className="space-y-2">
                {contacts.slice(0, 2).map((contact) => (
                  <Button
                    key={contact.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-2"
                    onClick={() => handleCall(contact.phone)}
                    data-testid={`button-call-${contact.id}`}
                  >
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    </div>
                    {contact.isPrimary && (
                      <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20" data-testid="card-hypo-treatment">
          <CardContent className="p-4">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              I've Treated a Hypo
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Tap the button below to log your hypo treatment{carers.length > 0 ? " and notify your linked carers" : ""}.
            </p>

            {hypoConfirmed ? (
              <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-md animate-fade-in-scale">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Hypo treatment logged</p>
                  {carers.length > 0 && (
                    <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1">
                      <Bell className="h-3 w-3" />
                      {carers.length} carer{carers.length > 1 ? "s" : ""} notified
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full text-lg bg-green-600 dark:bg-green-700 gap-2"
                  size="lg"
                  onClick={() => setHypoDialogOpen(true)}
                  data-testid="button-treated-hypo"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  I've Treated My Hypo
                  {carers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-white/20 text-white">
                      <Users className="h-3 w-3 mr-1" />
                      Notify {carers.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    const hasCarers = carers.length > 0;
                    storage.addHypoTreatment({
                      timestamp: new Date().toISOString(),
                      carerNotified: hasCarers,
                    });
                    setRecentHypos(storage.getHypoTreatments());
                    setHypoConfirmed(true);
                    toast({
                      title: hasCarers ? "Quick log sent" : "Hypo logged",
                      description: hasCarers ? "Carers have been notified." : "Treatment recorded.",
                    });
                    setTimeout(() => setHypoConfirmed(false), 5000);
                  }}
                  data-testid="button-quick-hypo"
                >
                  Quick log (no details)
                </Button>
              </div>
            )}

            {recentHypos.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent treatments
                </p>
                <div className="space-y-1">
                  {recentHypos.slice(0, 3).map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-xs py-1" data-testid={`recent-hypo-${h.id}`}>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(h.timestamp), { addSuffix: true })}</span>
                      <div className="flex items-center gap-2">
                        {h.glucoseLevel && <span>{h.glucoseLevel} mmol/L</span>}
                        {h.treatment && <Badge variant="secondary" className="text-xs">{h.treatment}</Badge>}
                        {h.carerNotified && <Bell className="h-3 w-3 text-green-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pb-4">
          This information is for emergency guidance only and is not medical advice.
        </p>
      </div>

      <Dialog open={hypoDialogOpen} onOpenChange={setHypoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Log Hypo Treatment
            </DialogTitle>
            <DialogDescription>
              Record details about your hypo. {carers.length > 0 ? `Your ${carers.length} linked carer${carers.length > 1 ? "s" : ""} will be notified.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="hypo-glucose">Blood Glucose (mmol/L) - optional</Label>
              <Input
                id="hypo-glucose"
                type="number"
                step="0.1"
                placeholder="e.g., 3.2"
                value={hypoGlucose}
                onChange={(e) => setHypoGlucose(e.target.value)}
                data-testid="input-hypo-glucose"
              />
            </div>
            <div className="space-y-2">
              <Label>What did you take?</Label>
              <Select value={hypoTreatment} onValueChange={setHypoTreatment}>
                <SelectTrigger data-testid="select-hypo-treatment">
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glucose tablets">Glucose tablets</SelectItem>
                  <SelectItem value="Juice">Juice</SelectItem>
                  <SelectItem value="Sweets">Sweets</SelectItem>
                  <SelectItem value="Sugary drink">Sugary drink</SelectItem>
                  <SelectItem value="Gel">Glucose gel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hypo-notes">Notes (optional)</Label>
              <Input
                id="hypo-notes"
                placeholder="e.g., Felt shaky before lunch"
                value={hypoNotes}
                onChange={(e) => setHypoNotes(e.target.value)}
                data-testid="input-hypo-notes"
              />
            </div>
            {carers.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md">
                <Bell className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  {carers.map(c => c.name).join(", ")} will be notified
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHypoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogHypo} className="bg-green-600 dark:bg-green-700 gap-2" data-testid="button-confirm-hypo">
              <CheckCircle2 className="h-4 w-4" />
              Log & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Emergency Contact</DialogTitle>
            <DialogDescription>
              Add someone who can help in an emergency
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="e.g., Mum, Partner, Friend"
                data-testid="input-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="e.g., 07700 900000"
                data-testid="input-contact-phone"
              />
            </div>
            <div>
              <Label htmlFor="relationship">Relationship (optional)</Label>
              <Input
                id="relationship"
                value={newContactRelationship}
                onChange={(e) => setNewContactRelationship(e.target.value)}
                placeholder="e.g., Mother, Partner, Friend"
                data-testid="input-contact-relationship"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddContact} data-testid="button-save-contact">
              Save Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageContactsOpen} onOpenChange={setManageContactsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Emergency Contacts</DialogTitle>
            <DialogDescription>
              Add, edit, or remove your emergency contacts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {contacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No contacts added yet</p>
            ) : (
              contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    {contact.relationship && (
                      <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.isPrimary && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContact(contact.id)}
                      data-testid={`button-delete-${contact.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setManageContactsOpen(false);
                setDialogOpen(true);
              }}
              data-testid="button-add-another-contact"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}