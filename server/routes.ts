import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSettingsSchema, insertSupplySchema, updateSupplySchema, insertActivityLogSchema } from "@shared/schema";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  
  // User Settings Routes
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    
    try {
      const settings = await storage.getUserSettings(req.user!.id);
      res.json(settings || null);
    } catch (error) {
      res.status(500).send("Failed to fetch settings");
    }
  });

  app.post("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const validatedData = insertUserSettingsSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });

      const existing = await storage.getUserSettings(req.user!.id);
      let settings;
      
      if (existing) {
        settings = await storage.updateUserSettings(req.user!.id, validatedData);
      } else {
        settings = await storage.createUserSettings(validatedData);
      }

      res.json(settings);
    } catch (error) {
      res.status(400).send("Invalid settings data");
    }
  });

  // Supply Routes
  app.get("/api/supplies", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const supplies = await storage.getSupplies(req.user!.id);
      res.json(supplies);
    } catch (error) {
      res.status(500).send("Failed to fetch supplies");
    }
  });

  app.post("/api/supplies", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const validatedData = insertSupplySchema.parse({
        ...req.body,
        userId: req.user!.id,
      });

      const supply = await storage.createSupply(validatedData);
      res.json(supply);
    } catch (error) {
      res.status(400).send("Invalid supply data");
    }
  });

  app.patch("/api/supplies/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const validatedData = updateSupplySchema.parse(req.body);
      const supply = await storage.updateSupply(req.user!.id, req.params.id, validatedData);
      if (!supply) {
        return res.status(404).send("Supply not found");
      }
      res.json(supply);
    } catch (error) {
      res.status(400).send("Invalid supply data");
    }
  });

  // Sick Day Calculation Route
  app.post("/api/sick-day/calculate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

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
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!openai) {
      return res.status(503).send("OpenAI API key not configured");
    }

    try {
      const { activityType, activityDetails } = req.body;
      
      if (!activityType || !activityDetails) {
        return res.status(400).send("Missing required fields");
      }

      const settings = await storage.getUserSettings(req.user!.id);
      if (!settings || !settings.breakfastRatio) {
        return res.status(400).send("Please complete your settings setup first");
      }

      const prompt = `You are a diabetes management assistant. A person with Type 1 diabetes is planning an activity and needs advice on carbohydrate intake and insulin adjustments.

Their current mealtime ratios are:
- Breakfast: ${settings.breakfastRatio}
- Lunch: ${settings.lunchRatio}
- Dinner: ${settings.dinnerRatio}
- Snacks: ${settings.snackRatio}

Activity details:
- Type: ${activityType}
- Details: ${activityDetails}

Provide practical, concise advice on:
1. Recommended carb intake before/during the activity
2. Whether to adjust insulin dose and by how much
3. Any safety reminders

Keep the response brief (3-4 short bullet points) and actionable.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const recommendation = completion.choices[0].message.content || "Unable to generate recommendation";

      await storage.createActivityLog({
        userId: req.user!.id,
        activityType,
        activityDetails,
        recommendation,
      });

      res.json({ recommendation });
    } catch (error) {
      console.error("Activity advice error:", error);
      res.status(500).send("Failed to generate advice");
    }
  });

  app.get("/api/activity/history", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const logs = await storage.getActivityLogs(req.user!.id, 10);
      res.json(logs);
    } catch (error) {
      res.status(500).send("Failed to fetch activity history");
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
