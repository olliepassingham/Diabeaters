import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSettingsSchema, insertSupplySchema, updateSupplySchema, insertActivityLogSchema, insertUserProfileSchema } from "@shared/schema";
import OpenAI from "openai";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Helper to get userId from authenticated request
function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // User Profile Routes
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const profile = await storage.getUserProfile(userId);
      res.json(profile || { onboardingCompleted: false });
    } catch (error) {
      res.status(500).send("Failed to fetch profile");
    }
  });

  app.post("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = insertUserProfileSchema.parse({
        ...req.body,
        userId,
      });

      const existing = await storage.getUserProfile(userId);
      let profile;
      
      if (existing) {
        profile = await storage.updateUserProfile(userId, validatedData);
      } else {
        profile = await storage.createUserProfile(validatedData);
      }

      res.json(profile);
    } catch (error) {
      console.error("Profile save error:", error);
      res.status(400).send("Invalid profile data");
    }
  });

  // User Settings Routes
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settings = await storage.getUserSettings(userId);
      res.json(settings || null);
    } catch (error) {
      res.status(500).send("Failed to fetch settings");
    }
  });

  app.post("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = insertUserSettingsSchema.parse({
        ...req.body,
        userId,
      });

      const existing = await storage.getUserSettings(userId);
      let settings;
      
      if (existing) {
        settings = await storage.updateUserSettings(userId, validatedData);
      } else {
        settings = await storage.createUserSettings(validatedData);
      }

      res.json(settings);
    } catch (error) {
      res.status(400).send("Invalid settings data");
    }
  });

  // Supply Routes
  app.get("/api/supplies", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const supplies = await storage.getSupplies(userId);
      res.json(supplies);
    } catch (error) {
      res.status(500).send("Failed to fetch supplies");
    }
  });

  app.post("/api/supplies", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = insertSupplySchema.parse({
        ...req.body,
        userId,
      });

      const supply = await storage.createSupply(validatedData);
      res.json(supply);
    } catch (error) {
      res.status(400).send("Invalid supply data");
    }
  });

  app.patch("/api/supplies/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = updateSupplySchema.parse(req.body);
      const supply = await storage.updateSupply(userId, req.params.id, validatedData);
      if (!supply) {
        return res.status(404).send("Supply not found");
      }
      res.json(supply);
    } catch (error) {
      res.status(400).send("Invalid supply data");
    }
  });

  // Sick Day Calculation Route (public - uses client-side data)
  app.post("/api/sick-day/calculate", async (req, res) => {
    try {
      const { tdd, bgLevel, severity } = req.body;
      
      if (!tdd || !bgLevel || !severity) {
        return res.status(400).send("Missing required fields");
      }

      const tddNum = parseFloat(tdd);
      const bgNum = parseFloat(bgLevel);
      
      let severityMultiplier = 1;
      if (severity === "moderate") severityMultiplier = 1.2;
      if (severity === "severe") severityMultiplier = 1.5;

      const correctionFactor = 1800 / tddNum;
      const bgAboveTarget = Math.max(0, bgNum - 100);
      const correctionDose = Math.round((bgAboveTarget / correctionFactor) * severityMultiplier * 10) / 10;

      const baseRatio = Math.round(450 / tddNum);
      const adjustedRatio = Math.max(1, Math.round(baseRatio / severityMultiplier));

      res.json({
        correctionDose,
        breakfastRatio: `1:${adjustedRatio}`,
        lunchRatio: `1:${adjustedRatio}`,
        dinnerRatio: `1:${adjustedRatio}`,
        snackRatio: `1:${Math.max(1, adjustedRatio + 2)}`,
      });
    } catch (error) {
      res.status(500).send("Calculation failed");
    }
  });

  // Activity Adviser Routes
  app.post("/api/activity/advice", async (req, res) => {
    if (!openai) {
      return res.status(503).send("OpenAI API key not configured");
    }

    try {
      const { activityType, activityDetails, userProfile, userSettings } = req.body;
      
      if (!activityType || !activityDetails) {
        return res.status(400).send("Missing required fields");
      }

      // Use profile and settings from request body (sent from client's local storage)
      const profile = userProfile || {};
      const settings = userSettings || {};

      // Build comprehensive user context for AI
      const userContext = [];
      
      if (profile) {
        userContext.push(`Diabetes Type: ${profile.diabetesType || "Type 1"}`);
        userContext.push(`Insulin Delivery: ${profile.insulinDeliveryMethod || "Not specified"}`);
        userContext.push(`Blood Glucose Units: ${profile.bgUnits || "mmol/L"}`);
        userContext.push(`Carb Units: ${profile.carbUnits || "Grams"}`);
      }
      
      if (settings) {
        if (settings.tdd) userContext.push(`Total Daily Dose (TDD): ${settings.tdd} units`);
        if (settings.breakfastRatio) userContext.push(`Breakfast Ratio: ${settings.breakfastRatio}`);
        if (settings.lunchRatio) userContext.push(`Lunch Ratio: ${settings.lunchRatio}`);
        if (settings.dinnerRatio) userContext.push(`Dinner Ratio: ${settings.dinnerRatio}`);
        if (settings.snackRatio) userContext.push(`Snack Ratio: ${settings.snackRatio}`);
        if (settings.correctionFactor) userContext.push(`Correction Factor: 1:${settings.correctionFactor} (1 unit drops BG by ${settings.correctionFactor})`);
        if (settings.targetBgLow && settings.targetBgHigh) {
          userContext.push(`Target BG Range: ${settings.targetBgLow}-${settings.targetBgHigh}`);
        }
        if (settings.shortActingUnitsPerDay) userContext.push(`Short-Acting Insulin: ~${settings.shortActingUnitsPerDay} units/day`);
        if (settings.longActingUnitsPerDay) userContext.push(`Long-Acting Insulin: ~${settings.longActingUnitsPerDay} units/day`);
      }

      const bgUnits = profile?.bgUnits || "mmol/L";
      const carbUnits = profile?.carbUnits || "Grams";
      
      const prompt = `You are a personalised diabetes management assistant for a UK user. You MUST tailor your advice to their specific settings.

**CRITICAL - UNITS REQUIREMENT:**
- Blood glucose: ALWAYS use ${bgUnits} (NEVER use ${bgUnits === "mmol/L" ? "mg/dL" : "mmol/L"})
- Carbohydrates: ALWAYS use ${carbUnits}
- This is non-negotiable. Using wrong units could be dangerous.

**User's Personal Settings:**
${userContext.length > 0 ? userContext.join("\n") : "No settings configured yet"}

**User's Question/Activity:**
- Type: ${activityType}
- Details: ${activityDetails}

**Instructions:**
1. ALWAYS express blood glucose values in ${bgUnits} - never use any other unit
2. Use their specific carb ratios, TDD, and correction factor when making calculations
3. Reference their actual numbers in your response (e.g., "With your 1:10 lunch ratio...")
4. Consider their insulin delivery method and diabetes type
5. Give practical, personalised advice based on their unique settings

Keep the response concise (4-5 bullet points) and directly actionable. Always include a safety reminder.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const recommendation = completion.choices[0].message.content || "Unable to generate recommendation";

      res.json({ recommendation });
    } catch (error) {
      console.error("Activity advice error:", error);
      res.status(500).send("Failed to generate advice");
    }
  });

  // Activity history is handled via client-side local storage

  const httpServer = createServer(app);

  return httpServer;
}
