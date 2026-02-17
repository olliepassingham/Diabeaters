import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Copy, RefreshCw, Shield, Eye, Pencil, KeyRound, Trash2, Plus, Clock, Info, UserPlus, Heart, Lock, Activity, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, CarerLink, CarerPermission, CarerPrivacySettings, CarerActivityLogEntry } from "@/lib/storage";
import { Link } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

const MOCK_CARERS: Omit<CarerLink, "id" | "linkedAt">[] = [
  { name: "Sarah Johnson", relationship: "Mum", email: "sarah.j@email.com", permission: "manage" },
  { name: "David Johnson", relationship: "Dad", email: "david.j@email.com", permission: "view" },
];

const MOCK_ACTIVITY: Omit<CarerActivityLogEntry, "id" | "timestamp">[] = [
  { carerName: "Sarah Johnson", action: "Viewed Supplies", detail: "Checked insulin supply levels" },
  { carerName: "David Johnson", action: "Viewed Dashboard", detail: "Viewed carer dashboard overview" },
  { carerName: "Sarah Johnson", action: "Viewed Appointments", detail: "Checked upcoming clinic visit" },
  { carerName: "System", action: "Hypo Alert", detail: "Hypo treatment logged and carers notified" },
  { carerName: "Sarah Johnson", action: "Added Appointment", detail: "Added eye screening for 15 March" },
];

function PermissionBadge({ permission }: { permission: CarerPermission }) {
  const config = {
    view: { label: "View Only", icon: Eye, variant: "secondary" as const },
    manage: { label: "Manage", icon: Pencil, variant: "default" as const },
    full: { label: "Full Access", icon: KeyRound, variant: "destructive" as const },
  };
  const c = config[permission];
  return (
    <Badge variant={c.variant} className="gap-1" data-testid={`badge-permission-${permission}`}>
      <c.icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function PermissionDescription({ permission }: { permission: CarerPermission }) {
  const descriptions = {
    view: "Can see supply status, appointment reminders, and receive hypo alerts. Cannot make changes.",
    manage: "Everything in View, plus can add supplies, appointments, and manage orders on your behalf.",
    full: "Full access including changing settings. Best for parents of younger children.",
  };
  return <p className="text-xs text-muted-foreground mt-1">{descriptions[permission]}</p>;
}

export default function FamilyCarers() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("carers");
  const [carers, setCarers] = useState<CarerLink[]>([]);
  const [privacy, setPrivacy] = useState<CarerPrivacySettings>(storage.getCarerPrivacy());
  const [activityLog, setActivityLog] = useState<CarerActivityLogEntry[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [newPermission, setNewPermission] = useState<CarerPermission>("view");
  const [codeCopied, setCodeCopied] = useState(false);
  const [hasSeedMock, setHasSeedMock] = useState(false);

  useEffect(() => {
    const links = storage.getCarerLinks();
    if (links.length === 0 && !hasSeedMock) {
      MOCK_CARERS.forEach(c => storage.addCarerLink(c));
      const mockTimes = [2, 5, 12, 24, 72];
      MOCK_ACTIVITY.forEach((a, i) => {
        const log = storage.getCarerActivityLog();
        const entry = {
          ...a,
          id: crypto.randomUUID(),
          timestamp: new Date(Date.now() - mockTimes[i] * 60 * 60 * 1000).toISOString(),
        };
        log.push(entry);
        localStorage.setItem("diabeater_carer_activity_log", JSON.stringify(log));
      });
      setHasSeedMock(true);
    }
    setCarers(storage.getCarerLinks());
    setActivityLog(storage.getCarerActivityLog());
    setInviteCode(storage.getInviteCode());
  }, [hasSeedMock]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCodeCopied(true);
    toast({ title: "Code copied", description: "Share this with your carer to link their account." });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRegenerateCode = () => {
    setInviteCode(storage.regenerateInviteCode());
    toast({ title: "New code generated", description: "Your previous invite code is no longer valid." });
  };

  const handleAddCarer = () => {
    if (!newName.trim()) {
      toast({ title: "Name required", description: "Please enter the carer's name.", variant: "destructive" });
      return;
    }
    storage.addCarerLink({
      name: newName,
      relationship: newRelationship,
      email: newEmail,
      permission: newPermission,
    });
    setCarers(storage.getCarerLinks());
    storage.addCarerActivity({ carerName: "You", action: "Added Carer", detail: `Linked ${newName} as ${newRelationship || "carer"}` });
    setActivityLog(storage.getCarerActivityLog());
    setNewName(""); setNewEmail(""); setNewRelationship(""); setNewPermission("view");
    setAddDialogOpen(false);
    toast({ title: "Carer linked", description: `${newName} has been added as a linked carer.` });
  };

  const handleRemoveCarer = (id: string) => {
    const carer = carers.find(c => c.id === id);
    storage.removeCarerLink(id);
    setCarers(storage.getCarerLinks());
    if (carer) {
      storage.addCarerActivity({ carerName: "You", action: "Removed Carer", detail: `Unlinked ${carer.name}` });
      setActivityLog(storage.getCarerActivityLog());
    }
    toast({ title: "Carer removed", description: "Access has been revoked immediately." });
  };

  const handlePermissionChange = (id: string, permission: CarerPermission) => {
    storage.updateCarerPermission(id, permission);
    setCarers(storage.getCarerLinks());
    const carer = carers.find(c => c.id === id);
    if (carer) {
      storage.addCarerActivity({ carerName: "You", action: "Changed Permission", detail: `Updated ${carer.name} to ${permission}` });
      setActivityLog(storage.getCarerActivityLog());
    }
  };

  const handlePrivacyToggle = (key: keyof CarerPrivacySettings) => {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    storage.saveCarerPrivacy(updated);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-family-carers">
              <Users className="h-6 w-6 text-primary" />
              Family & Carers
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal no-default-hover-elevate no-default-active-elevate">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">Link family members or carers to your account</p>
          </div>
          <PageInfoDialog
            title="About Family & Carers"
            description="Connect your loved ones to your diabetes management"
          >
            <InfoSection title="How Linking Works">
              <p>Share your unique invite code with a parent, partner, or carer. They enter the code in their Diabeaters app to link their account to yours.</p>
            </InfoSection>
            <InfoSection title="Permission Levels">
              <p>View Only lets carers see your status. Manage adds the ability to help with supplies and appointments. Full Access includes settings changes.</p>
            </InfoSection>
            <InfoSection title="Privacy Controls">
              <p>You always control what carers can see. Toggle sharing on or off for each category. You can revoke access at any time.</p>
            </InfoSection>
            <InfoSection title="Hypo Alerts">
              <p>When you log a hypo treatment, your linked carers with alerts enabled receive a notification to put them at ease.</p>
            </InfoSection>
          </PageInfoDialog>
        </div>
        <div className="flex gap-2">
          <Link href="/carer-view">
            <Button variant="outline" className="gap-2" data-testid="button-carer-view">
              <Eye className="h-4 w-4" />
              Preview Carer View
            </Button>
          </Link>
        </div>
      </div>

      <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Prototype Preview:</strong> This is a demonstration of the Family & Carers feature. In a full release, linked carers would have their own app login with real-time notifications and data syncing.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="carers" className="gap-1" data-testid="tab-carers">
            <Users className="h-4 w-4" /> Carers
          </TabsTrigger>
          <TabsTrigger value="invite" className="gap-1" data-testid="tab-invite">
            <UserPlus className="h-4 w-4" /> Invite
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1" data-testid="tab-privacy">
            <Lock className="h-4 w-4" /> Privacy
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1" data-testid="tab-activity">
            <Activity className="h-4 w-4" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="carers" className="mt-6 animate-fade-in-up">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Linked Carers</h2>
              <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-carer">
                <Plus className="h-4 w-4 mr-2" />
                Add Carer
              </Button>
            </div>

            {carers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-2">No linked carers yet</p>
                  <p className="text-sm text-muted-foreground text-center mb-4">Share your invite code with a parent, partner, or carer to get started.</p>
                  <Button variant="outline" onClick={() => setActiveTab("invite")} data-testid="button-go-to-invite">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Generate Invite Code
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {carers.map((carer) => (
                  <Card key={carer.id} data-testid={`card-carer-${carer.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-primary">{carer.name.split(" ").map(n => n[0]).join("")}</span>
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-carer-name-${carer.id}`}>{carer.name}</p>
                            <p className="text-sm text-muted-foreground">{carer.relationship}{carer.email ? ` \u00b7 ${carer.email}` : ""}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Linked {formatDistanceToNow(new Date(carer.linkedAt), { addSuffix: true })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select value={carer.permission} onValueChange={(v) => handlePermissionChange(carer.id, v as CarerPermission)}>
                            <SelectTrigger className="w-[140px]" data-testid={`select-permission-${carer.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View Only</SelectItem>
                              <SelectItem value="manage">Manage</SelectItem>
                              <SelectItem value="full">Full Access</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveCarer(carer.id)} data-testid={`button-remove-carer-${carer.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <PermissionDescription permission={carer.permission} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invite" className="mt-6 animate-fade-in-up">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Invite Code
              </CardTitle>
              <CardDescription>Share this code with a parent, partner, or carer. They enter it in their Diabeaters app to link to your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-center gap-3 p-6 rounded-md bg-muted/50">
                <code className="text-2xl font-mono font-bold tracking-wider" data-testid="text-invite-code">{inviteCode}</code>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={handleCopyCode} className="gap-2" data-testid="button-copy-code">
                  {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {codeCopied ? "Copied" : "Copy Code"}
                </Button>
                <Button variant="outline" onClick={handleRegenerateCode} className="gap-2" data-testid="button-regenerate-code">
                  <RefreshCw className="h-4 w-4" />
                  New Code
                </Button>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pt-2">
                <p className="font-medium">How to link:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Your carer downloads Diabeaters on their device</li>
                  <li>They choose "I'm a carer" during setup</li>
                  <li>They enter your invite code</li>
                  <li>You'll see them appear in your Carers list</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-6 animate-fade-in-up">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Privacy Controls
              </CardTitle>
              <CardDescription>Control exactly what your linked carers can see. Changes take effect immediately.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "shareSupplies" as const, label: "Supply Levels", desc: "Carers can see your insulin, needles, and other supply quantities" },
                { key: "shareAppointments" as const, label: "Appointments", desc: "Carers can see upcoming clinic visits, eye checks, and other appointments" },
                { key: "shareScenarios" as const, label: "Scenario Status", desc: "Carers are notified when you activate Sick Day or Travel mode" },
                { key: "shareHypoAlerts" as const, label: "Hypo Alerts", desc: "Carers receive a notification when you log a hypo treatment" },
                { key: "shareActivityAdviser" as const, label: "Activity Recommendations", desc: "Carers can see your meal and exercise plans from the Activity Adviser" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-2">
                  <div className="flex-1">
                    <Label className="font-medium">{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={privacy[item.key]}
                    onCheckedChange={() => handlePrivacyToggle(item.key)}
                    data-testid={`switch-privacy-${item.key}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6 animate-fade-in-up">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Activity Log
              </CardTitle>
              <CardDescription>See what your linked carers have viewed or done on your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLog.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No activity recorded yet.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {activityLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-0" data-testid={`activity-entry-${entry.id}`}>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-medium">{entry.carerName.split(" ").map(n => n[0]).join("")}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{entry.carerName}</span>
                            <Badge variant="secondary">{entry.action}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.detail}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Carer</DialogTitle>
            <DialogDescription>Link a parent, partner, or carer to your account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="carer-name">Name</Label>
              <Input id="carer-name" placeholder="e.g., Mum" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-carer-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carer-relationship">Relationship</Label>
              <Select value={newRelationship} onValueChange={setNewRelationship}>
                <SelectTrigger data-testid="select-carer-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mum">Mum</SelectItem>
                  <SelectItem value="Dad">Dad</SelectItem>
                  <SelectItem value="Partner">Partner</SelectItem>
                  <SelectItem value="Sibling">Sibling</SelectItem>
                  <SelectItem value="Grandparent">Grandparent</SelectItem>
                  <SelectItem value="Carer">Carer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carer-email">Email (optional)</Label>
              <Input id="carer-email" type="email" placeholder="carer@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="input-carer-email" />
            </div>
            <div className="space-y-2">
              <Label>Permission Level</Label>
              <Select value={newPermission} onValueChange={(v) => setNewPermission(v as CarerPermission)}>
                <SelectTrigger data-testid="select-carer-permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="manage">Manage</SelectItem>
                  <SelectItem value="full">Full Access</SelectItem>
                </SelectContent>
              </Select>
              <PermissionDescription permission={newPermission} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCarer} data-testid="button-confirm-add-carer">Link Carer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
