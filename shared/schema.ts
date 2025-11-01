import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
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

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  tdd: real("tdd"),
  breakfastRatio: text("breakfast_ratio"),
  lunchRatio: text("lunch_ratio"),
  dinnerRatio: text("dinner_ratio"),
  snackRatio: text("snack_ratio"),
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
