import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Clock, ExternalLink, Heart, Users, Footprints, Megaphone, Building, HelpCircle } from "lucide-react";
import { storage, DiabetesEvent } from "@/lib/storage";
import { format } from "date-fns";

const EVENT_TYPE_CONFIG: Record<DiabetesEvent["eventType"], { label: string; icon: typeof CalendarDays; color: string }> = {
  meetup: { label: "Meetup", icon: Users, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  walk: { label: "Charity Walk", icon: Footprints, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  awareness: { label: "Awareness", icon: Megaphone, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  conference: { label: "Conference", icon: Building, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  support_group: { label: "Support Group", icon: Heart, color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
  other: { label: "Event", icon: CalendarDays, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export default function Events() {
  const [events, setEvents] = useState<DiabetesEvent[]>([]);

  useEffect(() => {
    setEvents(storage.getUpcomingEvents());
  }, []);

  const handleToggleInterest = (id: string) => {
    storage.toggleEventInterest(id);
    setEvents(storage.getUpcomingEvents());
  };

  const handleOpenEvent = (url?: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const interestedEvents = events.filter(e => e.isInterested);
  const otherEvents = events.filter(e => !e.isInterested);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Events
        </h1>
        <p className="text-muted-foreground">Discover diabetes meetups, walks, and awareness events near you</p>
      </div>

      {interestedEvents.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Interested
            </CardTitle>
            <CardDescription>Events you've marked as interested</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {interestedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onToggleInterest={handleToggleInterest}
                onOpenEvent={handleOpenEvent}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Events</CardTitle>
          <CardDescription>Diabetes-related events in the UK</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {otherEvents.length === 0 && interestedEvents.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No upcoming events at the moment</p>
            </div>
          ) : otherEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              You've marked all available events as interested!
            </p>
          ) : (
            otherEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onToggleInterest={handleToggleInterest}
                onOpenEvent={handleOpenEvent}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-sm mb-1">Know of an event?</h4>
              <p className="text-sm text-muted-foreground">
                If you know of a diabetes event that should be listed here, let us know through the Community page!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventCard({ 
  event, 
  onToggleInterest, 
  onOpenEvent 
}: { 
  event: DiabetesEvent; 
  onToggleInterest: (id: string) => void;
  onOpenEvent: (url?: string) => void;
}) {
  const config = EVENT_TYPE_CONFIG[event.eventType];
  const Icon = config.icon;
  const eventDate = new Date(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div 
      className="p-4 rounded-lg border bg-card"
      data-testid={`event-card-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.color.split(" ")[0]}`}>
          <Icon className={`h-5 w-5 ${config.color.split(" ").slice(1).join(" ")}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium">{event.title}</h4>
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
          </div>
          
          {event.description && (
            <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
          )}
          
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(eventDate, "EEE, d MMM yyyy")}
              {daysUntil <= 7 && daysUntil >= 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                </Badge>
              )}
            </span>
            {event.time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {event.time}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            )}
          </div>
          
          {event.organizer && (
            <p className="text-xs text-muted-foreground mt-2">
              Organised by {event.organizer}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button 
          variant={event.isInterested ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleInterest(event.id)}
          className="flex-1"
          data-testid={`button-interest-${event.id}`}
        >
          <Heart className={`h-4 w-4 mr-2 ${event.isInterested ? "fill-current" : ""}`} />
          {event.isInterested ? "Interested" : "I'm Interested"}
        </Button>
        {event.eventUrl && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onOpenEvent(event.eventUrl)}
            data-testid={`button-open-event-${event.id}`}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            More Info
          </Button>
        )}
      </div>
    </div>
  );
}
