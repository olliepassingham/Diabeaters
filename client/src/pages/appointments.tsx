import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Plus, Clock, MapPin, Check, Trash2, Eye, Stethoscope, Heart, Footprints, TestTube, Cpu } from "lucide-react";
import { storage, Appointment, AppointmentType } from "@/lib/storage";
import { format, isAfter, isBefore, addDays } from "date-fns";

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; icon: typeof Calendar }[] = [
  { value: "clinic", label: "Diabetes Clinic", icon: Stethoscope },
  { value: "eye_check", label: "Eye Check", icon: Eye },
  { value: "foot_check", label: "Foot Check", icon: Footprints },
  { value: "blood_test", label: "Blood Test", icon: TestTube },
  { value: "pump_review", label: "Pump Review", icon: Cpu },
  { value: "other", label: "Other", icon: Calendar },
];

function getTypeIcon(type: AppointmentType) {
  const found = APPOINTMENT_TYPES.find(t => t.value === type);
  return found ? found.icon : Calendar;
}

function getTypeLabel(type: AppointmentType) {
  const found = APPOINTMENT_TYPES.find(t => t.value === type);
  return found ? found.label : "Appointment";
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AppointmentType>("clinic");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setAppointments(storage.getAppointments());
  }, []);

  const handleAdd = () => {
    if (!title || !date) return;
    
    storage.addAppointment({
      title,
      type,
      date,
      time: time || undefined,
      location: location || undefined,
      notes: notes || undefined,
      isCompleted: false,
    });
    
    setAppointments(storage.getAppointments());
    setIsAddOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setType("clinic");
    setDate("");
    setTime("");
    setLocation("");
    setNotes("");
  };

  const handleComplete = (id: string) => {
    storage.updateAppointment(id, { isCompleted: true });
    setAppointments(storage.getAppointments());
  };

  const handleDelete = (id: string) => {
    storage.deleteAppointment(id);
    setAppointments(storage.getAppointments());
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingAppointments = appointments.filter(a => !a.isCompleted && isAfter(new Date(a.date), addDays(today, -1)));
  const pastAppointments = appointments.filter(a => a.isCompleted || isBefore(new Date(a.date), today));

  const getStatusBadge = (appointment: Appointment) => {
    if (appointment.isCompleted) {
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Completed</Badge>;
    }
    const appointmentDate = new Date(appointment.date);
    const daysUntil = Math.ceil((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) {
      return <Badge variant="destructive">Today</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">This Week</Badge>;
    }
    return <Badge variant="outline">{daysUntil} days</Badge>;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Appointments
          </h1>
          <p className="text-muted-foreground">Track your diabetes clinic visits and health checks</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-appointment">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Appointment</DialogTitle>
              <DialogDescription>Schedule a new diabetes-related appointment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Annual diabetes review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-appointment-title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
                  <SelectTrigger id="type" data-testid="select-appointment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    data-testid="input-appointment-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time (optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    data-testid="input-appointment-time"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  placeholder="e.g., City Hospital, Diabetes Centre"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-appointment-location"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any notes or things to remember..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-appointment-notes"
                />
              </div>
              
              <Button onClick={handleAdd} className="w-full" disabled={!title || !date} data-testid="button-save-appointment">
                Save Appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No appointments yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your diabetes clinic visits, eye checks, and other appointments to keep track.
            </p>
            <Button variant="outline" onClick={() => setIsAddOpen(true)} data-testid="button-add-first-appointment">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Appointment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcomingAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming</CardTitle>
                <CardDescription>{upcomingAppointments.length} appointment{upcomingAppointments.length !== 1 ? "s" : ""} scheduled</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingAppointments.map((appointment) => {
                  const Icon = getTypeIcon(appointment.type);
                  return (
                    <div 
                      key={appointment.id} 
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      data-testid={`appointment-card-${appointment.id}`}
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium">{appointment.title}</h4>
                          {getStatusBadge(appointment)}
                        </div>
                        <p className="text-sm text-muted-foreground">{getTypeLabel(appointment.type)}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(appointment.date), "EEE, d MMM yyyy")}
                          </span>
                          {appointment.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {appointment.time}
                            </span>
                          )}
                          {appointment.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {appointment.location}
                            </span>
                          )}
                        </div>
                        {appointment.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">{appointment.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleComplete(appointment.id)}
                          data-testid={`button-complete-${appointment.id}`}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleDelete(appointment.id)}
                          data-testid={`button-delete-${appointment.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {pastAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">Past / Completed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pastAppointments.slice(0, 5).map((appointment) => {
                  const Icon = getTypeIcon(appointment.type);
                  return (
                    <div 
                      key={appointment.id} 
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 opacity-70"
                      data-testid={`appointment-past-${appointment.id}`}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{appointment.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(appointment.date), "d MMM yyyy")}
                        </p>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDelete(appointment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <h4 className="font-medium text-sm mb-2">Recommended Check-ups</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2"><Eye className="h-4 w-4" /> Eye screening: Every 1-2 years</li>
            <li className="flex items-center gap-2"><Footprints className="h-4 w-4" /> Foot check: Annually</li>
            <li className="flex items-center gap-2"><TestTube className="h-4 w-4" /> HbA1c blood test: Every 3-6 months</li>
            <li className="flex items-center gap-2"><Heart className="h-4 w-4" /> Blood pressure & cholesterol: Annually</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
