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
  ROUTINES: "diabeater_routines",
  PRESCRIPTION_CYCLE: "diabeater_prescription_cycle",
  CARER_LINKS: "diabeater_carer_links",
  CARER_PRIVACY: "diabeater_carer_privacy",
  CARER_ACTIVITY_LOG: "diabeater_carer_activity_log",
  HYPO_TREATMENTS: "diabeater_hypo_treatments",
  CARER_MODE: "diabeater_carer_mode",
  CARER_INVITE_CODE: "diabeater_carer_invite_code",
  TRAVEL_PLAN: "diabeater_travel_plan",
  TRAVEL_PACKING_LIST: "diabeater_travel_packing_list",
  BACKUP_REMINDER_DISMISSED: "diabeater_backup_reminder_dismissed",
  LAST_BACKUP_DATE: "diabeater_last_backup_date",
  HOLIDAY_PREP: "diabeater_holiday_prep",
  RATIO_HISTORY: "diabeater_ratio_history",
  BEDTIME_LOGS: "diabeater_bedtime_logs",
  SICK_DAY_JOURNAL: "diabeater_sick_day_journal",
  SCENARIO_HISTORY: "diabeater_scenario_history",
  EXERCISE_ROUTINES: "diabeater_exercise_routines",
  ACTIVE_EXERCISE: "diabeater_active_exercise",
  EXERCISE_OUTCOMES: "diabeater_exercise_outcomes",
} as const;

/** Tracks which Supabase user id local appointment rows belong to (browser localStorage is shared across accounts). */
export const ACTIVE_USER_ID_KEY = "diabeater_active_user_id";

/** Dispatched on same-tab when `ACTIVE_USER_ID_KEY` changes so widgets can reload scoped data. */
export const DIABEATER_ACTIVE_USER_CHANGED_EVENT = "diabeater-active-user-changed";

/** Dispatched when `saveSettings` updates local storage (same-tab; settings completion UI can refresh). */
export const DIABEATER_SETTINGS_CHANGED_EVENT = "diabeater-settings-changed";

/** Same-tab: local appointment rows changed (storage event does not fire in the writing tab). */
export const DIABEATER_APPOINTMENTS_CHANGED_EVENT = "diabeater-appointments-changed";

function notifyAppointmentsLocalChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DIABEATER_APPOINTMENTS_CHANGED_EVENT));
}

export function getAppointmentsStorageKey(): string | null {
  if (typeof window === "undefined") return null;
  const uid = localStorage.getItem(ACTIVE_USER_ID_KEY);
  return uid ? `${STORAGE_KEYS.APPOINTMENTS}_u_${uid}` : null;
}

/** Stable key for a given auth user — use in sync paths so reads never use a stale `ACTIVE_USER_ID_KEY`. */
export function getAppointmentsStorageKeyForUserId(userId: string): string {
  return `${STORAGE_KEYS.APPOINTMENTS}_u_${userId}`;
}

export function setActiveUserIdForLocalStorage(uid: string | null): void {
  if (typeof window === "undefined") return;
  const prev = localStorage.getItem(ACTIVE_USER_ID_KEY);
  if (uid) {
    localStorage.setItem(ACTIVE_USER_ID_KEY, uid);
    try {
      // Legacy unscoped key would leak prior-account data into new sessions.
      localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    } catch {
      /* ignore */
    }
  } else {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
  }
  if (prev !== (uid ?? null)) {
    window.dispatchEvent(new Event(DIABEATER_ACTIVE_USER_CHANGED_EVENT));
  }
}

export function isAppointmentsStorageKey(key: string | null): boolean {
  if (!key) return false;
  if (key === STORAGE_KEYS.APPOINTMENTS) return true;
  return key.startsWith(`${STORAGE_KEYS.APPOINTMENTS}_u_`);
}

const LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY = "diabeater_welcome_dismissed";

/** Per-user key so another account on the same browser does not inherit dismiss state. */
function welcomeStruggleDismissedKeyForUser(uid: string): string {
  return `${LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY}_u_${uid}`;
}

/** Whether the onboarding struggle welcome card should stay hidden (X or CTA). */
export function isWelcomeStruggleCardDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const uid = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (uid) {
      const scoped = localStorage.getItem(welcomeStruggleDismissedKeyForUser(uid));
      if (scoped === "true") return true;
      const legacy = localStorage.getItem(LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY);
      if (legacy === "true") {
        localStorage.setItem(welcomeStruggleDismissedKeyForUser(uid), "true");
        localStorage.removeItem(LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY);
        return true;
      }
      return false;
    }
    return localStorage.getItem(LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setWelcomeStruggleCardDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    const uid = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (uid) {
      localStorage.setItem(welcomeStruggleDismissedKeyForUser(uid), "true");
    } else {
      localStorage.setItem(LEGACY_WELCOME_STRUGGLE_DISMISSED_KEY, "true");
    }
  } catch {
    /* ignore */
  }
}

export type RatioFormat = "per10g" | "1toXg" | "perCP";

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
  ratioFormat?: RatioFormat;
  carbPortionSize?: number;
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
  shortActingInjectionsPerDay?: number;
  longActingInjectionsPerDay?: number;
  cgmDays?: number;
  siteChangeDays?: number;
  reservoirChangeDays?: number;
  reservoirCapacity?: number;
  unitsPerInsulinPen?: number;
  needlesPerBox?: number;
  infusionSetsPerBox?: number;
  reservoirsPerBox?: number;
  insulinCartridgeUnits?: number;
  basalInjectionTime?: string;
  primingUnitsPerInjection?: number;
  suppliesSmarterForecastEnabled?: boolean;
}

export interface Supply {
  id: string;
  name: string;
  type: "needle" | "insulin" | "insulin_short" | "insulin_long" | "insulin_vial" | "cgm" | "infusion_set" | "reservoir" | "other";
  currentQuantity: number;
  dailyUsage: number;
  lastPickupDate?: string;
  quantityAtPickup?: number;
  typicalRefillQuantity?: number;
  notes?: string;
  isOnOrder?: boolean;
  orderedDate?: string;
  activeItemStartDate?: string;
  /** Cloud row id from Supabase `public.supplies` (if linked). */
  cloud_id?: string | null;
  /** Last-write-wins timestamp for cloud/local reconciliation (ISO). */
  updated_at?: string;
}

export type SupplyType = Supply["type"];

export interface HolidayPrep {
  id: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  notes?: string;
  checklist: { id: string; label: string; checked: boolean }[];
  createdAt: string;
}

export type CarerPermission = "view" | "manage" | "full";

export interface CarerLink {
  id: string;
  name: string;
  relationship: string;
  email: string;
  permission: CarerPermission;
  linkedAt: string;
  lastActive?: string;
  avatar?: string;
}

export interface CarerPrivacySettings {
  shareSupplies: boolean;
  shareAppointments: boolean;
  shareScenarios: boolean;
  shareHypoAlerts: boolean;
  shareActivityAdviser: boolean;
}

export interface CarerActivityLogEntry {
  id: string;
  carerName: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface HypoTreatment {
  id: string;
  timestamp: string;
  glucoseLevel?: number;
  treatment?: string;
  notes?: string;
  carerNotified: boolean;
  /** Supabase hypo_logs row id (if synced). */
  supabaseHypoLogId?: string;
  followUpGlucose?: number;
  followUpTime?: string;
}

/** `settingsKey` omitted when pack size is fixed (e.g. CGM: one sensor per dispensing unit). */
type SupplyPackDefaultDef = { increment: number; label: string; settingsKey?: keyof UserSettings };

export const SUPPLY_PACK_DEFAULTS: Record<SupplyType, SupplyPackDefaultDef> = {
  insulin: { increment: 300, label: "pen", settingsKey: "unitsPerInsulinPen" },
  insulin_short: { increment: 300, label: "pen", settingsKey: "unitsPerInsulinPen" },
  insulin_long: { increment: 300, label: "pen", settingsKey: "unitsPerInsulinPen" },
  insulin_vial: { increment: 1000, label: "vial", settingsKey: "unitsPerInsulinPen" },
  needle: { increment: 100, label: "box", settingsKey: "needlesPerBox" },
  cgm: { increment: 1, label: "sensor" },
  infusion_set: { increment: 10, label: "box", settingsKey: "infusionSetsPerBox" },
  reservoir: { increment: 10, label: "box", settingsKey: "reservoirsPerBox" },
  other: { increment: 1, label: "unit", settingsKey: "needlesPerBox" },
};

export function getSupplyIncrement(type: SupplyType, settings?: UserSettings): { amount: number; label: string } {
  const s = settings || storage.getSettings();
  const packInfo = SUPPLY_PACK_DEFAULTS[type];
  const customValue = packInfo.settingsKey ? (s[packInfo.settingsKey] as number | undefined) : undefined;

  if (type === "other") {
    return { amount: 1, label: "unit" };
  }

  if (type === "insulin_vial") {
    const amount = Math.max(1, customValue || packInfo.increment);
    return { amount, label: "vial" };
  }

  if (type === "insulin" || type === "insulin_short" || type === "insulin_long") {
    const amount = Math.max(1, customValue || packInfo.increment);
    return { amount, label: amount === 1 ? "unit" : "pen" };
  }

  if (type === "needle") {
    const amount = Math.max(1, customValue || packInfo.increment);
    return { amount, label: amount === 1 ? "needle" : "box" };
  }
  if (type === "cgm") {
    return { amount: 1, label: "sensor" };
  }
  if (type === "infusion_set") {
    const amount = Math.max(1, customValue || packInfo.increment);
    return { amount, label: amount === 1 ? "set" : "box" };
  }
  if (type === "reservoir") {
    const amount = Math.max(1, customValue || packInfo.increment);
    return { amount, label: amount === 1 ? "reservoir" : "box" };
  }

  return { amount: 1, label: "unit" };
}

export function getUnitsPerPen(settings?: UserSettings): number {
  const s = settings || storage.getSettings();
  return Math.max(1, s.unitsPerInsulinPen || s.insulinCartridgeUnits || 300);
}

export function getInsulinContainerLabel(type?: SupplyType): string {
  if (type === "insulin_vial") return "vial";
  return "pen";
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
  | "supply-depletion"
  | "settings-completion"
  | "ratio-adviser"
  | "welcome"
  | "tip-of-day"
  | "appointments"
  | "routines"
  | "quick-exercise";

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
  sickDayActivatedAt?: string;
}

export interface BedtimeLog {
  id: string;
  date: string;
  currentBg: number;
  bgUnits: string;
  readinessLevel: "steady" | "monitor" | "alert";
  hoursSinceFood: number | null;
  hoursSinceInsulin: number | null;
  hoursUntilSleep?: number | null;
  /** rising/steady/falling, if user provided */
  bgTrend?: "rising" | "steady" | "falling";
  /** optional meal carbs estimate, if user provided */
  mealCarbs?: number | null;
  /** true if user reported any recent hypos today / overnight risk */
  recentHypos?: boolean;
  /** user intent only (we can't reliably schedule across platforms) */
  alarmPlanned?: boolean;
  exercisedToday: boolean;
  hadAlcohol: boolean;
  sickDayActive: boolean;
  travelModeActive: boolean;
  correctionGiven: number | null;
  notes: string;
}

export interface SickDayJournalEntry {
  id: string;
  timestamp: string;
  bg: number;
  bgUnits: string;
  ketoneLevel: string;
  correctionDose: number | null;
  fluidsml: number | null;
  symptoms: string;
  notes: string;
  severity: string;
}

export interface ScenarioHistoryEntry {
  id: string;
  type: "sick_day" | "travel";
  startDate: string;
  endDate: string | null;
  destination?: string;
  severity?: string;
  notes: string;
  journalEntryCount?: number;
}

export interface RatioHistoryEntry {
  id: string;
  date: string;
  breakfastRatio?: string;
  lunchRatio?: string;
  dinnerRatio?: string;
  snackRatio?: string;
  correctionFactor?: number;
  note?: string;
}

import type { CommunityTopicId } from "./community/topics";

export {
  COMMUNITY_TOPICS,
  DEFAULT_COMMUNITY_TOPIC,
  communityTopicLabel,
  isCommunityTopicId,
} from "./community/topics";
export type { CommunityTopicId } from "./community/topics";

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
  /** iOS push notifications (Capacitor). */
  pushNotifications: boolean;
  supplyAlerts: boolean;
  criticalThresholdDays: number;
  lowThresholdDays: number;
  browserNotifications: boolean;
  /** Appointment reminder notifications (in-app + push where available). */
  appointmentReminders: boolean;
  hypoAlerts?: boolean;
  scenarioAlerts?: boolean;
  /** When true, dashboard "Treated a Hypo" logs and notifies without opening the detail dialog first. */
  hypoDashboardQuickNotify?: boolean;
  /** Likes and comments on your community posts (in-app inbox; synced as feed_alerts). */
  communityFeedAlerts?: boolean;
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
  updatedAt?: string;
  deletedAt?: string;
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
  | "settings"
  | "appointments"
  | "emergency-card";

export interface QuickActionConfig {
  id: QuickActionId;
  enabled: boolean;
  order: number;
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

export type ExerciseType = "cardio" | "strength" | "hiit" | "yoga" | "walking" | "court" | "field" | "swimming";

/** Legacy stored value; migrated to `field` on read. */
const LEGACY_EXERCISE_TYPE_SPORTS = "sports";

/** Map old persisted `sports` to `field`; pass through valid types. */
export function migrateExerciseType(raw: string): ExerciseType {
  if (raw === LEGACY_EXERCISE_TYPE_SPORTS) return "field";
  const allowed: ExerciseType[] = ["cardio", "strength", "hiit", "yoga", "walking", "court", "field", "swimming"];
  if (allowed.includes(raw as ExerciseType)) return raw as ExerciseType;
  return "cardio";
}
export type ExerciseIntensity = "light" | "moderate" | "intense";

export interface ExerciseRoutine {
  id: string;
  name: string;
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  notes?: string;
  timesUsed: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExercisePhase = "pre" | "active" | "recovery";

/** Optional CGM-style direction; fingerstick users often pick not_sure. */
export type ExerciseBgTrend = "rising" | "flat" | "falling" | "not_sure";

export interface ActiveExerciseSession {
  id: string;
  routineId?: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  phase: ExercisePhase;
  startedAt: string;
  exerciseStartedAt?: string;
  exerciseEndedAt?: string;
  recoveryEndsAt?: string;
  recoveryMinutes: number;
  midCheckDone: boolean;
  preChecklist: {
    bgChecked: boolean;
    carbsConsidered: boolean;
    basalAdjusted: boolean;
  };
  /** Optional BG log — pre-exercise (educational prompts only; not dosing). */
  preBg?: number;
  preTrend?: ExerciseBgTrend;
  preBgAt?: string;
  preBgSkipped?: boolean;
  /** Mid-session reading (often at timed check-in). */
  midBg?: number;
  midTrend?: ExerciseBgTrend;
  midBgAt?: string;
  midBgSkipped?: boolean;
  /** Start of recovery window. */
  recoveryBg?: number;
  recoveryTrend?: ExerciseBgTrend;
  recoveryBgAt?: string;
  recoveryBgSkipped?: boolean;
}

export interface ExerciseOutcome {
  id: string;
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  exerciseName: string;
  bgResponse?: "dropped" | "stable" | "rose";
  bgSeverity?: "a_lot" | "a_little";
  feltHypo: boolean;
  notes?: string;
  completedAt: string;
}

export const ALL_QUICK_ACTIONS: { id: QuickActionId; label: string; href: string; iconName: string; color: string }[] = [
  { id: "supplies", label: "Supplies", href: "/supplies", iconName: "Package", color: "text-blue-600" },
  { id: "activity", label: "Activity", href: "/adviser", iconName: "Dumbbell", color: "text-green-600" },
  { id: "bedtime", label: "Bedtime", href: "/scenarios/bedtime", iconName: "Moon", color: "text-indigo-600" },
  { id: "routines", label: "Routines", href: "/tools/routines", iconName: "Repeat", color: "text-emerald-600" },
  { id: "sick-day", label: "Sick Day", href: "/scenarios/sick-day", iconName: "Thermometer", color: "text-orange-600" },
  { id: "travel", label: "Travel", href: "/scenarios/travel", iconName: "Plane", color: "text-purple-600" },
  { id: "ratios", label: "Ratios", href: "/ratios", iconName: "Calculator", color: "text-teal-600" },
  { id: "appointments", label: "Appointments", href: "/appointments", iconName: "Calendar", color: "text-cyan-600" },
  { id: "emergency-card", label: "Travel Emergency", href: "/emergency-card", iconName: "ShieldAlert", color: "text-red-600" },
  { id: "settings", label: "Settings", href: "/settings", iconName: "Settings", color: "text-gray-600" },
];

export const DEFAULT_QUICK_ACTIONS: QuickActionConfig[] = [
  { id: "activity", enabled: true, order: 0 },
  { id: "bedtime", enabled: true, order: 1 },
  { id: "routines", enabled: true, order: 2 },
  { id: "settings", enabled: true, order: 3 },
];

// Legacy seed for `getDashboardWidgets` — keep aligned with DASHBOARD_WIDGET_REGISTRY defaults (useDashboardWidgets is primary).
export const DEFAULT_WIDGET_SIZES: Record<WidgetType, WidgetSize> = {
  "supply-depletion": "full",
  "quick-exercise": "half",
  "ratio-adviser": "half",
  "appointments": "half",
  "routines": "half",
  "supply-summary": "full",
  "tip-of-day": "full",
  "settings-completion": "half",
  "welcome": "full",
};

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "supply-depletion", type: "supply-depletion", enabled: true, order: 0, size: "full" },
  { id: "quick-exercise", type: "quick-exercise", enabled: true, order: 1, size: "half" },
  { id: "ratio-adviser", type: "ratio-adviser", enabled: true, order: 2, size: "half" },
  { id: "appointments", type: "appointments", enabled: true, order: 3, size: "half" },
  { id: "routines", type: "routines", enabled: true, order: 4, size: "half" },
  { id: "supply-summary", type: "supply-summary", enabled: true, order: 5, size: "full" },
  { id: "tip-of-day", type: "tip-of-day", enabled: true, order: 6, size: "full" },
  { id: "settings-completion", type: "settings-completion", enabled: true, order: 7, size: "half" },
  { id: "welcome", type: "welcome", enabled: false, order: 8, size: "full" },
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
    const { sensorsPerBox: _legacySensorsPerBox, ...rest } = settings as UserSettings & {
      sensorsPerBox?: number;
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(rest));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DIABEATER_SETTINGS_CHANGED_EVENT));
    }
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
      if (supply.dailyUsage > 0) {
        this.syncSupplyUsageToSettings(supply.type, supply.dailyUsage);
      }
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
    if (supply.dailyUsage > 0) {
      this.syncSupplyUsageToSettings(supply.type, supply.dailyUsage);
    }
    return { supply: newSupply, merged: false };
  },

  updateSupply(id: string, updates: Partial<Supply>): Supply | null {
    const supplies = this.getSupplies();
    const index = supplies.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    const current = supplies[index];
    
    if (updates.currentQuantity !== undefined && 
        updates.quantityAtPickup === undefined && 
        current.quantityAtPickup !== undefined) {
      const delta = updates.currentQuantity - current.currentQuantity;
      updates.quantityAtPickup = Math.max(0, current.quantityAtPickup + delta);
    }
    
    supplies[index] = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    if (updates.dailyUsage !== undefined && updates.dailyUsage > 0) {
      const supplyType = updates.type || current.type;
      this.syncSupplyUsageToSettings(supplyType, updates.dailyUsage);
    }
    return supplies[index];
  },

  /**
   * Set the *displayed* remaining stock "as of today", while keeping the
   * pickup-based auto-deduction model consistent.
   *
   * When a supply has `lastPickupDate` + `quantityAtPickup`, the UI displays
   * `getAdjustedQuantity()` (derived from pickup baseline and usage). If we only
   * update `currentQuantity`, the displayed value can appear to jump back.
   *
   * This helper updates `quantityAtPickup` (baseline) so that `getAdjustedQuantity()`
   * evaluates to `desiredRemainingNow` on the current date.
   */
  setSupplyRemainingNow(id: string, desiredRemainingNow: number): Supply | null {
    const supplies = this.getSupplies();
    const index = supplies.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const current = supplies[index];
    const desired = Math.max(0, Math.floor(desiredRemainingNow));

    // If we don't have a pickup baseline, fall back to a simple quantity update.
    if (!current.lastPickupDate || current.quantityAtPickup == null) {
      return this.updateSupply(id, { currentQuantity: desired });
    }

    const today = new Date();
    const pickupDate = new Date(current.lastPickupDate);
    pickupDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const daysElapsed = Math.max(
      0,
      Math.floor((today.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Duration-based supplies are depleted in whole items.
    if (current.type === "cgm" || current.type === "infusion_set" || current.type === "reservoir") {
      const itemDuration = this.getItemDuration(current.type);
      if (itemDuration <= 0) {
        return this.updateSupply(id, { currentQuantity: desired, quantityAtPickup: desired });
      }

      if (current.activeItemStartDate) {
        const info = this.getActiveItemInfo(current);
        // While an item is active (not expired), adjusted quantity stays at quantityAtPickup.
        if (info && !info.isExpired) {
          return this.updateSupply(id, { currentQuantity: desired, quantityAtPickup: desired });
        }
      }

      const itemsUsed = Math.floor(daysElapsed / itemDuration);
      const nextPickupBaseline = Math.max(0, desired + itemsUsed);
      return this.updateSupply(id, { currentQuantity: desired, quantityAtPickup: nextPickupBaseline });
    }

    const settings = this.getSettings();
    const effectiveDailyUsage = this.getEffectiveDailyUsage(current, settings);
    if (effectiveDailyUsage <= 0) {
      return this.updateSupply(id, { currentQuantity: desired, quantityAtPickup: desired });
    }

    const usedAmount = daysElapsed * effectiveDailyUsage;
    const nextPickupBaseline = Math.max(0, desired + usedAmount);
    return this.updateSupply(id, { currentQuantity: desired, quantityAtPickup: nextPickupBaseline });
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

  markSupplyOrdered(id: string): Supply | null {
    return this.updateSupply(id, { isOnOrder: true, orderedDate: new Date().toISOString() });
  },

  clearSupplyOrder(id: string): Supply | null {
    return this.updateSupply(id, { isOnOrder: false, orderedDate: undefined });
  },

  getItemDuration(type: Supply["type"]): number {
    const settings = this.getSettings();
    if (type === "cgm") return settings.cgmDays || 14;
    if (type === "infusion_set") return settings.siteChangeDays || 3;
    if (type === "reservoir") return settings.reservoirChangeDays || 3;
    return 0;
  },

  getActiveItemInfo(supply: Supply): { daysLeft: number; isExpired: boolean; effectiveStartDate: string } | null {
    if (!supply.activeItemStartDate) return null;
    const duration = this.getItemDuration(supply.type);
    if (duration <= 0) return null;

    const activeStart = new Date(supply.activeItemStartDate);
    const today = new Date();
    activeStart.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const daysSinceOriginalStart = Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceOriginalStart < duration) {
      const daysLeft = duration - daysSinceOriginalStart;
      return { daysLeft, isExpired: false, effectiveStartDate: supply.activeItemStartDate };
    }

    const cyclesCompleted = Math.floor(daysSinceOriginalStart / duration);
    const effectiveStart = new Date(activeStart);
    effectiveStart.setDate(effectiveStart.getDate() + cyclesCompleted * duration);
    const daysIntoCurrentCycle = daysSinceOriginalStart - cyclesCompleted * duration;
    const daysLeft = Math.max(0, duration - daysIntoCurrentCycle);

    return {
      daysLeft,
      isExpired: daysLeft === 0,
      effectiveStartDate: effectiveStart.toISOString(),
    };
  },

  markItemChangedEarly(id: string): Supply | null {
    const supply = this.getSupplies().find(s => s.id === id);
    if (!supply) return null;
    const info = this.getActiveItemInfo(supply);
    if (!info) return null;

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const adjustedQty = this.getAdjustedQuantity(supply);
    const newQuantity = Math.max(0, adjustedQty - 1);
    return this.updateSupply(id, {
      activeItemStartDate: today.toISOString(),
      currentQuantity: newQuantity,
      quantityAtPickup: newQuantity,
      lastPickupDate: new Date().toISOString(),
    });
  },

  getSmartPrescriptionAdvice(supplies: Supply[]): {
    collectSoon: { supply: Supply; daysUntilCollect: number; reason: string }[];
    skipSuggestions: { supply: Supply; daysRemaining: number; reason: string }[];
    travelExtras: { supply: Supply; extraNeeded: number; reason: string }[];
    orderedSupplies: { supply: Supply; daysSinceOrder: number; estimatedCollectBy: number }[];
  } {
    const cycle = this.getPrescriptionCycle();
    const scenarioState = this.getScenarioState();
    const settings = this.getSettings();
    const leadTime = cycle?.leadTimeDays || 5;

    const collectSoon: { supply: Supply; daysUntilCollect: number; reason: string }[] = [];
    const skipSuggestions: { supply: Supply; daysRemaining: number; reason: string }[] = [];
    const travelExtras: { supply: Supply; extraNeeded: number; reason: string }[] = [];
    const orderedSupplies: { supply: Supply; daysSinceOrder: number; estimatedCollectBy: number }[] = [];

    for (const supply of supplies) {
      const daysRemaining = this.getDaysRemaining(supply);
      const adjustedQty = this.getAdjustedQuantity(supply);

      if (supply.isOnOrder && supply.orderedDate) {
        const orderDate = new Date(supply.orderedDate);
        const today = new Date();
        orderDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const daysSinceOrder = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilCollect = leadTime - daysSinceOrder;

        orderedSupplies.push({
          supply,
          daysSinceOrder,
          estimatedCollectBy: Math.max(0, daysUntilCollect),
        });

        const isOverdue = daysUntilCollect < 0;
        const overdueDays = Math.abs(daysUntilCollect);

        if (adjustedQty <= 0 || daysRemaining <= 0) {
          collectSoon.push({
            supply,
            daysUntilCollect,
            reason: isOverdue
              ? `You're out of ${supply.name} — prescription should be ready (ordered ${overdueDays} day${overdueDays !== 1 ? "s" : ""} ago), collect now`
              : `You're out of ${supply.name} — collect within ${daysUntilCollect} day${daysUntilCollect !== 1 ? "s" : ""}`,
          });
        } else if (daysRemaining <= 3) {
          collectSoon.push({
            supply,
            daysUntilCollect,
            reason: isOverdue
              ? `Only ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} of ${supply.name} left — prescription should be ready, collect now`
              : `Only ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} of ${supply.name} left — collect within ${daysUntilCollect} day${daysUntilCollect !== 1 ? "s" : ""}`,
          });
        } else if (isOverdue) {
          collectSoon.push({
            supply,
            daysUntilCollect,
            reason: `${supply.name} prescription should be ready to collect (ordered ${daysSinceOrder} day${daysSinceOrder !== 1 ? "s" : ""} ago)`,
          });
        }
      } else if (!supply.isOnOrder && daysRemaining <= 0) {
        collectSoon.push({
          supply,
          daysUntilCollect: -1,
          reason: `You're out of ${supply.name} — order now`,
        });
      } else if (!supply.isOnOrder && daysRemaining > 0 && daysRemaining <= leadTime) {
        collectSoon.push({
          supply,
          daysUntilCollect: -1,
          reason: `${supply.name} will run out in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} — time to order`,
        });
      }

      const intervalDays = cycle?.intervalDays || 28;
      if (daysRemaining > intervalDays * 1.5 && daysRemaining < 999) {
        skipSuggestions.push({
          supply,
          daysRemaining,
          reason: `You have ${daysRemaining} days of ${supply.name} — consider skipping this on your next prescription`,
        });
      }
    }

    if (scenarioState.travelModeActive && scenarioState.travelStartDate && scenarioState.travelEndDate) {
      const travelStart = new Date(scenarioState.travelStartDate);
      const travelEnd = new Date(scenarioState.travelEndDate);
      travelStart.setHours(0, 0, 0, 0);
      travelEnd.setHours(0, 0, 0, 0);
      const tripDuration = Math.max(1, Math.floor((travelEnd.getTime() - travelStart.getTime()) / (1000 * 60 * 60 * 24)));

      for (const supply of supplies) {
        const daysRemaining = this.getDaysRemaining(supply);
        if (daysRemaining >= 999) continue;

        let dailyRate: number;
        if (supply.type === "cgm") {
          dailyRate = 1 / (settings.cgmDays || 14);
        } else if (supply.type === "infusion_set") {
          dailyRate = 1 / (settings.siteChangeDays || 3);
        } else if (supply.type === "reservoir") {
          dailyRate = 1 / (settings.reservoirChangeDays || 3);
        } else {
          dailyRate = supply.dailyUsage;
        }
        if (dailyRate <= 0) continue;

        const travelBuffer = 2;
        const totalNeeded = Math.ceil(dailyRate * tripDuration * travelBuffer);
        const currentStock = Math.floor(this.getAdjustedQuantity(supply));
        const shortfall = totalNeeded - currentStock;

        if (shortfall > 0) {
          const inSkipList = skipSuggestions.findIndex(s => s.supply.id === supply.id);
          if (inSkipList !== -1) {
            skipSuggestions.splice(inSkipList, 1);
          }
          travelExtras.push({
            supply,
            extraNeeded: shortfall,
            reason: `Your ${scenarioState.travelDestination || "trip"} (${tripDuration} days) needs extra ${supply.name} — order ${shortfall} more with your prescription`,
          });
        }
      }
    }

    collectSoon.sort((a, b) => a.daysUntilCollect - b.daysUntilCollect);
    skipSuggestions.sort((a, b) => b.daysRemaining - a.daysRemaining);

    return { collectSoon, skipSuggestions, travelExtras, orderedSupplies };
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
   * Get the effective daily usage rate for a supply, pulling from Settings when available.
   * For insulin: uses supply.dailyUsage (which should be set from settings shortActing/longActing/TDD)
   * For needles: uses settings.injectionsPerDay if available, falls back to supply.dailyUsage
   * For CGM/infusion/reservoir: handled separately via settings intervals
   * For other: uses supply.dailyUsage
   */
  getPrimingWastePerDay(supplyType?: Supply["type"], settings?: UserSettings): number {
    const s = settings || this.getSettings();
    const profile = this.getProfile();
    const isPump = profile?.insulinDeliveryMethod === "pump";
    if (isPump) return 0;
    const unitsPerPrime = s.primingUnitsPerInjection || 0;
    if (unitsPerPrime <= 0) return 0;

    const shortInj = s.shortActingInjectionsPerDay || 0;
    const longInj = s.longActingInjectionsPerDay || 0;
    const totalFromSplit = shortInj + longInj;
    const totalInjections = totalFromSplit > 0 ? totalFromSplit : (s.injectionsPerDay || 0);

    if (totalInjections <= 0) return 0;

    if (totalFromSplit > 0) {
      if (supplyType === "insulin_short") return unitsPerPrime * shortInj;
      if (supplyType === "insulin_long") return unitsPerPrime * longInj;
      if (supplyType === "insulin" || supplyType === "insulin_vial") return unitsPerPrime * totalInjections;
    }

    return unitsPerPrime * totalInjections;
  },

  getEffectiveDailyUsage(supply: Supply, settings?: UserSettings): number {
    if (supply.dailyUsage === 0) {
      return 0;
    }

    const s = settings || this.getSettings();

    if (supply.type === "needle") {
      if (s.injectionsPerDay && s.injectionsPerDay > 0) {
        return s.injectionsPerDay;
      }
      return supply.dailyUsage || 0;
    }

    const primingWaste = this.getPrimingWastePerDay(supply.type, s);

    if (supply.type === "insulin_vial") {
      let base = 0;
      if (s.tdd && s.tdd > 0) {
        base = s.tdd;
      } else {
        const shortActing = s.shortActingUnitsPerDay || 0;
        const longActing = s.longActingUnitsPerDay || 0;
        if (shortActing + longActing > 0) {
          base = shortActing + longActing;
        } else if (supply.dailyUsage && supply.dailyUsage > 0) {
          base = supply.dailyUsage;
        }
      }
      return base > 0 ? base + primingWaste : 0;
    }

    if (supply.type === "insulin_short") {
      let base = 0;
      const shortActing = s.shortActingUnitsPerDay || 0;
      if (shortActing > 0) {
        base = shortActing;
      } else if (supply.dailyUsage && supply.dailyUsage > 0) {
        base = supply.dailyUsage;
      }
      return base > 0 ? base + primingWaste : 0;
    }

    if (supply.type === "insulin_long") {
      let base = 0;
      const longActing = s.longActingUnitsPerDay || 0;
      if (longActing > 0) {
        base = longActing;
      } else if (supply.dailyUsage && supply.dailyUsage > 0) {
        base = supply.dailyUsage;
      }
      return base > 0 ? base + primingWaste : 0;
    }

    if (supply.type === "insulin") {
      let base = 0;
      const shortActing = s.shortActingUnitsPerDay || 0;
      const longActing = s.longActingUnitsPerDay || 0;
      if (shortActing + longActing > 0) {
        base = shortActing + longActing;
      } else if (s.tdd && s.tdd > 0) {
        base = s.tdd;
      } else if (supply.dailyUsage && supply.dailyUsage > 0) {
        base = supply.dailyUsage;
      }
      return base > 0 ? base + primingWaste : 0;
    }

    return supply.dailyUsage || 0;
  },

  syncSupplyUsageToSettings(supplyType: Supply["type"], newDailyUsage: number): void {
    const settings = this.getSettings();
    const profile = this.getProfile();
    const isPump = profile?.insulinDeliveryMethod === "pump";
    let changed = false;

    if (supplyType === "needle" && !isPump) {
      if (newDailyUsage > 0 && settings.injectionsPerDay !== newDailyUsage) {
        settings.injectionsPerDay = newDailyUsage;
        changed = true;
      }
    } else if (supplyType === "insulin_short") {
      if (newDailyUsage > 0 && settings.shortActingUnitsPerDay !== newDailyUsage) {
        settings.shortActingUnitsPerDay = newDailyUsage;
        changed = true;
      }
    } else if (supplyType === "insulin_long" && !isPump) {
      if (newDailyUsage > 0 && settings.longActingUnitsPerDay !== newDailyUsage) {
        settings.longActingUnitsPerDay = newDailyUsage;
        changed = true;
      }
    } else if (supplyType === "insulin_vial" || supplyType === "insulin") {
      if (newDailyUsage > 0 && settings.tdd !== newDailyUsage) {
        settings.tdd = newDailyUsage;
        changed = true;
      }
    }

    if (changed) {
      this.saveSettings(settings);
    }
  },

  syncSettingsToSupplyUsage(settingKey: string, newValue: number): void {
    const supplies = this.getSupplies();
    let changed = false;

    const typeMap: Record<string, Supply["type"][]> = {
      injectionsPerDay: ["needle"],
      shortActingUnitsPerDay: ["insulin_short"],
      longActingUnitsPerDay: ["insulin_long"],
      tdd: ["insulin", "insulin_vial"],
    };

    const targetTypes = typeMap[settingKey];
    if (!targetTypes || newValue <= 0) return;

    for (const supply of supplies) {
      if (targetTypes.includes(supply.type) && supply.dailyUsage !== newValue) {
        supply.dailyUsage = newValue;
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    }
  },

  /**
   * Get a suggested daily usage value for a supply type based on Settings.
   * Used to pre-populate the SupplyDialog when adding new supplies.
   */
  getSuggestedDailyUsage(type: Supply["type"]): { value: number; source: string } | null {
    const s = this.getSettings();
    const profile = this.getProfile();
    const isPump = profile?.insulinDeliveryMethod === "pump";

    if (type === "needle") {
      if (s.injectionsPerDay && s.injectionsPerDay > 0) {
        return { value: s.injectionsPerDay, source: "from your Settings (injections/day)" };
      }
      return null;
    }

    if (type === "insulin_vial") {
      if (s.tdd && s.tdd > 0) {
        return { value: s.tdd, source: "from your Settings (TDD)" };
      }
      const shortActing = s.shortActingUnitsPerDay || 0;
      const longActing = s.longActingUnitsPerDay || 0;
      if (shortActing + longActing > 0) {
        return { value: shortActing + longActing, source: "from your Settings (total daily insulin)" };
      }
      return null;
    }

    if (type === "insulin_short") {
      if (isPump) {
        if (s.tdd && s.tdd > 0) {
          return { value: s.tdd, source: "from your Settings (TDD)" };
        }
        return null;
      }
      const shortActing = s.shortActingUnitsPerDay || 0;
      if (shortActing > 0) {
        return { value: shortActing, source: "from your Settings (short-acting units/day)" };
      }
      return null;
    }

    if (type === "insulin_long") {
      const longActing = s.longActingUnitsPerDay || 0;
      if (longActing > 0) {
        return { value: longActing, source: "from your Settings (long-acting units/day)" };
      }
      return null;
    }

    if (type === "insulin") {
      if (isPump) {
        if (s.tdd && s.tdd > 0) {
          return { value: s.tdd, source: "from your Settings (TDD)" };
        }
        return null;
      }
      const shortActing = s.shortActingUnitsPerDay || 0;
      const longActing = s.longActingUnitsPerDay || 0;
      if (shortActing + longActing > 0) {
        return { value: shortActing + longActing, source: "from your Settings (short + long acting units/day)" };
      }
      if (s.tdd && s.tdd > 0) {
        return { value: s.tdd, source: "from your Settings (TDD)" };
      }
      return null;
    }

    return null;
  },

  /**
   * Calculate the adjusted remaining quantity based on days elapsed since pickup.
   * If pickup date and quantity are set, automatically deducts daily usage for each day passed.
   * Uses Settings data for insulin and needle daily usage rates.
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

    const settings = this.getSettings();
    
    if (supply.type === "cgm" || supply.type === "infusion_set" || supply.type === "reservoir") {
      const itemDuration = supply.type === "cgm" 
        ? (settings.cgmDays || 14)
        : supply.type === "infusion_set" 
          ? (settings.siteChangeDays || 3) 
          : (settings.reservoirChangeDays || 3);
      
      if (supply.activeItemStartDate) {
        const activeStart = new Date(supply.activeItemStartDate);
        activeStart.setHours(0, 0, 0, 0);
        const daysSinceActive = Math.max(0, Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)));
        const activeItemFinished = daysSinceActive >= itemDuration;
        
        if (activeItemFinished) {
          const daysAfterActiveExpired = daysSinceActive - itemDuration;
          const totalStockItemsUsedOrInUse = 1 + Math.floor(daysAfterActiveExpired / itemDuration);
          if (totalStockItemsUsedOrInUse > supply.quantityAtPickup) {
            return 0;
          }
          const daysIntoCurrentItem = daysAfterActiveExpired % itemDuration;
          if (daysIntoCurrentItem === 0 && totalStockItemsUsedOrInUse === supply.quantityAtPickup) {
            return 0;
          }
          const unusedStock = supply.quantityAtPickup - totalStockItemsUsedOrInUse;
          return Math.max(0, unusedStock);
        } else {
          return supply.quantityAtPickup;
        }
      }
      
      const itemsUsed = Math.floor(daysElapsed / itemDuration);
      const adjusted = supply.quantityAtPickup - itemsUsed;
      return Math.max(0, adjusted);
    }
    
    const effectiveDailyUsage = this.getEffectiveDailyUsage(supply, settings);
    if (effectiveDailyUsage <= 0) {
      return supply.quantityAtPickup;
    }
    
    const usedAmount = daysElapsed * effectiveDailyUsage;
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
   * Calculate days remaining based on adjusted quantity and effective daily usage.
   * Uses Settings data for insulin/needle depletion rates.
   * For CGM/infusion/reservoir, uses settings intervals.
   */
  getDaysRemaining(supply: Supply): number {
    const adjustedQty = this.getAdjustedQuantity(supply);
    const settings = this.getSettings();
    
    if (supply.type === "cgm" || supply.type === "infusion_set" || supply.type === "reservoir") {
      const itemDuration = supply.type === "cgm" 
        ? (settings.cgmDays || 14)
        : supply.type === "infusion_set" 
          ? (settings.siteChangeDays || 3) 
          : (settings.reservoirChangeDays || 3);
      
      const stockDays = Math.floor(adjustedQty * itemDuration);
      
      if (supply.activeItemStartDate) {
        const activeStart = new Date(supply.activeItemStartDate);
        const today = new Date();
        activeStart.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const daysSinceActive = Math.max(0, Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)));
        
        if (daysSinceActive < itemDuration) {
          const activeRemainingDays = itemDuration - daysSinceActive;
          return activeRemainingDays + stockDays;
        } else {
          if (adjustedQty <= 0) {
            const daysAfterActiveExpired = daysSinceActive - itemDuration;
            const totalStockItemsNeeded = 1 + Math.floor(daysAfterActiveExpired / itemDuration);
            if (totalStockItemsNeeded > (supply.quantityAtPickup || 0)) {
              return 0;
            }
            const daysIntoCurrentStockItem = daysAfterActiveExpired % itemDuration;
            return itemDuration - daysIntoCurrentStockItem;
          }
          const daysAfterActiveExpired = daysSinceActive - itemDuration;
          const daysIntoCurrentStockItem = daysAfterActiveExpired % itemDuration;
          const currentItemRemainingDays = itemDuration - daysIntoCurrentStockItem;
          return currentItemRemainingDays + stockDays;
        }
      }
      
      return stockDays;
    }
    
    const effectiveDailyUsage = this.getEffectiveDailyUsage(supply, settings);
    if (effectiveDailyUsage <= 0) return 999;
    return Math.floor(adjustedQty / effectiveDailyUsage);
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
    const adjustedQty = this.getAdjustedQuantity(supply);

    // Emergency/manual-use items (e.g. Glycogen) can be tracked as "stock on hand"
    // without forecast depletion. When daily usage is 0, don't flag low unless empty.
    const usage = this.getEffectiveDailyUsage(supply);
    if (usage <= 0 && supply.type !== "cgm" && supply.type !== "infusion_set" && supply.type !== "reservoir") {
      if (adjustedQty <= 0) return "critical";
      return "ok";
    }

    // Explicitly treat Glycogen as manual/emergency stock: 1 is enough; only flag when empty.
    if (/glycogen/i.test(supply.name || "")) {
      if (adjustedQty <= 0) return "critical";
      return "ok";
    }

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
    
    const checks = [
      !!settings.tdd,
      !!(settings.breakfastRatio || settings.lunchRatio),
      !!settings.correctionFactor,
      !!(settings.targetBgLow && settings.targetBgHigh),
    ];
    
    return checks.every(c => c);
  },

  /**
   * Get settings completion percentage and details.
   */
  getSettingsCompletion(): { percentage: number; completed: number; total: number } {
    const settings = this.getSettings();
    
    const checks = [
      !!settings.tdd,
      !!(settings.breakfastRatio || settings.lunchRatio),
      !!settings.correctionFactor,
      !!(settings.targetBgLow && settings.targetBgHigh),
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
    let savedWidgets: DashboardWidget[] = JSON.parse(data);
    const validTypes = new Set(Object.keys(DEFAULT_WIDGET_SIZES));
    const beforeCount = savedWidgets.length;
    savedWidgets = savedWidgets.filter(w => validTypes.has(w.type));
    let updated = savedWidgets.length !== beforeCount;
    const savedIds = new Set(savedWidgets.map(w => w.id));
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
    if (state.travelModeActive && state.travelStartDate) {
      this.addScenarioHistory({
        id: crypto.randomUUID(),
        type: "travel",
        startDate: state.travelStartDate,
        endDate: new Date().toISOString(),
        destination: state.travelDestination,
        notes: "",
      });
    }
    state.travelModeActive = false;
    state.travelDestination = undefined;
    state.travelStartDate = undefined;
    state.travelEndDate = undefined;
    state.travelTimezoneShift = undefined;
    state.travelTimezoneDirection = undefined;
    this.saveScenarioState(state);
    localStorage.removeItem(STORAGE_KEYS.TRAVEL_PLAN);
    localStorage.removeItem(STORAGE_KEYS.TRAVEL_PACKING_LIST);
  },

  saveTravelPlan(plan: any): void {
    localStorage.setItem(STORAGE_KEYS.TRAVEL_PLAN, JSON.stringify(plan));
  },

  getTravelPlan(): any | null {
    const data = localStorage.getItem(STORAGE_KEYS.TRAVEL_PLAN);
    return data ? JSON.parse(data) : null;
  },

  saveTravelPackingList(list: any[]): void {
    localStorage.setItem(STORAGE_KEYS.TRAVEL_PACKING_LIST, JSON.stringify(list));
  },

  getTravelPackingList(): any[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRAVEL_PACKING_LIST);
    return data ? JSON.parse(data) : [];
  },

  activateSickDay(severity: string): void {
    const state = this.getScenarioState();
    state.sickDayActive = true;
    state.sickDaySeverity = severity;
    state.sickDayActivatedAt = state.sickDayActivatedAt || new Date().toISOString();
    this.saveScenarioState(state);
  },

  deactivateSickDay(): void {
    const state = this.getScenarioState();
    if (state.sickDayActive && state.sickDayActivatedAt) {
      const journal = this.getSickDayJournal();
      this.addScenarioHistory({
        id: crypto.randomUUID(),
        type: "sick_day",
        startDate: state.sickDayActivatedAt,
        endDate: new Date().toISOString(),
        severity: state.sickDaySeverity,
        notes: "",
        journalEntryCount: journal.length,
      });
      localStorage.removeItem(STORAGE_KEYS.SICK_DAY_JOURNAL);
    }
    state.sickDayActive = false;
    state.sickDaySeverity = undefined;
    state.sickDayActivatedAt = undefined;
    this.saveScenarioState(state);
  },

  getBedtimeLogs(): BedtimeLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.BEDTIME_LOGS);
    return data ? JSON.parse(data) : [];
  },

  saveBedtimeLog(log: BedtimeLog): void {
    const logs = this.getBedtimeLogs();
    logs.unshift(log);
    const trimmed = logs.slice(0, 90);
    localStorage.setItem(STORAGE_KEYS.BEDTIME_LOGS, JSON.stringify(trimmed));
  },

  getSickDayJournal(): SickDayJournalEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.SICK_DAY_JOURNAL);
    return data ? JSON.parse(data) : [];
  },

  addSickDayJournalEntry(entry: SickDayJournalEntry): void {
    const journal = this.getSickDayJournal();
    journal.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.SICK_DAY_JOURNAL, JSON.stringify(journal));
  },

  deleteSickDayJournalEntry(id: string): void {
    const journal = this.getSickDayJournal().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.SICK_DAY_JOURNAL, JSON.stringify(journal));
  },

  getScenarioHistory(): ScenarioHistoryEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.SCENARIO_HISTORY);
    return data ? JSON.parse(data) : [];
  },

  addScenarioHistory(entry: ScenarioHistoryEntry): void {
    const history = this.getScenarioHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.SCENARIO_HISTORY, JSON.stringify(trimmed));
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
    const defaults: NotificationSettings = {
      enabled: true,
      pushNotifications: true,
      supplyAlerts: true,
      criticalThresholdDays: 3,
      lowThresholdDays: 7,
      browserNotifications: false,
      appointmentReminders: true,
      hypoAlerts: true,
      scenarioAlerts: true,
      hypoDashboardQuickNotify: false,
      communityFeedAlerts: true,
    };
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
    if (!data) return defaults;
    const parsed = JSON.parse(data) as Partial<NotificationSettings>;
    return {
      ...defaults,
      ...parsed,
      hypoDashboardQuickNotify: parsed.hypoDashboardQuickNotify === true,
      communityFeedAlerts: parsed.communityFeedAlerts !== false,
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

  // Appointments (per signed-in user — see getAppointmentsStorageKey)
  getAppointments(): Appointment[] {
    const key = getAppointmentsStorageKey();
    if (!key) return [];
    const data = localStorage.getItem(key);
    if (!data) return [];
    const appointments: Appointment[] = JSON.parse(data);
    return appointments
      .filter((a) => !a.deletedAt)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  /** Prefer this from UI when you have `user.id` from auth — avoids stale `diabeater_active_user_id`. */
  getAppointmentsForUser(userId: string): Appointment[] {
    if (!userId) return [];
    const key = getAppointmentsStorageKeyForUserId(userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    const appointments: Appointment[] = JSON.parse(data);
    return appointments
      .filter((a) => !a.deletedAt)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  addAppointment(appointment: Omit<Appointment, "id" | "createdAt">): Appointment {
    const key = getAppointmentsStorageKey();
    if (!key) {
      throw new Error("Cannot save appointments: session not ready.");
    }
    const appointments = this.getAppointments();
    const now = new Date().toISOString();
    const newAppointment: Appointment = {
      ...appointment,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    appointments.push(newAppointment);
    localStorage.setItem(key, JSON.stringify(appointments));
    notifyAppointmentsLocalChanged();
    return newAppointment;
  },

  updateAppointment(id: string, updates: Partial<Appointment>): Appointment | null {
    const key = getAppointmentsStorageKey();
    if (!key) {
      throw new Error("Cannot save appointments: session not ready.");
    }
    const appointments = this.getAppointments();
    const index = appointments.findIndex(a => a.id === id);
    if (index === -1) return null;
    appointments[index] = { ...appointments[index], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(appointments));
    notifyAppointmentsLocalChanged();
    return appointments[index];
  },

  deleteAppointment(id: string): boolean {
    const key = getAppointmentsStorageKey();
    if (!key) {
      throw new Error("Cannot save appointments: session not ready.");
    }
    const appointments = this.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) return false;
    const now = new Date().toISOString();
    const next = [...appointments];
    next[index] = { ...next[index], deletedAt: now, updatedAt: now };
    localStorage.setItem(key, JSON.stringify(next));
    notifyAppointmentsLocalChanged();
    return true;
  },

  getUpcomingAppointments(): Appointment[] {
    const appointments = this.getAppointments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments.filter(a => !a.isCompleted && new Date(a.date) >= today);
  },

  getUpcomingAppointmentsForUser(userId: string): Appointment[] {
    const appointments = this.getAppointmentsForUser(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments.filter((a) => !a.isCompleted && new Date(a.date) >= today);
  },

  /**
   * Merge cloud rows into local storage (local-first, last-write-wins by updatedAt).
   * Pass `userId` from the authenticated session in sync code so the target key always matches JWT (not a stale `ACTIVE_USER_ID_KEY`).
   */
  mergeAppointments(incoming: Appointment[], userId?: string): Appointment[] {
    const key = userId ? getAppointmentsStorageKeyForUserId(userId) : getAppointmentsStorageKey();
    if (!key) {
      return incoming
        .filter((a) => !a.deletedAt)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    const localRaw = localStorage.getItem(key);
    const local: Appointment[] = localRaw ? JSON.parse(localRaw) : [];

    const byId = new Map<string, Appointment>();
    for (const a of local) byId.set(a.id, a);
    for (const a of incoming) {
      const prev = byId.get(a.id);
      if (!prev) {
        byId.set(a.id, a);
        continue;
      }
      const prevT = prev.updatedAt ? new Date(prev.updatedAt).getTime() : new Date(prev.createdAt).getTime();
      const nextT = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
      byId.set(a.id, nextT >= prevT ? { ...prev, ...a } : prev);
    }

    const merged = Array.from(byId.values());
    localStorage.setItem(key, JSON.stringify(merged));
    notifyAppointmentsLocalChanged();
    return merged.filter((a) => !a.deletedAt).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

  getExerciseRoutines(): ExerciseRoutine[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXERCISE_ROUTINES);
    if (!data) return [];
    const parsed: ExerciseRoutine[] = JSON.parse(data);
    let dirty = false;
    const migrated = parsed.map((r) => {
      const m = migrateExerciseType(r.exerciseType as string);
      if (m !== r.exerciseType) {
        dirty = true;
        return { ...r, exerciseType: m };
      }
      return r;
    });
    if (dirty) {
      localStorage.setItem(STORAGE_KEYS.EXERCISE_ROUTINES, JSON.stringify(migrated));
    }
    return migrated;
  },

  getExerciseRoutine(id: string): ExerciseRoutine | null {
    return this.getExerciseRoutines().find(r => r.id === id) || null;
  },

  addExerciseRoutine(routine: Omit<ExerciseRoutine, "id" | "timesUsed" | "createdAt" | "updatedAt">): ExerciseRoutine {
    const routines = this.getExerciseRoutines();
    const newRoutine: ExerciseRoutine = {
      ...routine,
      id: generateId(),
      timesUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    routines.push(newRoutine);
    localStorage.setItem(STORAGE_KEYS.EXERCISE_ROUTINES, JSON.stringify(routines));
    return newRoutine;
  },

  updateExerciseRoutine(id: string, updates: Partial<Omit<ExerciseRoutine, "id" | "createdAt">>): ExerciseRoutine | null {
    const routines = this.getExerciseRoutines();
    const index = routines.findIndex(r => r.id === id);
    if (index === -1) return null;
    routines[index] = { ...routines[index], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.EXERCISE_ROUTINES, JSON.stringify(routines));
    return routines[index];
  },

  deleteExerciseRoutine(id: string): boolean {
    const routines = this.getExerciseRoutines();
    const filtered = routines.filter(r => r.id !== id);
    if (filtered.length === routines.length) return false;
    localStorage.setItem(STORAGE_KEYS.EXERCISE_ROUTINES, JSON.stringify(filtered));
    return true;
  },

  useExerciseRoutine(id: string): ExerciseRoutine | null {
    const routines = this.getExerciseRoutines();
    const index = routines.findIndex(r => r.id === id);
    if (index === -1) return null;
    routines[index] = {
      ...routines[index],
      timesUsed: routines[index].timesUsed + 1,
      lastUsed: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.EXERCISE_ROUTINES, JSON.stringify(routines));
    return routines[index];
  },

  getRecentExercises(limit: number = 5): ExerciseRoutine[] {
    const routines = this.getExerciseRoutines();
    return [...routines]
      .sort((a, b) => {
        if (a.lastUsed && b.lastUsed) return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        return b.timesUsed - a.timesUsed || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);
  },


  getActiveExercise(): ActiveExerciseSession | null {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXERCISE);
    if (!data) return null;
    const session: ActiveExerciseSession = JSON.parse(data);
    const m = migrateExerciseType(session.exerciseType as string);
    if (m !== session.exerciseType) {
      const updated = { ...session, exerciseType: m };
      localStorage.setItem(STORAGE_KEYS.ACTIVE_EXERCISE, JSON.stringify(updated));
      return updated;
    }
    return session;
  },

  startExerciseSession(params: {
    routineId?: string;
    exerciseName: string;
    exerciseType: ExerciseType;
    intensity: ExerciseIntensity;
    durationMinutes: number;
    recoveryMinutes?: number;
  }): ActiveExerciseSession {
    const session: ActiveExerciseSession = {
      id: generateId(),
      routineId: params.routineId,
      exerciseName: params.exerciseName,
      exerciseType: params.exerciseType,
      intensity: params.intensity,
      durationMinutes: params.durationMinutes,
      phase: "pre",
      startedAt: new Date().toISOString(),
      recoveryMinutes: params.recoveryMinutes ?? this.getDefaultRecoveryMinutes(params.exerciseType, params.intensity),
      midCheckDone: false,
      preChecklist: {
        bgChecked: false,
        carbsConsidered: false,
        basalAdjusted: false,
      },
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_EXERCISE, JSON.stringify(session));
    return session;
  },

  getDefaultRecoveryMinutes(exerciseType: ExerciseType, intensity: ExerciseIntensity): number {
    const typeDefaults: Record<ExerciseType, (i: ExerciseIntensity) => number> = {
      cardio: (i) => i === "intense" ? 120 : i === "moderate" ? 90 : 60,
      strength: (i) => i === "intense" ? 120 : i === "moderate" ? 90 : 60,
      hiit: (i) => i === "intense" ? 150 : i === "moderate" ? 120 : 90,
      yoga: () => 30,
      walking: () => 30,
      swimming: (i) => i === "intense" ? 120 : i === "moderate" ? 90 : 60,
      court: (i) => i === "intense" ? 120 : i === "moderate" ? 90 : 60,
      field: (i) => i === "intense" ? 120 : i === "moderate" ? 90 : 60,
    };
    return typeDefaults[exerciseType](intensity);
  },

  updateActiveExercise(updates: Partial<ActiveExerciseSession>): ActiveExerciseSession | null {
    const session = this.getActiveExercise();
    if (!session) return null;
    const updated = { ...session, ...updates };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_EXERCISE, JSON.stringify(updated));
    return updated;
  },

  startExercisePhase(): ActiveExerciseSession | null {
    return this.updateActiveExercise({
      phase: "active",
      exerciseStartedAt: new Date().toISOString(),
    });
  },

  finishExercisePhase(): ActiveExerciseSession | null {
    const session = this.getActiveExercise();
    if (!session) return null;
    const now = new Date();
    const recoveryEnds = new Date(now.getTime() + session.recoveryMinutes * 60 * 1000);
    return this.updateActiveExercise({
      phase: "recovery",
      exerciseEndedAt: now.toISOString(),
      recoveryEndsAt: recoveryEnds.toISOString(),
    });
  },

  endExerciseSession(): ActiveExerciseSession | null {
    const session = this.getActiveExercise();
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_EXERCISE);
    return session;
  },

  getExerciseOutcomes(): ExerciseOutcome[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXERCISE_OUTCOMES);
    if (!data) return [];
    const parsed: ExerciseOutcome[] = JSON.parse(data);
    let dirty = false;
    const migrated = parsed.map((o) => {
      const m = migrateExerciseType(o.exerciseType as string);
      if (m !== o.exerciseType) {
        dirty = true;
        return { ...o, exerciseType: m };
      }
      return o;
    });
    if (dirty) {
      localStorage.setItem(STORAGE_KEYS.EXERCISE_OUTCOMES, JSON.stringify(migrated));
    }
    return migrated;
  },

  addExerciseOutcome(outcome: Omit<ExerciseOutcome, "id" | "completedAt">): ExerciseOutcome {
    const outcomes = this.getExerciseOutcomes();
    const newOutcome: ExerciseOutcome = {
      ...outcome,
      id: generateId(),
      completedAt: new Date().toISOString(),
    };
    outcomes.unshift(newOutcome);
    if (outcomes.length > 100) outcomes.pop();
    localStorage.setItem(STORAGE_KEYS.EXERCISE_OUTCOMES, JSON.stringify(outcomes));
    return newOutcome;
  },

  getExercisePatterns(exerciseType: ExerciseType, intensity?: ExerciseIntensity): {
    totalSessions: number;
    droppedCount: number;
    stableCount: number;
    roseCount: number;
    hypoCount: number;
    avgPattern: string;
  } {
    const outcomes = this.getExerciseOutcomes().filter(o => {
      if (o.exerciseType !== exerciseType) return false;
      if (intensity && o.intensity !== intensity) return false;
      return !!o.bgResponse;
    });
    const total = outcomes.length;
    if (total === 0) return { totalSessions: 0, droppedCount: 0, stableCount: 0, roseCount: 0, hypoCount: 0, avgPattern: "" };
    const dropped = outcomes.filter(o => o.bgResponse === "dropped").length;
    const stable = outcomes.filter(o => o.bgResponse === "stable").length;
    const rose = outcomes.filter(o => o.bgResponse === "rose").length;
    const hypo = outcomes.filter(o => o.feltHypo).length;

    let avgPattern = "";
    if (dropped > stable && dropped > rose) {
      avgPattern = `BG typically drops after ${exerciseType}`;
    } else if (stable >= dropped && stable >= rose) {
      avgPattern = `BG usually stays stable during ${exerciseType}`;
    } else {
      avgPattern = `BG tends to rise during ${exerciseType}`;
    }

    return { totalSessions: total, droppedCount: dropped, stableCount: stable, roseCount: rose, hypoCount: hypo, avgPattern };
  },

  exportAllData(): string {
    const data: Record<string, unknown> = {};
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      if (key === "APPOINTMENTS") {
        const apptKey = getAppointmentsStorageKey();
        if (!apptKey) continue;
        const value = localStorage.getItem(apptKey);
        if (value) {
          try {
            data[key] = JSON.parse(value);
          } catch {
            data[key] = value;
          }
        }
        continue;
      }
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
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_DATE, new Date().toISOString());
    localStorage.removeItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED);
    localStorage.removeItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED + "_at");
    return JSON.stringify(data, null, 2);
  },

  getCarerLinks(): CarerLink[] {
    const data = localStorage.getItem(STORAGE_KEYS.CARER_LINKS);
    return data ? JSON.parse(data) : [];
  },

  saveCarerLinks(links: CarerLink[]) {
    localStorage.setItem(STORAGE_KEYS.CARER_LINKS, JSON.stringify(links));
  },

  addCarerLink(link: Omit<CarerLink, "id" | "linkedAt">) {
    const links = this.getCarerLinks();
    links.push({ ...link, id: crypto.randomUUID(), linkedAt: new Date().toISOString() });
    this.saveCarerLinks(links);
  },

  removeCarerLink(id: string) {
    this.saveCarerLinks(this.getCarerLinks().filter(l => l.id !== id));
  },

  updateCarerPermission(id: string, permission: CarerPermission) {
    const links = this.getCarerLinks();
    const link = links.find(l => l.id === id);
    if (link) { link.permission = permission; this.saveCarerLinks(links); }
  },

  getCarerPrivacy(): CarerPrivacySettings {
    const data = localStorage.getItem(STORAGE_KEYS.CARER_PRIVACY);
    return data ? JSON.parse(data) : {
      shareSupplies: true,
      shareAppointments: true,
      shareScenarios: true,
      shareHypoAlerts: true,
      shareActivityAdviser: false,
    };
  },

  saveCarerPrivacy(settings: CarerPrivacySettings) {
    localStorage.setItem(STORAGE_KEYS.CARER_PRIVACY, JSON.stringify(settings));
  },

  getCarerActivityLog(): CarerActivityLogEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.CARER_ACTIVITY_LOG);
    return data ? JSON.parse(data) : [];
  },

  addCarerActivity(entry: Omit<CarerActivityLogEntry, "id" | "timestamp">) {
    const log = this.getCarerActivityLog();
    log.unshift({ ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
    if (log.length > 50) log.splice(50);
    localStorage.setItem(STORAGE_KEYS.CARER_ACTIVITY_LOG, JSON.stringify(log));
  },

  getHypoTreatments(): HypoTreatment[] {
    const data = localStorage.getItem(STORAGE_KEYS.HYPO_TREATMENTS);
    return data ? JSON.parse(data) : [];
  },

  addHypoTreatment(treatment: Omit<HypoTreatment, "id">): HypoTreatment {
    const treatments = this.getHypoTreatments();
    const created: HypoTreatment = { ...treatment, id: crypto.randomUUID() };
    treatments.unshift(created);
    if (treatments.length > 100) treatments.splice(100);
    localStorage.setItem(STORAGE_KEYS.HYPO_TREATMENTS, JSON.stringify(treatments));
    if (treatment.carerNotified) {
      this.addCarerActivity({
        carerName: "System",
        action: "Hypo Alert",
        detail: "Hypo treatment logged and carers notified",
      });
    }
    return created;
  },

  patchHypoTreatment(id: string, updates: Partial<HypoTreatment>): HypoTreatment | null {
    const treatments = this.getHypoTreatments();
    const idx = treatments.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    treatments[idx] = { ...treatments[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.HYPO_TREATMENTS, JSON.stringify(treatments));
    return treatments[idx];
  },

  updateHypoTreatmentCarerNotified(id: string, carerNotified: boolean): HypoTreatment | null {
    return this.patchHypoTreatment(id, { carerNotified });
  },

  /**
   * Supply cloud reconciliation: import a cloud row as a new local supply.
   * Used by `app/src/lib/supplies.ts`.
   */
  importSupplyFromCloudReconcile(row: {
    id: string;
    name: string;
    quantity: number;
    updated_at: string;
    unit?: string | null;
    category?: string | null;
    notes?: string | null;
  }): Supply {
    const supplies = this.getSupplies();
    const type = (row.category as Supply["type"]) || "other";
    const newSupply: Supply = {
      id: generateId(),
      name: row.name,
      type,
      currentQuantity: Math.max(0, Math.round(Number(row.quantity))),
      dailyUsage: 0,
      quantityAtPickup: Math.max(0, Math.round(Number(row.quantity))),
      lastPickupDate: new Date().toISOString(),
      notes: row.notes ?? undefined,
      cloud_id: row.id,
      updated_at: row.updated_at,
    };
    supplies.push(newSupply);
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    return newSupply;
  },

  getCarerMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.CARER_MODE) === "true";
  },

  setCarerMode(enabled: boolean) {
    localStorage.setItem(STORAGE_KEYS.CARER_MODE, enabled ? "true" : "false");
  },

  getInviteCode(): string {
    let code = localStorage.getItem(STORAGE_KEYS.CARER_INVITE_CODE);
    if (!code) {
      code = `DB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      localStorage.setItem(STORAGE_KEYS.CARER_INVITE_CODE, code);
    }
    return code;
  },

  regenerateInviteCode(): string {
    const code = `DB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    localStorage.setItem(STORAGE_KEYS.CARER_INVITE_CODE, code);
    return code;
  },

  shouldShowBackupReminder(): boolean {
    const settingsComplete = this.isSettingsComplete();
    const hasSupplies = this.getSupplies().length > 0;
    if (!settingsComplete || !hasSupplies) return false;
    const dismissed = localStorage.getItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED);
    if (dismissed === "permanent") return false;
    if (dismissed === "later") {
      const dismissedAt = localStorage.getItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED + "_at");
      if (dismissedAt) {
        const daysSinceDismiss = (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismiss < 7) return false;
      }
    }
    const lastBackup = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP_DATE);
    if (!lastBackup) return true;
    const daysSinceBackup = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceBackup >= 7;
  },

  dismissBackupReminder(type: "later" | "permanent"): void {
    localStorage.setItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED, type);
    if (type === "later") {
      localStorage.setItem(STORAGE_KEYS.BACKUP_REMINDER_DISMISSED + "_at", new Date().toISOString());
    }
  },

  getLastBackupDate(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_BACKUP_DATE);
  },

  getHolidayPrep(): HolidayPrep | null {
    const data = localStorage.getItem(STORAGE_KEYS.HOLIDAY_PREP);
    return data ? JSON.parse(data) : null;
  },

  saveHolidayPrep(prep: HolidayPrep): void {
    localStorage.setItem(STORAGE_KEYS.HOLIDAY_PREP, JSON.stringify(prep));
  },

  deleteHolidayPrep(): void {
    localStorage.removeItem(STORAGE_KEYS.HOLIDAY_PREP);
  },

  getHolidaySupplyCoverage(): { supply: Supply; daysRemaining: number; tripDays: number; shortfall: number; coveragePercent: number }[] {
    const prep = this.getHolidayPrep();
    if (!prep) return [];
    const supplies = this.getSupplies();
    const departureDate = new Date(prep.departureDate);
    const returnDate = new Date(prep.returnDate);
    departureDate.setHours(0, 0, 0, 0);
    returnDate.setHours(0, 0, 0, 0);
    const tripDays = Math.max(1, Math.ceil((returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)));
    const bufferDays = 2;
    const totalNeededDays = tripDays + bufferDays;

    return supplies.map(supply => {
      const daysRemaining = this.getDaysRemaining(supply);
      if (daysRemaining >= 999) return { supply, daysRemaining: 999, tripDays: totalNeededDays, shortfall: 0, coveragePercent: 100 };
      const coveragePercent = Math.min(100, Math.round((daysRemaining / totalNeededDays) * 100));
      const shortfall = Math.max(0, totalNeededDays - daysRemaining);
      return { supply, daysRemaining, tripDays: totalNeededDays, shortfall, coveragePercent };
    });
  },

  getRatioHistory(): RatioHistoryEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.RATIO_HISTORY);
    return data ? JSON.parse(data) : [];
  },

  addRatioHistoryEntry(entry: RatioHistoryEntry): void {
    const history = this.getRatioHistory();
    history.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.RATIO_HISTORY, JSON.stringify(history));
  },

  deleteRatioHistoryEntry(id: string): void {
    const history = this.getRatioHistory().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.RATIO_HISTORY, JSON.stringify(history));
  },

  snapshotCurrentRatios(note?: string): void {
    const settings = this.getSettings();
    const entry: RatioHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      breakfastRatio: settings.breakfastRatio,
      lunchRatio: settings.lunchRatio,
      dinnerRatio: settings.dinnerRatio,
      snackRatio: settings.snackRatio,
      correctionFactor: settings.correctionFactor,
      note,
    };
    this.addRatioHistoryEntry(entry);
  },

  importAllData(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") {
        return { success: false, error: "Invalid data format" };
      }

      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (data[key] === undefined) continue;
        const value = typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]);
        if (key === "APPOINTMENTS") {
          const apptKey = getAppointmentsStorageKey();
          if (!apptKey) continue;
          localStorage.setItem(apptKey, value);
          continue;
        }
        localStorage.setItem(storageKey, value);
      }
      return { success: true };
    } catch {
      return { success: false, error: "Could not read the file. Please check it's a valid Diabeaters backup." };
    }
  },
};
