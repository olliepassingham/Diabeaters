import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Phone, Plus, User, Trash2, AlertTriangle, Heart, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, EmergencyContact, UserSettings } from "@/lib/storage";

function EmergencyCard({ 
  title, 
  description, 
  icon: Icon, 
  bgColor, 
  iconColor, 
  children 
}: { 
  title: string; 
  description: string; 
  icon: any; 
  bgColor: string;
  iconColor: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={bgColor}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function HelpNow() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelationship, setNewContactRelationship] = useState("");

  useEffect(() => {
    setContacts(storage.getEmergencyContacts());
    setSettings(storage.getSettings());
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

    toast({ title: "Contact added", description: `${newContactName} has been added to your emergency contacts.` });
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRelationship("");
    setDialogOpen(false);
    refreshContacts();
  };

  const handleDeleteContact = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    storage.deleteEmergencyContact(id);
    toast({ title: "Contact removed", description: contact ? `${contact.name} has been removed.` : "Contact removed." });
    refreshContacts();
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-red-600 dark:text-red-500">Help Now</h1>
        <p className="text-muted-foreground mt-1">
          Emergency assistance and quick reference information.
        </p>
      </div>

      <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-900 dark:text-red-100">Important Reminder</p>
              <p className="text-red-800 dark:text-red-200 mt-1">
                If you are experiencing a medical emergency, call emergency services immediately (911 in the US). 
                This app provides information only and is not a substitute for professional medical care.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Button 
          size="lg" 
          className="h-16 text-lg bg-red-600 hover:bg-red-700"
          onClick={() => handleCall("911")}
          data-testid="button-call-911"
        >
          <Phone className="h-6 w-6 mr-3" />
          Call 911
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          className="h-16 text-lg border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
          onClick={() => handleCall("1-800-222-1222")}
          data-testid="button-call-poison-control"
        >
          <Phone className="h-6 w-6 mr-3" />
          Poison Control
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EmergencyCard
          title="Low Blood Sugar (Hypoglycemia)"
          description="Blood glucose below 70 mg/dL"
          icon={AlertTriangle}
          bgColor="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
          iconColor="text-yellow-600 dark:text-yellow-500"
        >
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Symptoms:</p>
              <ul className="list-disc ml-4 text-muted-foreground space-y-1">
                <li>Shakiness, sweating, dizziness</li>
                <li>Confusion, irritability</li>
                <li>Fast heartbeat, hunger</li>
                <li>Blurred vision, weakness</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Action (Rule of 15):</p>
              <ol className="list-decimal ml-4 text-muted-foreground space-y-1">
                <li>Eat 15g of fast-acting carbs (4 glucose tablets, 4oz juice, regular soda)</li>
                <li>Wait 15 minutes, then recheck blood glucose</li>
                <li>If still below 70 mg/dL, repeat steps 1-2</li>
                <li>Once normal, eat a snack or meal</li>
              </ol>
            </div>
          </div>
        </EmergencyCard>

        <EmergencyCard
          title="High Blood Sugar (Hyperglycemia)"
          description="Blood glucose above 250 mg/dL"
          icon={Activity}
          bgColor="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20"
          iconColor="text-orange-600 dark:text-orange-500"
        >
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Symptoms:</p>
              <ul className="list-disc ml-4 text-muted-foreground space-y-1">
                <li>Increased thirst and urination</li>
                <li>Fatigue, blurred vision</li>
                <li>Headache, nausea</li>
                <li>Fruity breath (sign of DKA)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Action:</p>
              <ol className="list-decimal ml-4 text-muted-foreground space-y-1">
                <li>Check for ketones if available</li>
                <li>Drink water to stay hydrated</li>
                <li>Take correction dose if prescribed</li>
                <li>Seek medical help if ketones are moderate/high or symptoms worsen</li>
              </ol>
            </div>
          </div>
        </EmergencyCard>

        <EmergencyCard
          title="Severe Hypoglycemia"
          description="Unable to treat yourself"
          icon={Heart}
          bgColor="border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
          iconColor="text-red-600 dark:text-red-500"
        >
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Signs:</p>
              <ul className="list-disc ml-4 text-muted-foreground space-y-1">
                <li>Seizures or unconsciousness</li>
                <li>Unable to swallow safely</li>
                <li>Confusion, not responding</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">For helpers:</p>
              <ol className="list-decimal ml-4 text-muted-foreground space-y-1">
                <li>Call 911 immediately</li>
                <li>Do NOT put food/drink in mouth</li>
                <li>Administer glucagon if available and trained</li>
                <li>Place person on their side</li>
                <li>Stay with them until help arrives</li>
              </ol>
            </div>
          </div>
        </EmergencyCard>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Emergency Contacts</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <CardDescription>People to contact in an emergency</CardDescription>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">No emergency contacts added yet.</p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Emergency Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{contact.name}</p>
                        {contact.isPrimary && <Badge variant="secondary">Primary</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {contact.phone}
                        {contact.relationship && ` • ${contact.relationship}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleCall(contact.phone)}
                        data-testid={`button-call-${contact.id}`}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteContact(contact.id)}
                        data-testid={`button-delete-contact-${contact.id}`}
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
      </div>

      {settings.tdd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your Quick Reference</CardTitle>
            <CardDescription>Based on your settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Daily Dose</p>
                <p className="font-semibold">{settings.tdd} units</p>
              </div>
              {settings.correctionFactor && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Correction Factor</p>
                  <p className="font-semibold">1:{settings.correctionFactor}</p>
                </div>
              )}
              {settings.breakfastRatio && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Breakfast Ratio</p>
                  <p className="font-semibold">{settings.breakfastRatio}</p>
                </div>
              )}
              {settings.targetBgLow && settings.targetBgHigh && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Target Range</p>
                  <p className="font-semibold">{settings.targetBgLow}-{settings.targetBgHigh} mg/dL</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                placeholder="e.g., Mother, Spouse, Doctor" 
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
