const STORAGE_KEYS = {
  PROFILE: "diabeater_profile",
  SETTINGS: "diabeater_settings",
  SUPPLIES: "diabeater_supplies",
  ONBOARDING: "diabeater_onboarding_completed",
  EMERGENCY_CONTACTS: "diabeater_emergency_contacts",
  ACTIVITY_LOGS: "diabeater_activity_logs",
  DASHBOARD_WIDGETS: "diabeater_dashboard_widgets",
  SCENARIO_STATE: "diabeater_scenario_state",
  LAST_PRESCRIPTION: "diabeater_last_prescription",
  PICKUP_HISTORY: "diabeater_pickup_history",
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
  shortActingPensPerDay?: number;
  longActingPensPerDay?: number;
  injectionsPerDay?: number;
  cgmDays?: number;
}

export interface Supply {
  id: string;
  name: string;
  type: "needle" | "insulin" | "cgm" | "other";
  currentQuantity: number;
  dailyUsage: number;
  lastPickupDate?: string;
  typicalRefillQuantity?: number;
  notes?: string;
}

export interface LastPrescription {
  name: string;
  type: Supply["type"];
  quantity: number;
  dailyUsage: number;
  notes?: string;
  savedAt: string;
}

export interface PickupRecord {
  id: string;
  supplyId: string;
  supplyName: string;
  quantity: number;
  pickupDate: string;
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

export type WidgetType = "supply-summary" | "today-overview" | "ai-recommendations" | "quick-actions" | "scenario-status" | "settings-completion";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number;
}

export interface ScenarioState {
  travelModeActive: boolean;
  travelDestination?: string;
  travelEndDate?: string;
  sickDayActive: boolean;
  sickDaySeverity?: string;
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "settings-completion", type: "settings-completion", enabled: true, order: 0 },
  { id: "supply-summary", type: "supply-summary", enabled: true, order: 1 },
  { id: "today-overview", type: "today-overview", enabled: true, order: 2 },
  { id: "ai-recommendations", type: "ai-recommendations", enabled: true, order: 3 },
  { id: "quick-actions", type: "quick-actions", enabled: true, order: 4 },
  { id: "scenario-status", type: "scenario-status", enabled: true, order: 5 },
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
      const defaults: Supply[] = [
        { id: generateId(), name: "Insulin Pen Needles", type: "needle", currentQuantity: 50, dailyUsage: 4 },
        { id: generateId(), name: "NovoRapid FlexPen", type: "insulin", currentQuantity: 3, dailyUsage: 0.33 },
        { id: generateId(), name: "CGM Sensor", type: "cgm", currentQuantity: 2, dailyUsage: 0.1 },
      ];
      localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(data);
  },

  addSupply(supply: Omit<Supply, "id">): Supply {
    const supplies = this.getSupplies();
    const newSupply = { ...supply, id: generateId() };
    supplies.push(newSupply);
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    return newSupply;
  },

  updateSupply(id: string, updates: Partial<Supply>): Supply | null {
    const supplies = this.getSupplies();
    const index = supplies.findIndex(s => s.id === id);
    if (index === -1) return null;
    supplies[index] = { ...supplies[index], ...updates };
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
   * Calculate days remaining based on currentQuantity / dailyUsage.
   * currentQuantity is the source of truth (manually tracked by user).
   */
  getDaysRemaining(supply: Supply): number {
    if (supply.dailyUsage <= 0) return 999;
    return Math.floor(supply.currentQuantity / supply.dailyUsage);
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
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGETS, JSON.stringify(savedWidgets));
    }
    return savedWidgets;
  },

  saveDashboardWidgets(widgets: DashboardWidget[]): void {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGETS, JSON.stringify(widgets));
  },

  getScenarioState(): ScenarioState {
    const data = localStorage.getItem(STORAGE_KEYS.SCENARIO_STATE);
    return data ? JSON.parse(data) : { travelModeActive: false, sickDayActive: false };
  },

  saveScenarioState(state: ScenarioState): void {
    localStorage.setItem(STORAGE_KEYS.SCENARIO_STATE, JSON.stringify(state));
  },

  activateTravelMode(destination: string, endDate: string): void {
    const state = this.getScenarioState();
    state.travelModeActive = true;
    state.travelDestination = destination;
    state.travelEndDate = endDate;
    this.saveScenarioState(state);
  },

  deactivateTravelMode(): void {
    const state = this.getScenarioState();
    state.travelModeActive = false;
    state.travelDestination = undefined;
    state.travelEndDate = undefined;
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
};
