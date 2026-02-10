import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Package, Dumbbell, Thermometer, Plane, Users, Calculator, AlertCircle, Settings, Bot, Pencil, Calendar, CalendarDays, AlertTriangle, ShieldAlert, Moon, Repeat } from "lucide-react";
import { Link } from "wouter";
import { storage, QuickActionConfig, ALL_QUICK_ACTIONS, QuickActionId } from "@/lib/storage";

const ICON_MAP: Record<string, typeof Package> = {
  Package,
  Dumbbell,
  Thermometer,
  Plane,
  Users,
  Calculator,
  AlertCircle,
  Settings,
  Bot,
  Calendar,
  CalendarDays,
  AlertTriangle,
  ShieldAlert,
  Moon,
  Repeat,
};

export function QuickActionsWidget({ compact = false }: { compact?: boolean }) {
  const [actions, setActions] = useState<QuickActionConfig[]>([]);
  const [editActions, setEditActions] = useState<QuickActionConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setActions(storage.getQuickActions());
  }, []);

  const enabledActions = actions
    .filter(a => a.enabled)
    .sort((a, b) => a.order - b.order);

  const getActionDetails = (id: QuickActionId) => {
    return ALL_QUICK_ACTIONS.find(a => a.id === id);
  };

  const handleOpenEdit = () => {
    const allActionConfigs: QuickActionConfig[] = ALL_QUICK_ACTIONS.map((action, index) => {
      const existing = actions.find(a => a.id === action.id);
      return existing || { id: action.id, enabled: false, order: actions.length + index };
    });
    setEditActions(allActionConfigs);
    setDialogOpen(true);
  };

  const handleToggleAction = (id: QuickActionId) => {
    setEditActions(prev => 
      prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    );
  };

  const handleSave = () => {
    const enabled = editActions.filter(a => a.enabled);
    const disabled = editActions.filter(a => !a.enabled);
    
    const updated: QuickActionConfig[] = [
      ...enabled.map((a, i) => ({ ...a, order: i })),
      ...disabled.map((a, i) => ({ ...a, order: enabled.length + i })),
    ];
    
    storage.saveQuickActions(updated);
    setActions(updated);
    setDialogOpen(false);
  };

  const enabledCount = editActions.filter(a => a.enabled).length;

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-quick-actions">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Quick Actions</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleOpenEdit}
              data-testid="button-edit-quick-actions"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Quick Actions</DialogTitle>
              <DialogDescription>
                Choose which actions appear on your dashboard. Select up to 6 for best layout.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-3">
                {ALL_QUICK_ACTIONS.map((action) => {
                  const Icon = ICON_MAP[action.iconName];
                  const config = editActions.find(a => a.id === action.id);
                  const isEnabled = config?.enabled ?? false;
                  
                  return (
                    <div 
                      key={action.id} 
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`action-${action.id}`}
                        checked={isEnabled}
                        onCheckedChange={() => handleToggleAction(action.id)}
                        data-testid={`checkbox-action-${action.id}`}
                      />
                      <Label 
                        htmlFor={`action-${action.id}`}
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                      >
                        {Icon && <Icon className={`h-5 w-5 ${action.color}`} />}
                        <span>{action.label}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
              {enabledCount > 6 && (
                <p className="text-sm text-amber-600 mt-3">
                  You have {enabledCount} actions selected. Consider limiting to 6 for a cleaner layout.
                </p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" data-testid="button-cancel-edit">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave} data-testid="button-save-quick-actions">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {enabledActions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm mb-2">No quick actions selected</p>
            <Button variant="outline" size="sm" onClick={handleOpenEdit}>
              Add Actions
            </Button>
          </div>
        ) : (
          <div className={`grid ${compact ? "grid-cols-2 gap-1" : "grid-cols-3 gap-2"}`}>
            {(compact ? enabledActions.slice(0, 4) : enabledActions).map((actionConfig) => {
              const details = getActionDetails(actionConfig.id);
              if (!details) return null;
              const Icon = ICON_MAP[details.iconName];
              
              return (
                <Link key={actionConfig.id} href={details.href}>
                  <Button
                    variant="ghost"
                    className={`w-full h-auto flex-col ${compact ? "py-2 gap-1" : "py-4 gap-2"} hover-elevate`}
                    data-testid={`action-${actionConfig.id}`}
                  >
                    {Icon && <Icon className={`${compact ? "h-6 w-6" : "h-10 w-10"} ${details.color}`} />}
                    <span className={`${compact ? "text-xs" : "text-sm"} font-medium`}>{details.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
