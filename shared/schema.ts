import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  dateOfBirth: text("date_of_birth"),
  diabetesType: text("diabetes_type"),
  insulinDeliveryMethod: text("insulin_delivery_method"),
  usingInsulin: boolean("using_insulin"),
  bgUnits: text("bg_units").default("mmol/L"),
  carbUnits: text("carb_units").default("grams"),
  hasAcceptedDisclaimer: boolean("has_accepted_disclaimer").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  tdd: real("tdd"),
  breakfastRatio: text("breakfast_ratio"),
  lunchRatio: text("lunch_ratio"),
  dinnerRatio: text("dinner_ratio"),
  snackRatio: text("snack_ratio"),
  correctionFactor: real("correction_factor"),
  targetBgLow: real("target_bg_low"),
  targetBgHigh: real("target_bg_high"),
  shortActingPensPerDay: integer("short_acting_pens_per_day"),
  longActingPensPerDay: integer("long_acting_pens_per_day"),
  injectionsPerDay: integer("injections_per_day"),
  cgmDays: integer("cgm_days"),
  hasCompletedSetup: boolean("has_completed_setup").default(false),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  widgetType: text("widget_type").notNull(),
  enabled: boolean("enabled").default(true),
  position: integer("position").notNull().default(0),
});

export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets).omit({
  id: true,
});

export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;

export const supplies = pgTable("supplies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull().default(0),
  lastPickupDate: timestamp("last_pickup_date"),
  lastUpdated: timestamp("last_updated").notNull().default(sql`now()`),
});

export const insertSupplySchema = createInsertSchema(supplies).omit({
  id: true,
  lastUpdated: true,
});

export const updateSupplySchema = insertSupplySchema.partial().omit({
  userId: true,
});

export type InsertSupply = z.infer<typeof insertSupplySchema>;
export type UpdateSupply = z.infer<typeof updateSupplySchema>;
export type Supply = typeof supplies.$inferSelect;

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  activityDetails: text("activity_details").notNull(),
  recommendation: text("recommendation").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const travelPlans = pgTable("travel_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  departureDate: timestamp("departure_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  travelDuration: integer("travel_duration"),
  packingList: jsonb("packing_list"),
  emergencyPlan: text("emergency_plan"),
  nearbyPharmacies: jsonb("nearby_pharmacies"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTravelPlanSchema = createInsertSchema(travelPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertTravelPlan = z.infer<typeof insertTravelPlanSchema>;
export type TravelPlan = typeof travelPlans.$inferSelect;

export const sickDayLogs = pgTable("sick_day_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  illnessType: text("illness_type").notNull(),
  severity: text("severity").notNull(),
  bgLevel: real("bg_level").notNull(),
  recommendation: text("recommendation").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSickDayLogSchema = createInsertSchema(sickDayLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSickDayLog = z.infer<typeof insertSickDayLogSchema>;
export type SickDayLog = typeof sickDayLogs.$inferSelect;

export const emergencyContacts = pgTable("emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relationship: text("relationship"),
  isPrimary: boolean("is_primary").default(false),
});

export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({
  id: true,
});

export type InsertEmergencyContact = z.infer<typeof insertEmergencyContactSchema>;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;

export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  inputContext: jsonb("input_context"),
  outputRecommendation: text("output_recommendation"),
  safetyChecks: jsonb("safety_checks"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAiAuditLog = z.infer<typeof insertAiAuditLogSchema>;
export type AiAuditLog = typeof aiAuditLogs.$inferSelect;

export const ratioReviews = pgTable("ratio_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mealType: text("meal_type").notNull(),
  currentRatio: text("current_ratio").notNull(),
  suggestedRatio: text("suggested_ratio"),
  reviewNotes: text("review_notes"),
  riskFlags: jsonb("risk_flags"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertRatioReviewSchema = createInsertSchema(ratioReviews).omit({
  id: true,
  createdAt: true,
});

export type InsertRatioReview = z.infer<typeof insertRatioReviewSchema>;
export type RatioReview = typeof ratioReviews.$inferSelect;

export const COMMUNITY_TOPICS = [
  "holidays-travel",
  "sick-days",
  "exercise-activity",
  "food-eating-out",
  "mental-health",
  "tips-what-worked",
  "general-questions",
] as const;

export type CommunityTopic = typeof COMMUNITY_TOPICS[number];

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"),
  topic: text("topic").notNull(),
  authorName: text("author_name"),
  isAnonymous: boolean("is_anonymous").default(true),
  isReported: boolean("is_reported").default(false),
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({
  id: true,
  replyCount: true,
  isReported: true,
  createdAt: true,
});

export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;

export const communityReplies = pgTable("community_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorName: text("author_name"),
  isAnonymous: boolean("is_anonymous").default(true),
  isReported: boolean("is_reported").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCommunityReplySchema = createInsertSchema(communityReplies).omit({
  id: true,
  isReported: true,
  createdAt: true,
});

export type InsertCommunityReply = z.infer<typeof insertCommunityReplySchema>;
export type CommunityReply = typeof communityReplies.$inferSelect;

export const REEL_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type ReelPlatform = typeof REEL_PLATFORMS[number];

export const communityReels = pgTable("community_reels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  creatorHandle: text("creator_handle").notNull(),
  platform: text("platform").notNull(),
  sourceUrl: text("source_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  description: text("description"),
  tags: text("tags").array(),
  isFeatured: boolean("is_featured").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCommunityReelSchema = createInsertSchema(communityReels).omit({
  id: true,
  createdAt: true,
});

export type InsertCommunityReel = z.infer<typeof insertCommunityReelSchema>;
export type CommunityReel = typeof communityReels.$inferSelect;
