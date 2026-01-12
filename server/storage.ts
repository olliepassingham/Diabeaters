import { 
  type UserProfile,
  type InsertUserProfile,
  type UserSettings,
  type InsertUserSettings,
  type Supply,
  type InsertSupply,
  type ActivityLog,
  type InsertActivityLog,
  userProfiles,
  userSettings,
  supplies,
  activityLogs
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;
  
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  
  getSupplies(userId: string): Promise<Supply[]>;
  getSupply(userId: string, type: string): Promise<Supply | undefined>;
  createSupply(supply: InsertSupply): Promise<Supply>;
  updateSupply(userId: string, id: string, supply: Partial<InsertSupply>): Promise<Supply | undefined>;
  deleteSupply(userId: string, id: string): Promise<boolean>;
  
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

export class DatabaseStorage implements IStorage {
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const result = await db.insert(userProfiles).values(profile).returning();
    return result[0];
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const result = await db.update(userProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const result = await db.insert(userSettings).values(settings).returning();
    return result[0];
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const result = await db.update(userSettings)
      .set(settings)
      .where(eq(userSettings.userId, userId))
      .returning();
    return result[0];
  }

  async getSupplies(userId: string): Promise<Supply[]> {
    return await db.select().from(supplies).where(eq(supplies.userId, userId));
  }

  async getSupply(userId: string, type: string): Promise<Supply | undefined> {
    const result = await db.select().from(supplies)
      .where(and(eq(supplies.userId, userId), eq(supplies.type, type)))
      .limit(1);
    return result[0];
  }

  async createSupply(supply: InsertSupply): Promise<Supply> {
    const result = await db.insert(supplies).values(supply).returning();
    return result[0];
  }

  async updateSupply(userId: string, id: string, supply: Partial<InsertSupply>): Promise<Supply | undefined> {
    const result = await db.update(supplies)
      .set({ ...supply, lastUpdated: new Date() })
      .where(and(eq(supplies.id, id), eq(supplies.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteSupply(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(supplies)
      .where(and(eq(supplies.id, id), eq(supplies.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getActivityLogs(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
