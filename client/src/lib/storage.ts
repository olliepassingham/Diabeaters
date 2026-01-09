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
  USUAL_PRESCRIPTION: "diabeater_usual_prescription",
  PICKUP_HISTORY: "diabeater_pickup_history",
  COMMUNITY_POSTS: "diabeater_community_posts",
  COMMUNITY_REPLIES: "diabeater_community_replies",
  DIRECT_MESSAGES: "diabeater_direct_messages",
  CONVERSATIONS: "diabeater_conversations",
  FOLLOWING: "diabeater_following",
  NOTIFICATIONS: "diabeater_notifications",
  NOTIFICATION_SETTINGS: "diabeater_notification_settings",
  LAST_NOTIFICATION_CHECK: "diabeater_last_notification_check",
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
  | "help-now-info";

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

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "today-overview", type: "today-overview", enabled: true, order: 0 },
  { id: "supply-summary", type: "supply-summary", enabled: true, order: 1 },
  { id: "quick-actions", type: "quick-actions", enabled: true, order: 2 },
  { id: "ai-recommendations", type: "ai-recommendations", enabled: true, order: 3 },
  { id: "scenario-status", type: "scenario-status", enabled: true, order: 4 },
  { id: "community", type: "community", enabled: true, order: 5 },
  { id: "messages", type: "messages", enabled: true, order: 6 },
  { id: "activity-adviser", type: "activity-adviser", enabled: true, order: 7 },
  { id: "ratio-adviser", type: "ratio-adviser", enabled: true, order: 8 },
  { id: "travel-mode", type: "travel-mode", enabled: false, order: 9 },
  { id: "sick-day", type: "sick-day", enabled: false, order: 10 },
  { id: "settings-completion", type: "settings-completion", enabled: false, order: 11 },
  { id: "help-now-info", type: "help-now-info", enabled: false, order: 12 },
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

  addSupply(supply: Omit<Supply, "id">): { supply: Supply; merged: boolean } {
    const supplies = this.getSupplies();
    const existingIndex = supplies.findIndex(
      s => s.name.toLowerCase().trim() === supply.name.toLowerCase().trim()
    );
    
    if (existingIndex !== -1) {
      supplies[existingIndex].currentQuantity += supply.currentQuantity;
      if (supply.dailyUsage) {
        supplies[existingIndex].dailyUsage = supply.dailyUsage;
      }
      if (supply.notes) {
        supplies[existingIndex].notes = supply.notes;
      }
      localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
      return { supply: supplies[existingIndex], merged: true };
    }
    
    const newSupply = { ...supply, id: generateId() };
    supplies.push(newSupply);
    localStorage.setItem(STORAGE_KEYS.SUPPLIES, JSON.stringify(supplies));
    return { supply: newSupply, merged: false };
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
};
