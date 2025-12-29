import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, User } from "lucide-react";
import { Link } from "wouter";
import { storage, EmergencyContact } from "@/lib/storage";

export function HelpNowInfoWidget() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  useEffect(() => {
    setContacts(storage.getEmergencyContacts());
  }, []);

  const primaryContact = contacts.find(c => c.isPrimary);

  return (
    <Card data-testid="widget-help-now-info">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Emergency Info</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {primaryContact ? (
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{primaryContact.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{primaryContact.phone}</p>
            {primaryContact.relationship && (
              <p className="text-xs text-muted-foreground">{primaryContact.relationship}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No emergency contacts set up yet
          </p>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          <Link href="/help-now">
            <Button variant="destructive" size="sm" className="w-full" data-testid="button-help-now-widget">
              Help Now
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-edit-contacts">
              Edit Contacts
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
