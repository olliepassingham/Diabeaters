import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, MapPin, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { storage, Appointment } from "@/lib/storage";
import { format } from "date-fns";

export function AppointmentsWidget({ compact = false }: { compact?: boolean }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    setAppointments(storage.getUpcomingAppointments().slice(0, 3));
  }, []);

  const getStatusBadge = (appointment: Appointment) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.date);
    const daysUntil = Math.ceil((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) {
      return <Badge variant="destructive" className="text-xs">Today</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">This Week</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{daysUntil}d</Badge>;
  };

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-appointments">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {compact ? "Appts" : "Appointments"}
        </CardTitle>
        <Link href="/appointments">
          {compact ? (
            <Button variant="ghost" size="icon" data-testid="button-view-all-appointments">
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-appointments">
              View All
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </Link>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No upcoming appointments</p>
            <Link href="/appointments">
              <Button variant="outline" size="sm" data-testid="button-add-appointment-widget">
                <Plus className="h-4 w-4 mr-2" />
                Add Appointment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(compact ? appointments.slice(0, 2) : appointments).map((appointment) => (
              <div 
                key={appointment.id} 
                className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
                data-testid={`widget-appointment-${appointment.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{appointment.title}</span>
                    {getStatusBadge(appointment)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(appointment.date), "d MMM")}
                    </span>
                    {appointment.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time}
                      </span>
                    )}
                    {appointment.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        {appointment.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
