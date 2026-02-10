const STORAGE_KEYS = {
  PROFILE: "diabeater_profile",
  SETTINGS: "diabeater_settings",
  SUPPLIES: "diabeater_supplies",
  ONBOARDING: "diabeater_onboarding_completed",
  EMERGENCY_CONTACTS: "diabeater_emergency_contacts",
  ACTIVITY_LOGS: "diabeater_activity_logs",
  DASHBOARD_WIDGETS: "diabeater_dashboard_widgets",
  QUICK_ACTIONS: "diabeater_quick_actions",
  SCENARIO_STATE: "diabeater_scenario_state",
  LAST_PRESCRIPTION: "diabeater_last_prescription",
  USUAL_PRESCRIPTION: "diabeater_usual_prescription",
  PICKUP_HISTORY: "diabeater_pickup_history",
  COMMUNITY_POSTS: "diabeater_community_posts",
  COMMUNITY_REPLIES: "diabeater_community_replies",
  COMMUNITY_REELS: "diabeater_community_reels",
  DIRECT_MESSAGES: "diabeater_direct_messages",
  CONVERSATIONS: "diabeater_conversations",
  FOLLOWING: "diabeater_following",
  NOTIFICATIONS: "diabeater_notifications",
  NOTIFICATION_SETTINGS: "diabeater_notification_settings",
  LAST_NOTIFICATION_CHECK: "diabeater_last_notification_check",
  APPOINTMENTS: "diabeater_appointments",
  EVENTS: "diabeater_events",
  AI_COACH_HISTORY: "diabeater_ai_coach_history",
  ROUTINES: "diabeater_routines",
  PRESCRIPTION_CYCLE: "diabeater_prescription_cycle",
} as const;

export interface UserProfile {
  name: string;
  email: string;
  dateOfBirth: string;
  bgUnits: string;
  carbUnits: string;
  diabetesType: string;
  insulinDeliveryMethod: string;
  usingInsulin: boolean;
  hasAcceptedDisclaimer: boolean;
}

export interface UserSettings {
  tdd?: number;
  breakfastRatio?: string;
  lunchRatio?: string;
  dinnerRatio?: string;
  snackRatio?: string;
  correctionFactor?: number;
  targetBgLow?: number;
  targetBgHigh?: number;
  shortActingUnitsPerDay?: number;
  longActingUnitsPerDay?: number;
  injectionsPerDay?: number;
  cgmDays?: number;
  siteChangeDays?: number;
  reservoirChangeDays?: number;
  reservoirCapacity?: number;
  unitsPerInsulinPen?: number;
  needlesPerBox?: number;
  sensorsPerBox?: number;
  infusionSetsPerBox?: number;
  reservoirsPerBox?: number;
  insulinCartridgeUnits?: number;
}

export interface Supply {
  id: string;
  name: string;
  type: "needle" | "insulin" | "cgm" | "infusion_set" | "reservoir" | "other";
  currentQuantity: number;
  dailyUsage: number;
  lastPickupDate?: string;
  quantityAtPickup?: number;
  typicalRefillQuantity?: number;
  notes?: string;
}

export type SupplyType = Supply["type"];

export const SUPPLY_PACK_DEFAULTS: Record<SupplyType, { increment: number; label: string; settingsKey: keyof UserSettings }> = {
  insulin: { increment: 300, label: "pen", settingsKey: "unitsPerInsulinPen" },
  needle: { increment: 100, label: "box", settingsKey: "needlesPerBox" },
  cgm: { increment: 1, label: "sensor", settingsKey: "sensorsPerBox" },
  infusion_set: { increment: 10, label: "box", settingsKey: "infusionSetsPerBox" },
  reservoir: { increment: 10, label: "box", settingsKey: "reservoirsPerBox" },
  other: { increment: 1, label: "unit", settingsKey: "needlesPerBox" },
};

export function getSupplyIncrement(type: SupplyType, settings?: UserSettings): { amount: number; label: string } {
  const s = settings || storage.getSettings();
  const packInfo = SUPPLY_PACK_DEFAULTS[type];
  const customValue = s[packInfo.settingsKey] as number | undefined;

  if (type === "other") {
    return { amount: 1, label: "unit" };
  }

  if (type === "insulin") {
    const isPump = storage.getProfile()?.insulinDeliveryMethod === "pump";
    const amount = Math.max(1, customValue || (isPump ? s.insulinCartridgeUnits : undefined) || packInfo.increment);
    const itemLabel = isPump ? "cartridge" : "pen";
    return { amount, label: amount === 1 ? "unit" : itemLabel };
  }

  const amount = Math.max(1, customValue || packInfo.increment);
  if (type === "needle") {
    return { amount, label: amount === 1 ? "needle" : "box" };
  }
  if (type === "cgm") {
    return { amount, label: "sensor" };
  }
  if (type === "infusion_set") {
    return { amount, label: amount === 1 ? "set" : "box" };
  }
  if (type === "reservoir") {
    return { amount, label: amount === 1 ? "reservoir" : "box" };
  }

  return { amount: 1, label: "unit" };
}

export function getUnitsPerPen(settings?: UserSettings): number {
  const s = settings || storage.getSettings();
  return Math.max(1, s.unitsPerInsulinPen || s.insulinCartridgeUnits || 300);
}

export function getInsulinContainerLabel(): string {
  const profile = storage.getProfile();
  return profile?.insulinDeliveryMethod === "pump" ? "cartridge" : "pen";
}

export interface LastPrescription {
  name: string;
  type: Supply["type"];
  quantity: number;
  dailyUsage: number;
  notes?: string;
  savedAt: string;
}

export interface UsualPrescriptionItem {
  name: string;
  type: Supply["type"];
  quantity: number;
  dailyUsage: number;
  notes?: string;
}

export interface UsualPrescription {
  items: UsualPrescriptionItem[];
  savedAt: string;
}

export interface PickupRecord {
  id: string;
  supplyId: string;
  supplyName: string;
  quantity: number;
  pickupDate: string;
}

export interface PrescriptionCycle {
  intervalDays: number;
  leadTimeDays: number;
  lastOrderDate?: string;
  lastCollectionDate?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  isPrimary: boolean;
}

export interface ActivityLog {
  id: string;
  activityType: string;
  activityDetails: string;
  recommendation: string;
  createdAt: string;
}

export type WidgetType = 
  | "supply-summary" 
  | "today-overview" 
  | "ai-recommendations" 
  | "quick-actions" 
  | "scenario-status" 
  | "settings-completion" 
  | "community"
  | "messages"
  | "activity-adviser"
  | "ratio-adviser"
  | "travel-mode"
  | "sick-day"
  | "help-now-info"
  | "appointments";

export type WidgetSize = "full" | "half";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number;
  size: WidgetSize;
}

export interface ScenarioState {
  travelModeActive: boolean;
  travelDestination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  travelTimezoneShift?: number; // hours difference (positive = east, negative = west)
  travelTimezoneDirection?: "east" | "west" | "none";
  sickDayActive: boolean;
  sickDaySeverity?: string;
}

export const COMMUNITY_TOPICS = [
  { id: "holidays-travel", label: "Holidays & Travel" },
  { id: "sick-days", label: "Feeling Unwell / Sick Days" },
  { id: "exercise-activity", label: "Exercise & Activity" },
  { id: "food-eating-out", label: "Food & Eating Out" },
  { id: "mental-health", label: "Mental Health & Burnout" },
  { id: "tips-what-worked", label: "Tips & What Worked for Me" },
  { id: "general-questions", label: "General Questions" },
] as const;

export type CommunityTopicId = typeof COMMUNITY_TOPICS[number]["id"];

export interface CommunityPost {
  id: string;
  title: string;
  content?: string;
  topic: CommunityTopicId;
  authorName?: string;
  isAnonymous: boolean;
  isReported: boolean;
  replyCount: number;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  content: string;
  authorName?: string;
  isAnonymous: boolean;
  isReported: boolean;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participantName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface FollowRelation {
  userName: string;
  followedAt: string;
}

export type NotificationType = "supply_low" | "supply_critical" | "reminder" | "info" | "activity";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  supplyId?: string;
  actionUrl?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  supplyAlerts: boolean;
  criticalThresholdDays: number;
  lowThresholdDays: number;
  browserNotifications: boolean;
}

export type AppointmentType = "clinic" | "eye_check" | "foot_check" | "blood_test" | "pump_review" | "other";

export interface Appointment {
  id: string;
  title: string;
  type: AppointmentType;
  date: string;
  time?: string;
  location?: string;
  notes?: string;
  reminderDays?: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface DiabetesEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location?: string;
  organizer?: string;
  eventUrl?: string;
  eventType: "meetup" | "walk" | "awareness" | "conference" | "support_group" | "other";
  eventSource: "official" | "community";
  isInterested: boolean;
  createdAt: string;
}

export type ReelPlatform = "tiktok" | "instagram" | "youtube";

export interface CommunityReel {
  id: string;
  title: string;
  creatorHandle: string;
  platform: ReelPlatform;
  sourceUrl: string;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
}

export type QuickActionId = 
  | "supplies" 
  | "activity" 
  | "bedtime"
  | "sick-day" 
  | "travel" 
  | "ratios" 
  | "routines"
  | "community"
  | "settings"
  | "appointments"
  | "events"
  | "emergency-card";

export interface QuickActionConfig {
  id: QuickActionId;
  enabled: boolean;
  order: number;
}

export interface AICoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type RoutineMealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type RoutineOutcome = "great" | "good" | "okay" | "not_ideal";

export interface Routine {
  id: string;
  name: string;
  mealType: RoutineMealType;
  mealDescription: string;
  carbEstimate?: number;
  insulinDose?: number;
  insulinTiming: "before" | "with" | "after";
  timingMinutes?: number;
  context?: string;
  outcome: RoutineOutcome;
  outcomeNotes?: string;
  tags: string[];
  timesUsed: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export const ALL_QUICK_ACTIONS: { id: QuickActionId; label: string; href: string; iconName: string; color: string }[] = [
  { id: "supplies", label: "Supplies", href: "/supplies", iconName: "Package", color: "text-blue-600" },
  { id: "activity", label: "Activity", href: "/advisor", iconName: "Dumbbell", color: "text-green-600" },
  { id: "bedtime", label: "Bedtime", href: "/scenarios?tab=bedtime", iconName: "Moon", color: "text-indigo-600" },
  { id: "routines", label: "Routines", href: "/advisor?tab=routines", iconName: "Repeat", color: "text-emerald-600" },
  { id: "sick-day", label: "Sick Day", href: "/scenarios?tab=sick-day", iconName: "Thermometer", color: "text-orange-600" },
  { id: "travel", label: "Travel", href: "/scenarios?tab=travel", iconName: "Plane", color: "text-purple-600" },
  { id: "ratios", label: "Ratios", href: "/advisor", iconName: "Calculator", color: "text-teal-600" },
  { id: "community", label: "Community", href: "/community?tab=posts", iconName: "Users", color: "text-indigo-600" },
  { id: "appointments", label: "Appointments", href: "/appointments", iconName: "Calendar", color: "text-cyan-600" },
  { id: "events", label: "Events", href: "/community?tab=events", iconName: "CalendarDays", color: "text-violet-600" },
  { id: "emergency-card", label: "Travel Emergency", href: "/emergency-card", iconName: "ShieldAlert", color: "text-red-600" },
  { id: "settings", label: "Settings", href: "/settings", iconName: "Settings", color: "text-gray-600" },
];

export const DEFAULT_QUICK_ACTIONS: QuickActionConfig[] = [
  { id: "supplies", enabled: true, order: 0 },
  { id: "activity", enabled: true, order: 1 },
  { id: "bedtime", enabled: true, order: 2 },
  { id: "sick-day", enabled: true, order: 3 },
  { id: "travel", enabled: true, order: 4 },
  { id: "appointments", enabled: true, order: 5 },
];

// Default widget order after setup: Quick Actions, Supply Summary, AI Insights, Appointments, Community, Messages, Ratios, Settings (at bottom)
// Other widgets start disabled but can be added via customization
export const DEFAULT_WIDGET_SIZES: Record<WidgetType, WidgetSize> = {
  "quick-actions": "full",
  "supply-summary": "half",
  "ai-recommendations": "full",
  "appointments": "half",
  "community": "half",
  "ratio-adviser": "half",
  "settings-completion": "half",
  "today-overview": "full",
  "scenario-status": "full",
  "activity-adviser": "half",
  "travel-mode": "half",
  "sick-day": "half",
  "help-now-info": "half",
  "messages": "half",
};

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "quick-actions", type: "quick-actions", enabled: true, order: 0, size: "full" },
  { id: "supply-summary", type: "supply-summary", enabled: true, order: 1, size: "half" },
  { id: "appointments", type: "appointments", enabled: true, order: 2, size: "half" },
  { id: "ai-recommendations", type: "ai-recommendations", enabled: true, order: 3, size: "full" },
  { id: "community", type: "community", enabled: true, order: 4, size: "half" },
  { id: "ratio-adviser", type: "ratio-adviser", enabled: true, order: 5, size: "half" },
  { id: "settings-completion", type: "settings-completion", enabled: true, order: 6, size: "half" },
  { id: "today-overview", type: "today-overview", enabled: false, order: 8, size: "full" },
  { id: "scenario-status", type: "scenario-status", enabled: false, order: 9, size: "full" },
  { id: "activity-adviser", type: "activity-adviser", enabled: false, order: 10, size: "half" },
  { id: "travel-mode", type: "travel-mode", enabled: false, order: 11, size: "half" },
  { id: "sick-day", type: "sick-day", enabled: false, order: 12, size: "half" },
  { id: "help-now-info", type: "help-now-info", enabled: false, order: 13, size: "half" },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const storage = {
  getProfile(): UserProfile | null {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  },

  saveProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.ONBOARDING, "true");
  },

  isOnboardingCompleted(): boolean {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING) === "true";
  },

  getSettings(): UserSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {};
  },

  saveSettings(settings: UserSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getSupplies(): Supply[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIES);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  },

  addSupply(supply: Omit<Supply, "id">): { supply: Supply; merged: boolean } {
    const supplies = this.getSupplies();
    const existingIndex = supplies.findIndex(
      s => s.name.toLowerCase().trim() === supply.name.toLowerCase().trim()
    );
    
    if (existingIndex !== -1) {
      const existingSupply = supplies[existingIndex];
      const currentAdjustedQuantity = this.getAdjustedQuantity(existingSupply);
      const newTotalQuantity = Math.max(0, currentAdjustedQuantity) + supply.currentQuantity;
      supplies[existingIndex].currentQuantity = newTotalQuantity;
      supplies[existingIndex].quantityAtPickup = newTotalQuantity;
      supplies[existingIndex].lastPickupDate = supply.lastPickupDate || new Date().toISOString();
      if (supply.dailyUsage) {
        supplies[existingIndex].dailyUsage = supply.dailyUsage;
      }
      if (supply.notes) {
        supplies[existingIndex].notes = supply.notes;
      }
      localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
      return { supply: supplies[existingIndex], merged: true };
    }
    
    const newSupply: Supply = { 
      ...supply, 
      id: generateId(),
      quantityAtPickup: supply.currentQuantity,
      lastPickupDate: supply.lastPickupDate || new Date().toISOString()
    };
    supplies.push(newSupply);
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    return { supply: newSupply, merged: false };
  },

  updateSupply(id: string, updates: Partial<Supply>): Supply | null {
    const supplies = this.getSupplies();
    const index = supplies.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    const current = supplies[index];
    
    // If currentQuantity is changing but quantityAtPickup is not explicitly set,
    // adjust quantityAtPickup by the same delta to keep automatic deduction accurate
    if (updates.currentQuantity !== undefined && 
        updates.quantityAtPickup === undefined && 
        current.quantityAtPickup !== undefined) {
      const delta = updates.currentQuantity - current.currentQuantity;
      updates.quantityAtPickup = Math.max(0, current.quantityAtPickup + delta);
    }
    
    supplies[index] = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    return supplies[index];
  },

  deleteSupply(id: string): boolean {
    const supplies = this.getSupplies();
    const filtered = supplies.filter(s => s.id !== id);
    if (filtered.length === supplies.length) return false;
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(filtered));
    return true;
  },

  getLastPrescription(): LastPrescription | null {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_PRESCRIPTION);
    return data ? JSON.parse(data) : null;
  },

  saveLastPrescription(prescription: Omit<LastPrescription, "savedAt">): void {
    const record: LastPrescription = { ...prescription, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.LAST_PRESCRIPTION, JSON.stringify(record));
  },

  getUsualPrescription(): UsualPrescription | null {
    const data = localStorage.getItem(STORAGE_KEYS.USUAL_PRESCRIPTION);
    return data ? JSON.parse(data) : null;
  },

  saveUsualPrescription(items: UsualPrescriptionItem[]): void {
    const record: UsualPrescription = { items, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.USUAL_PRESCRIPTION, JSON.stringify(record));
  },

  saveCurrentSuppliesAsUsualPrescription(): void {
    const supplies = this.getSupplies();
    const items: UsualPrescriptionItem[] = supplies.map(s => ({
      name: s.name,
      type: s.type,
      quantity: s.currentQuantity,
      dailyUsage: s.dailyUsage,
      notes: s.notes,
    }));
    this.saveUsualPrescription(items);
  },

  addUsualPrescriptionSupplies(): { added: number; merged: number } {
    const usual = this.getUsualPrescription();
    if (!usual || usual.items.length === 0) return { added: 0, merged: 0 };
    
    let addedCount = 0;
    let mergedCount = 0;
    for (const item of usual.items) {
      const result = this.addSupply({
        name: item.name,
        type: item.type,
        currentQuantity: item.quantity,
        dailyUsage: item.dailyUsage,
        notes: item.notes,
      });
      if (result.merged) {
        mergedCount++;
      } else {
        addedCount++;
      }
    }
    return { added: addedCount, merged: mergedCount };
  },

  getPickupHistory(supplyId?: string): PickupRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.PICKUP_HISTORY);
    const history: PickupRecord[] = data ? JSON.parse(data) : [];
    if (supplyId) {
      return history.filter(r => r.supplyId === supplyId);
    }
    return history;
  },

  addPickupRecord(supplyId: string, supplyName: string, quantity: number): PickupRecord {
    const history = this.getPickupHistory();
    const record: PickupRecord = {
      id: generateId(),
      supplyId,
      supplyName,
      quantity,
      pickupDate: new Date().toISOString(),
    };
    history.unshift(record);
    if (history.length > 100) history.pop();
    localStorage.setItem(STORAGE_KEYS.PICKUP_HISTORY, JSON.stringify(history));
    const supplies = this.getSupplies();
    const supplyIndex = supplies.findIndex(s => s.id === supplyId);
    if (supplyIndex !== -1) {
      supplies[supplyIndex].lastPickupDate = record.pickupDate;
      localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    }
    return record;
  },

  getPrescriptionCycle(): PrescriptionCycle | null {
    const data = localStorage.getItem(STORAGE_KEYS.PRESCRIPTION_CYCLE);
    return data ? JSON.parse(data) : null;
  },

  savePrescriptionCycle(cycle: PrescriptionCycle): void {
    localStorage.setItem(STORAGE_KEYS.PRESCRIPTION_CYCLE, JSON.stringify(cycle));
  },

  getEmergencyContacts(): EmergencyContact[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
    return data ? JSON.parse(data) : [];
  },

  addEmergencyContact(contact: Omit<EmergencyContact, "id">): EmergencyContact {
    const contacts = this.getEmergencyContacts();
    const newContact = { ...contact, id: generateId() };
    contacts.push(newContact);
    localStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(contacts));
    return newContact;
  },

  updateEmergencyContact(id: string, updates: Partial<EmergencyContact>): EmergencyContact | null {
    const contacts = this.getEmergencyContacts();
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) return null;
    contacts[index] = { ...contacts[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(contacts));
    return contacts[index];
  },

  deleteEmergencyContact(id: string): boolean {
    const contacts = this.getEmergencyContacts();
    const filtered = contacts.filter(c => c.id !== id);
    if (filtered.length === contacts.length) return false;
    localStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(filtered));
    return true;
  },

  getActivityLogs(): ActivityLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    return data ? JSON.parse(data) : [];
  },

  addActivityLog(log: Omit<ActivityLog, "id" | "createdAt">): ActivityLog {
    const logs = this.getActivityLogs();
    const newLog = { ...log, id: generateId(), createdAt: new Date().toISOString() };
    logs.unshift(newLog);
    if (logs.length > 50) logs.pop();
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
    return newLog;
  },

  /**
   * Calculate the adjusted remaining quantity based on days elapsed since pickup.
   * If pickup date and quantity are set, automatically deducts daily usage for each day passed.
   */
  getAdjustedQuantity(supply: Supply): number {
    if (!supply.lastPickupDate || supply.quantityAtPickup == null) {
      return supply.currentQuantity;
    }
    
    const pickupDate = new Date(supply.lastPickupDate);
    const today = new Date();
    pickupDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const daysElapsed = Math.floor((today.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysElapsed <= 0) {
      return supply.quantityAtPickup;
    }
    
    // For CGM supplies, calculate sensors used based on cgmDays from settings
    if (supply.type === "cgm") {
      const settings = this.getSettings();
      const cgmDays = settings.cgmDays || 14; // Default to 14 days if not set
      // Assume user applies first sensor on pickup day, so we count from day 0
      // Round down days elapsed to whole sensors used
      const sensorsUsed = Math.floor(daysElapsed / cgmDays);
      const adjusted = supply.quantityAtPickup - sensorsUsed;
      return Math.max(0, adjusted);
    }
    
    // For infusion sets, calculate based on siteChangeDays from settings
    if (supply.type === "infusion_set") {
      const settings = this.getSettings();
      const siteChangeDays = settings.siteChangeDays || 3; // Default to 3 days if not set
      const setsUsed = Math.floor(daysElapsed / siteChangeDays);
      const adjusted = supply.quantityAtPickup - setsUsed;
      return Math.max(0, adjusted);
    }
    
    // For reservoirs, calculate based on reservoirChangeDays from settings
    if (supply.type === "reservoir") {
      const settings = this.getSettings();
      const reservoirChangeDays = settings.reservoirChangeDays || 3; // Default to 3 days if not set
      const reservoirsUsed = Math.floor(daysElapsed / reservoirChangeDays);
      const adjusted = supply.quantityAtPickup - reservoirsUsed;
      return Math.max(0, adjusted);
    }
    
    // For other supplies, use dailyUsage
    if (!supply.dailyUsage || supply.dailyUsage <= 0) {
      return supply.quantityAtPickup;
    }
    
    const usedAmount = daysElapsed * supply.dailyUsage;
    const adjusted = supply.quantityAtPickup - usedAmount;
    return Math.max(0, adjusted);
  },

  /**
   * Get days elapsed since pickup date.
   */
  getDaysSincePickup(supply: Supply): number | null {
    if (!supply.lastPickupDate) return null;
    
    const pickupDate = new Date(supply.lastPickupDate);
    const today = new Date();
    pickupDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return Math.floor((today.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate days remaining based on adjusted quantity / dailyUsage.
   * Uses the adjusted quantity that accounts for daily usage since pickup.
   * For CGM supplies, uses cgmDays from settings instead of dailyUsage.
   */
  getDaysRemaining(supply: Supply): number {
    const adjustedQty = this.getAdjustedQuantity(supply);
    
    // For CGM supplies, use sensor duration from settings
    if (supply.type === "cgm") {
      const settings = this.getSettings();
      const cgmDays = settings.cgmDays || 14; // Default to 14 days if not set
      // Each sensor lasts cgmDays, so total days = sensors * cgmDays
      // Round down for safety (user likely applies sensor soon after pickup)
      return Math.floor(adjustedQty * cgmDays);
    }
    
    // For infusion sets, use site change days from settings
    if (supply.type === "infusion_set") {
      const settings = this.getSettings();
      const siteChangeDays = settings.siteChangeDays || 3; // Default to 3 days if not set
      // Each set lasts siteChangeDays, so total days = sets * siteChangeDays
      return Math.floor(adjustedQty * siteChangeDays);
    }
    
    // For reservoirs, use reservoir change days from settings
    if (supply.type === "reservoir") {
      const settings = this.getSettings();
      const reservoirChangeDays = settings.reservoirChangeDays || 3; // Default to 3 days if not set
      // Each reservoir lasts reservoirChangeDays, so total days = reservoirs * reservoirChangeDays
      return Math.floor(adjustedQty * reservoirChangeDays);
    }
    
    // For other supplies, use dailyUsage
    if (supply.dailyUsage <= 0) return 999;
    return Math.floor(adjustedQty / supply.dailyUsage);
  },

  /**
   * Get the estimated run-out date based on current supply and usage rate.
   */
  getRunOutDate(supply: Supply): Date | null {
    const daysRemaining = this.getDaysRemaining(supply);
    if (daysRemaining >= 999 || daysRemaining < 0) return null;
    
    const runOutDate = new Date();
    runOutDate.setDate(runOutDate.getDate() + daysRemaining);
    return runOutDate;
  },

  getSupplyStatus(supply: Supply): "critical" | "low" | "ok" {
    const days = this.getDaysRemaining(supply);
    if (days <= 3) return "critical";
    if (days <= 7) return "low";
    return "ok";
  },

  /**
   * Check if all required settings are complete.
   * Used to determine dashboard layout (settings at top vs bottom).
   */
  isSettingsComplete(): boolean {
    const settings = this.getSettings();
    const contacts = this.getEmergencyContacts();
    
    const checks = [
      !!settings.tdd,
      !!(settings.breakfastRatio || settings.lunchRatio),
      !!settings.correctionFactor,
      !!(settings.targetBgLow && settings.targetBgHigh),
      contacts.length > 0,
    ];
    
    return checks.every(c => c);
  },

  /**
   * Get settings completion percentage and details.
   */
  getSettingsCompletion(): { percentage: number; completed: number; total: number } {
    const settings = this.getSettings();
    const contacts = this.getEmergencyContacts();
    
    const checks = [
      !!settings.tdd,
      !!(settings.breakfastRatio || settings.lunchRatio),
      !!settings.correctionFactor,
      !!(settings.targetBgLow && settings.targetBgHigh),
      contacts.length > 0,
    ];
    
    const completed = checks.filter(c => c).length;
    const total = checks.length;
    return { 
      percentage: Math.round((completed / total) * 100), 
      completed, 
      total 
    };
  },

  getDashboardWidgets(): DashboardWidget[] {
    const data = localStorage.getItem(STORAGE_KEYS.DASHBOARD_WIDGETS);
    if (!data) {
      const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGETS, JSON.stringify(defaultCopy));
      return defaultCopy;
    }
    const savedWidgets: DashboardWidget[] = JSON.parse(data);
    const savedIds = new Set(savedWidgets.map(w => w.id));
    let updated = false;
    for (const defaultWidget of DEFAULT_WIDGETS) {
      if (!savedIds.has(defaultWidget.id)) {
        const maxOrder = Math.max(...savedWidgets.map(w => w.order), -1);
        savedWidgets.push({ ...defaultWidget, order: maxOrder + 1 });
        updated = true;
      }
    }
    for (const widget of savedWidgets) {
      if (!widget.size) {
        widget.size = DEFAULT_WIDGET_SIZES[widget.type] || "half";
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGETS, JSON.stringify(savedWidgets));
    }
    return savedWidgets;
  },

  saveDashboardWidgets(widgets: DashboardWidget[]): void {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGETS, JSON.stringify(widgets));
  },

  getQuickActions(): QuickActionConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS);
    if (!data) {
      const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_QUICK_ACTIONS));
      localStorage.setItem(STORAGE_KEYS.QUICK_ACTIONS, JSON.stringify(defaultCopy));
      return defaultCopy;
    }
    return JSON.parse(data);
  },

  saveQuickActions(actions: QuickActionConfig[]): void {
    localStorage.setItem(STORAGE_KEYS.QUICK_ACTIONS, JSON.stringify(actions));
  },

  getScenarioState(): ScenarioState {
    const data = localStorage.getItem(STORAGE_KEYS.SCENARIO_STATE);
    return data ? JSON.parse(data) : { travelModeActive: false, sickDayActive: false };
  },

  saveScenarioState(state: ScenarioState): void {
    localStorage.setItem(STORAGE_KEYS.SCENARIO_STATE, JSON.stringify(state));
  },

  activateTravelMode(destination: string, startDate: string, endDate: string, timezoneShift?: number, timezoneDirection?: "east" | "west" | "none"): void {
    const state = this.getScenarioState();
    state.travelModeActive = true;
    state.travelDestination = destination;
    state.travelStartDate = startDate;
    state.travelEndDate = endDate;
    state.travelTimezoneShift = timezoneShift;
    state.travelTimezoneDirection = timezoneDirection;
    this.saveScenarioState(state);
  },

  deactivateTravelMode(): void {
    const state = this.getScenarioState();
    state.travelModeActive = false;
    state.travelDestination = undefined;
    state.travelStartDate = undefined;
    state.travelEndDate = undefined;
    state.travelTimezoneShift = undefined;
    state.travelTimezoneDirection = undefined;
    this.saveScenarioState(state);
  },

  activateSickDay(severity: string): void {
    const state = this.getScenarioState();
    state.sickDayActive = true;
    state.sickDaySeverity = severity;
    this.saveScenarioState(state);
  },

  deactivateSickDay(): void {
    const state = this.getScenarioState();
    state.sickDayActive = false;
    state.sickDaySeverity = undefined;
    this.saveScenarioState(state);
  },

  getCommunityPosts(topic?: CommunityTopicId): CommunityPost[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_POSTS);
    let posts: CommunityPost[] = data ? JSON.parse(data) : [];
    
    if (posts.length === 0) {
      posts = this.seedCommunityPosts();
    }
    
    if (topic) {
      posts = posts.filter(p => p.topic === topic);
    }
    
    return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getCommunityPost(id: string): CommunityPost | null {
    const posts = this.getCommunityPosts();
    return posts.find(p => p.id === id) || null;
  },

  addCommunityPost(post: Omit<CommunityPost, "id" | "replyCount" | "isReported" | "createdAt">): CommunityPost {
    const posts = this.getCommunityPosts();
    const newPost: CommunityPost = {
      ...post,
      id: generateId(),
      replyCount: 0,
      isReported: false,
      createdAt: new Date().toISOString(),
    };
    posts.unshift(newPost);
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(posts));
    return newPost;
  },

  reportCommunityPost(id: string): boolean {
    const posts = this.getCommunityPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return false;
    posts[index].isReported = true;
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(posts));
    return true;
  },

  getCommunityReplies(postId: string): CommunityReply[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_REPLIES);
    const replies: CommunityReply[] = data ? JSON.parse(data) : [];
    return replies
      .filter(r => r.postId === postId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  addCommunityReply(reply: Omit<CommunityReply, "id" | "isReported" | "createdAt">): CommunityReply {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_REPLIES);
    const replies: CommunityReply[] = data ? JSON.parse(data) : [];
    const newReply: CommunityReply = {
      ...reply,
      id: generateId(),
      isReported: false,
      createdAt: new Date().toISOString(),
    };
    replies.push(newReply);
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_REPLIES, JSON.stringify(replies));
    
    const posts = this.getCommunityPosts();
    const postIndex = posts.findIndex(p => p.id === reply.postId);
    if (postIndex !== -1) {
      posts[postIndex].replyCount = (posts[postIndex].replyCount || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(posts));
    }
    
    return newReply;
  },

  reportCommunityReply(id: string): boolean {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_REPLIES);
    const replies: CommunityReply[] = data ? JSON.parse(data) : [];
    const index = replies.findIndex(r => r.id === id);
    if (index === -1) return false;
    replies[index].isReported = true;
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_REPLIES, JSON.stringify(replies));
    return true;
  },

  seedCommunityPosts(): CommunityPost[] {
    const seedPosts: CommunityPost[] = [
      {
        id: generateId(),
        title: "What holiday destinations have you found easiest to manage diabetes in?",
        content: "Planning a trip next summer and wondering where other diabetics have had good experiences. Looking for places with good healthcare access and understanding of T1D.",
        topic: "holidays-travel",
        isAnonymous: true,
        isReported: false,
        replyCount: 0,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "When you're unwell, what's helped you manage your blood sugars?",
        content: "I always struggle when I have a cold or flu. My levels go all over the place. What strategies have worked for you?",
        topic: "sick-days",
        isAnonymous: true,
        isReported: false,
        replyCount: 0,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "What's one diabetes tip you wish you'd learned earlier?",
        content: "I've been T1D for 5 years now and still learning. Would love to hear the little things that made a big difference for others.",
        topic: "tips-what-worked",
        isAnonymous: true,
        isReported: false,
        replyCount: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "How do you handle eating out at restaurants?",
        content: "I find it really hard to estimate carbs when eating out. Any tips for dealing with this?",
        topic: "food-eating-out",
        isAnonymous: true,
        isReported: false,
        replyCount: 0,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "Dealing with diabetes burnout - you're not alone",
        content: "Sometimes it all feels like too much. Just wanted to share that if you're feeling overwhelmed, it's completely normal. What helps you when you're feeling burnt out?",
        topic: "mental-health",
        isAnonymous: true,
        isReported: false,
        replyCount: 0,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_POSTS, JSON.stringify(seedPosts));
    return seedPosts;
  },

  getConversations(): Conversation[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    const conversations: Conversation[] = data ? JSON.parse(data) : [];
    return conversations.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  },

  getOrCreateConversation(participantName: string): Conversation {
    const conversations = this.getConversations();
    let conversation = conversations.find(c => c.participantName === participantName);
    
    if (!conversation) {
      conversation = {
        id: generateId(),
        participantName,
        unreadCount: 0,
      };
      conversations.push(conversation);
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    }
    
    return conversation;
  },

  getMessages(conversationId: string): DirectMessage[] {
    const data = localStorage.getItem(STORAGE_KEYS.DIRECT_MESSAGES);
    const messages: DirectMessage[] = data ? JSON.parse(data) : [];
    return messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  sendMessage(conversationId: string, content: string, senderName: string): DirectMessage {
    const data = localStorage.getItem(STORAGE_KEYS.DIRECT_MESSAGES);
    const messages: DirectMessage[] = data ? JSON.parse(data) : [];
    
    const newMessage: DirectMessage = {
      id: generateId(),
      conversationId,
      senderName,
      content,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    
    messages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.DIRECT_MESSAGES, JSON.stringify(messages));
    
    const conversations = this.getConversations();
    const convIndex = conversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
      conversations[convIndex].lastMessage = content.substring(0, 50);
      conversations[convIndex].lastMessageAt = newMessage.createdAt;
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    }
    
    return newMessage;
  },

  markConversationRead(conversationId: string): void {
    const conversations = this.getConversations();
    const convIndex = conversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
      conversations[convIndex].unreadCount = 0;
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    }
    
    const data = localStorage.getItem(STORAGE_KEYS.DIRECT_MESSAGES);
    const messages: DirectMessage[] = data ? JSON.parse(data) : [];
    const updated = messages.map(m => 
      m.conversationId === conversationId ? { ...m, isRead: true } : m
    );
    localStorage.setItem(STORAGE_KEYS.DIRECT_MESSAGES, JSON.stringify(updated));
  },

  getTotalUnreadCount(): number {
    const conversations = this.getConversations();
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  },

  getFollowing(): FollowRelation[] {
    const data = localStorage.getItem(STORAGE_KEYS.FOLLOWING);
    return data ? JSON.parse(data) : [];
  },

  isFollowing(userName: string): boolean {
    const following = this.getFollowing();
    return following.some(f => f.userName === userName);
  },

  followUser(userName: string): void {
    const following = this.getFollowing();
    if (!following.some(f => f.userName === userName)) {
      following.push({
        userName,
        followedAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEYS.FOLLOWING, JSON.stringify(following));
    }
  },

  unfollowUser(userName: string): void {
    const following = this.getFollowing();
    const filtered = following.filter(f => f.userName !== userName);
    localStorage.setItem(STORAGE_KEYS.FOLLOWING, JSON.stringify(filtered));
  },

  getPostsFromFollowed(): CommunityPost[] {
    const following = this.getFollowing();
    const followedNames = new Set(following.map(f => f.userName));
    const posts = this.getCommunityPosts();
    return posts.filter(p => !p.isAnonymous && p.authorName && followedNames.has(p.authorName));
  },

  getNotificationSettings(): NotificationSettings {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
    return data ? JSON.parse(data) : {
      enabled: true,
      supplyAlerts: true,
      criticalThresholdDays: 3,
      lowThresholdDays: 7,
      browserNotifications: false,
    };
  },

  saveNotificationSettings(settings: NotificationSettings): void {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
  },

  getNotifications(): AppNotification[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    return notifications
      .filter(n => !n.isDismissed)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  addNotification(notification: Omit<AppNotification, "id" | "isRead" | "isDismissed" | "createdAt">): AppNotification {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    
    const existing = notifications.find(
      n => n.type === notification.type && 
           n.supplyId === notification.supplyId && 
           !n.isDismissed
    );
    if (existing) return existing;
    
    const newNotification: AppNotification = {
      ...notification,
      id: generateId(),
      isRead: false,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(newNotification);
    
    if (notifications.length > 100) {
      notifications.splice(50);
    }
    
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    return newNotification;
  },

  markNotificationRead(id: string): void {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].isRead = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  },

  markAllNotificationsRead(): void {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  },

  dismissNotification(id: string): void {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].isDismissed = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  },

  dismissNotificationsBySupply(supplyId: string): void {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifications: AppNotification[] = data ? JSON.parse(data) : [];
    const updated = notifications.map(n => 
      n.supplyId === supplyId ? { ...n, isDismissed: true } : n
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  },

  getUnreadNotificationCount(): number {
    return this.getNotifications().filter(n => !n.isRead).length;
  },

  checkSupplyAlerts(): AppNotification[] {
    const settings = this.getNotificationSettings();
    if (!settings.enabled || !settings.supplyAlerts) return [];
    
    const supplies = this.getSupplies();
    const newNotifications: AppNotification[] = [];
    
    for (const supply of supplies) {
      const daysRemaining = this.getDaysRemaining(supply);
      
      if (daysRemaining <= settings.criticalThresholdDays && daysRemaining >= 0) {
        const notification = this.addNotification({
          type: "supply_critical",
          title: `${supply.name} running out!`,
          message: daysRemaining <= 0 
            ? `You've run out of ${supply.name}. Order refill immediately.`
            : `Only ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left. Order your refill now.`,
          supplyId: supply.id,
          actionUrl: "/supplies",
        });
        if (notification) newNotifications.push(notification);
      } else if (daysRemaining <= settings.lowThresholdDays && daysRemaining > settings.criticalThresholdDays) {
        const notification = this.addNotification({
          type: "supply_low",
          title: `${supply.name} getting low`,
          message: `${daysRemaining} days remaining. Consider ordering a refill soon.`,
          supplyId: supply.id,
          actionUrl: "/supplies",
        });
        if (notification) newNotifications.push(notification);
      }
    }
    
    localStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK, new Date().toISOString());
    return newNotifications;
  },

  getLastNotificationCheck(): Date | null {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK);
    return data ? new Date(data) : null;
  },

  getCommunityReels(): CommunityReel[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_REELS);
    let reels: CommunityReel[] = data ? JSON.parse(data) : [];
    
    if (reels.length === 0) {
      reels = this.seedCommunityReels();
    }
    
    return reels
      .filter(r => r.isActive)
      .sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  },

  seedCommunityReels(): CommunityReel[] {
    const seedReels: CommunityReel[] = [
      {
        id: generateId(),
        title: "5 Things I Wish I Knew When Diagnosed",
        creatorHandle: "@type1tips",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@diabetesuk/video/7234567890123456789",
        description: "Real talk about the early days of T1D management",
        tags: ["tips", "newly-diagnosed", "t1d"],
        isFeatured: true,
        isActive: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "How I Manage Hypos at Work",
        creatorHandle: "@diabeticlife",
        platform: "instagram",
        sourceUrl: "https://www.instagram.com/reel/ABC123example",
        description: "Quick tips for handling low blood sugar in the office",
        tags: ["hypo", "work", "tips"],
        isFeatured: true,
        isActive: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "My CGM Setup Routine",
        creatorHandle: "@t1dtechie",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@t1dtechie/video/7234567890123456790",
        description: "Step by step sensor application for best results",
        tags: ["cgm", "tech", "tutorial"],
        isFeatured: false,
        isActive: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "Travelling with Diabetes - Airport Tips",
        creatorHandle: "@globetrottert1d",
        platform: "instagram",
        sourceUrl: "https://www.instagram.com/reel/XYZ789example",
        description: "What I always pack and how I navigate security",
        tags: ["travel", "airport", "tips"],
        isFeatured: false,
        isActive: true,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "Carb Counting Made Simple",
        creatorHandle: "@diabetesdietitian",
        platform: "youtube",
        sourceUrl: "https://www.youtube.com/shorts/example123",
        description: "Quick visual guide to estimating carbs",
        tags: ["carbs", "food", "tutorial"],
        isFeatured: false,
        isActive: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        title: "Exercise and Blood Sugar - What Really Happens",
        creatorHandle: "@fitdiabetic",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@fitdiabetic/video/7234567890123456791",
        description: "The science behind exercise-induced glucose changes",
        tags: ["exercise", "fitness", "education"],
        isFeatured: false,
        isActive: true,
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_REELS, JSON.stringify(seedReels));
    return seedReels;
  },

  suggestReel(reel: Omit<CommunityReel, "id" | "isFeatured" | "isActive" | "createdAt">): CommunityReel {
    const data = localStorage.getItem(STORAGE_KEYS.COMMUNITY_REELS);
    const reels: CommunityReel[] = data ? JSON.parse(data) : [];
    
    const newReel: CommunityReel = {
      ...reel,
      id: generateId(),
      isFeatured: false,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    
    reels.push(newReel);
    localStorage.setItem(STORAGE_KEYS.COMMUNITY_REELS, JSON.stringify(reels));
    return newReel;
  },

  // Appointments
  getAppointments(): Appointment[] {
    const data = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (!data) return [];
    const appointments: Appointment[] = JSON.parse(data);
    return appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  addAppointment(appointment: Omit<Appointment, "id" | "createdAt">): Appointment {
    const appointments = this.getAppointments();
    const newAppointment: Appointment = {
      ...appointment,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    appointments.push(newAppointment);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return newAppointment;
  },

  updateAppointment(id: string, updates: Partial<Appointment>): Appointment | null {
    const appointments = this.getAppointments();
    const index = appointments.findIndex(a => a.id === id);
    if (index === -1) return null;
    appointments[index] = { ...appointments[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return appointments[index];
  },

  deleteAppointment(id: string): boolean {
    const appointments = this.getAppointments();
    const filtered = appointments.filter(a => a.id !== id);
    if (filtered.length === appointments.length) return false;
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(filtered));
    return true;
  },

  getUpcomingAppointments(): Appointment[] {
    const appointments = this.getAppointments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments.filter(a => !a.isCompleted && new Date(a.date) >= today);
  },

  // Events
  getEvents(): DiabetesEvent[] {
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!data) {
      return this.seedEvents();
    }
    let events: DiabetesEvent[] = JSON.parse(data);
    // Migrate old events without eventSource field
    let needsSave = false;
    events = events.map(e => {
      if (!e.eventSource) {
        needsSave = true;
        return { ...e, eventSource: "official" as const };
      }
      return e;
    });
    if (needsSave) {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    }
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  seedEvents(): DiabetesEvent[] {
    const today = new Date();
    const seedEvents: DiabetesEvent[] = [
      {
        id: generateId(),
        title: "JDRF One Walk London",
        description: "Join thousands walking to fund type 1 diabetes research",
        date: new Date(today.getFullYear(), today.getMonth() + 2, 15).toISOString().split("T")[0],
        time: "10:00",
        location: "Hyde Park, London",
        organizer: "JDRF UK",
        eventUrl: "https://jdrf.org.uk/",
        eventType: "walk",
        eventSource: "official",
        isInterested: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Diabetes UK Local Meetup - Manchester",
        description: "Monthly meetup for people living with diabetes",
        date: new Date(today.getFullYear(), today.getMonth() + 1, 8).toISOString().split("T")[0],
        time: "18:30",
        location: "The Meeting House, Manchester",
        organizer: "Diabetes UK",
        eventUrl: "https://www.diabetes.org.uk/",
        eventType: "meetup",
        eventSource: "official",
        isInterested: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "World Diabetes Day",
        description: "Annual awareness day - activities nationwide",
        date: new Date(today.getFullYear(), 10, 14).toISOString().split("T")[0],
        location: "Nationwide",
        organizer: "International Diabetes Federation",
        eventType: "awareness",
        eventSource: "official",
        isInterested: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "T1D Support Group - Birmingham",
        description: "Peer support for Type 1 diabetics and families",
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14).toISOString().split("T")[0],
        time: "19:00",
        location: "Community Centre, Birmingham",
        organizer: "T1D Warriors",
        eventType: "support_group",
        eventSource: "official",
        isInterested: false,
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(seedEvents));
    return seedEvents;
  },

  toggleEventInterest(id: string): DiabetesEvent | null {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    if (index === -1) return null;
    events[index].isInterested = !events[index].isInterested;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    return events[index];
  },

  getUpcomingEvents(): DiabetesEvent[] {
    const events = this.getEvents();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter(e => new Date(e.date) >= today);
  },

  addEvent(event: Omit<DiabetesEvent, "id" | "createdAt" | "isInterested">): DiabetesEvent {
    const events = this.getEvents();
    const newEvent: DiabetesEvent = {
      ...event,
      id: generateId(),
      isInterested: false,
      createdAt: new Date().toISOString(),
    };
    events.push(newEvent);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    return newEvent;
  },

  deleteEvent(id: string): boolean {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return false;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filtered));
    return true;
  },

  // AI Coach conversation history
  getAICoachHistory(): AICoachMessage[] {
    const data = localStorage.getItem(STORAGE_KEYS.AI_COACH_HISTORY);
    return data ? JSON.parse(data) : [];
  },

  addAICoachMessage(role: "user" | "assistant", content: string): AICoachMessage {
    const history = this.getAICoachHistory();
    const message: AICoachMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    history.push(message);
    // Keep last 100 messages to avoid localStorage limits
    const trimmed = history.slice(-100);
    localStorage.setItem(STORAGE_KEYS.AI_COACH_HISTORY, JSON.stringify(trimmed));
    return message;
  },

  clearAICoachHistory(): void {
    localStorage.removeItem(STORAGE_KEYS.AI_COACH_HISTORY);
  },

  // Routines - personal success patterns
  getRoutines(): Routine[] {
    const data = localStorage.getItem(STORAGE_KEYS.ROUTINES);
    return data ? JSON.parse(data) : [];
  },

  getRoutine(id: string): Routine | null {
    const routines = this.getRoutines();
    return routines.find(r => r.id === id) || null;
  },

  addRoutine(routine: Omit<Routine, "id" | "timesUsed" | "createdAt" | "updatedAt">): Routine {
    const routines = this.getRoutines();
    const newRoutine: Routine = {
      ...routine,
      id: generateId(),
      timesUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    routines.push(newRoutine);
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    return newRoutine;
  },

  updateRoutine(id: string, updates: Partial<Omit<Routine, "id" | "createdAt">>): Routine | null {
    const routines = this.getRoutines();
    const index = routines.findIndex(r => r.id === id);
    if (index === -1) return null;
    routines[index] = {
      ...routines[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    return routines[index];
  },

  deleteRoutine(id: string): boolean {
    const routines = this.getRoutines();
    const filtered = routines.filter(r => r.id !== id);
    if (filtered.length === routines.length) return false;
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));
    return true;
  },

  useRoutine(id: string): Routine | null {
    const routines = this.getRoutines();
    const index = routines.findIndex(r => r.id === id);
    if (index === -1) return null;
    routines[index] = {
      ...routines[index],
      timesUsed: routines[index].timesUsed + 1,
      lastUsed: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    return routines[index];
  },

  getRoutinesByMealType(mealType: RoutineMealType): Routine[] {
    return this.getRoutines().filter(r => r.mealType === mealType);
  },

  getMostUsedRoutines(limit: number = 5): Routine[] {
    return this.getRoutines()
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, limit);
  },

  getRecentRoutines(limit: number = 5): Routine[] {
    return this.getRoutines()
      .filter(r => r.lastUsed)
      .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
      .slice(0, limit);
  },

  exportAllData(): string {
    const data: Record<string, unknown> = {};
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const value = localStorage.getItem(storageKey);
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
    data._exportedAt = new Date().toISOString();
    data._version = "1.0";
    return JSON.stringify(data, null, 2);
  },

  importAllData(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") {
        return { success: false, error: "Invalid data format" };
      }

      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (data[key] !== undefined) {
          const value = typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]);
          localStorage.setItem(storageKey, value);
        }
      }
      return { success: true };
    } catch {
      return { success: false, error: "Could not read the file. Please check it's a valid Diabeaters backup." };
    }
  },
};
