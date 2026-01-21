import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Simple in-memory cache for news articles
interface NewsCache {
  articles: NewsArticle[];
  fetchedAt: number;
}

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  urlToImage?: string;
}

let newsCache: NewsCache | null = null;
const NEWS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Root health check for deployment (must return 200 quickly)
  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  // API health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Sick Day Calculation Route
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

  // Activity Adviser Route
  app.post("/api/activity/advice", async (req, res) => {
    if (!openai) {
      return res.status(503).send("OpenAI API key not configured");
    }

    try {
      const { activityType, activityDetails, userProfile, userSettings, conversationHistory, activityLogs, currentTime } = req.body;
      
      if (!activityType || !activityDetails) {
        return res.status(400).send("Missing required fields");
      }

      const profile = userProfile || {};
      const settings = userSettings || {};

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
        if (settings.correctionFactor) userContext.push(`Correction Factor: 1:${settings.correctionFactor}`);
        if (settings.targetBgLow && settings.targetBgHigh) {
          userContext.push(`Target BG Range: ${settings.targetBgLow}-${settings.targetBgHigh}`);
        }
      }

      const bgUnits = profile?.bgUnits || "mmol/L";
      const carbUnits = profile?.carbUnits || "Grams";

      // Time-of-day awareness
      const hour = currentTime ? new Date(currentTime).getHours() : new Date().getHours();
      const mealPeriod = hour >= 5 && hour < 10 ? "breakfast" :
                         hour >= 10 && hour < 14 ? "lunch" :
                         hour >= 14 && hour < 17 ? "afternoon snack" :
                         hour >= 17 && hour < 21 ? "dinner" : "evening snack";
      const timeContext = `Current time: ${new Date(currentTime || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (${mealPeriod} time)`;

      // Historical learning - recent activity logs
      let historyContext = "";
      if (activityLogs && activityLogs.length > 0) {
        const relevantLogs = activityLogs.slice(0, 5);
        historyContext = `\n**Recent Activity History (learn from patterns):**\n` +
          relevantLogs.map((log: { activityType: string; activityDetails: string; recommendation: string }) => 
            `- ${log.activityType}: "${log.activityDetails}" → ${log.recommendation.substring(0, 100)}...`
          ).join("\n");
      }

      // Build conversation history for context
      let conversationContext = "";
      if (conversationHistory && conversationHistory.length > 0) {
        const recentMessages = conversationHistory.slice(-6);
        conversationContext = `\n**Previous messages in this conversation:**\n` +
          recentMessages.map((msg: { role: string; content: string }) => 
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? "..." : ""}`
          ).join("\n");
      }
      
      const prompt = `You are a personalised diabetes management assistant for a UK user. You MUST tailor your advice to their specific settings.

**CRITICAL - UNITS REQUIREMENT:**
- Blood glucose: ALWAYS use ${bgUnits} (NEVER use ${bgUnits === "mmol/L" ? "mg/dL" : "mmol/L"})
- Carbohydrates: ALWAYS use ${carbUnits}
- This is non-negotiable. Using wrong units could be dangerous.

**${timeContext}**
Use the appropriate meal ratio for this time of day (${mealPeriod}).

**User's Personal Settings:**
${userContext.length > 0 ? userContext.join("\n") : "No settings configured yet"}
${historyContext}
${conversationContext}

**Current Question/Activity:**
- Type: ${activityType}
- Details: ${activityDetails}

**Instructions:**
1. ALWAYS express blood glucose values in ${bgUnits} - never use any other unit
2. Use the ${mealPeriod} ratio for this time of day when relevant
3. Reference their actual numbers and any patterns from history
4. Consider their insulin delivery method and diabetes type
5. Give practical, personalised advice based on their unique settings
6. If this is a follow-up question, reference the conversation context

**IMPORTANT - End your response with a confidence indicator on a new line:**
Format: [Confidence: HIGH/MEDIUM/LOW]
- HIGH: User has complete settings configured and question is straightforward
- MEDIUM: Some settings missing or activity involves multiple factors
- LOW: Significant unknowns or unusual situation

Keep the response concise (4-5 bullet points) and directly actionable. Always include a safety reminder.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      });

      const recommendation = completion.choices[0].message.content || "Unable to generate recommendation";

      // Extract confidence level from response
      const confidenceMatch = recommendation.match(/\[Confidence:\s*(HIGH|MEDIUM|LOW)\]/i);
      const confidence = confidenceMatch ? confidenceMatch[1].toUpperCase() : "MEDIUM";
      const cleanRecommendation = recommendation.replace(/\[Confidence:\s*(HIGH|MEDIUM|LOW)\]/gi, "").trim();

      res.json({ 
        recommendation: cleanRecommendation, 
        confidence,
        mealPeriod 
      });
    } catch (error) {
      console.error("Activity advice error:", error);
      res.status(500).send("Failed to generate advice");
    }
  });

  // Diabetes News API endpoint
  app.get("/api/news", async (_req, res) => {
    try {
      const NEWS_API_KEY = process.env.NEWS_API_KEY;
      
      // Check if we have cached articles that are still fresh
      if (newsCache && (Date.now() - newsCache.fetchedAt) < NEWS_CACHE_DURATION) {
        return res.json({ articles: newsCache.articles, cached: true });
      }

      // If no API key, return curated fallback articles
      if (!NEWS_API_KEY) {
        const fallbackArticles: NewsArticle[] = [
          {
            title: "Latest Advances in Continuous Glucose Monitoring Technology",
            description: "New CGM devices offer improved accuracy and longer wear times, making diabetes management easier for patients.",
            url: "https://www.diabetes.org.uk/guide-to-diabetes/managing-your-diabetes/testing",
            source: "Diabetes UK",
            publishedAt: new Date().toISOString(),
          },
          {
            title: "Understanding Insulin Resistance: What Every Diabetic Should Know",
            description: "Research highlights the importance of lifestyle factors in managing insulin sensitivity.",
            url: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food",
            source: "Diabetes UK",
            publishedAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            title: "Exercise and Blood Sugar: Tips for Safe Physical Activity",
            description: "Expert guidance on how to balance exercise with insulin and carbohydrate intake for optimal glucose control.",
            url: "https://www.diabetes.org.uk/guide-to-diabetes/managing-your-diabetes/exercise",
            source: "Diabetes UK",
            publishedAt: new Date(Date.now() - 172800000).toISOString(),
          },
          {
            title: "New Research on Type 1 Diabetes Prevention",
            description: "Scientists are making progress in understanding the triggers of Type 1 diabetes and potential prevention strategies.",
            url: "https://jdrf.org.uk/information-and-support/",
            source: "JDRF UK",
            publishedAt: new Date(Date.now() - 259200000).toISOString(),
          },
          {
            title: "Mental Health and Diabetes: Breaking the Stigma",
            description: "Support resources and coping strategies for the emotional challenges of living with diabetes.",
            url: "https://www.diabetes.org.uk/guide-to-diabetes/living-with-diabetes/emotional-wellbeing",
            source: "Diabetes UK",
            publishedAt: new Date(Date.now() - 345600000).toISOString(),
          },
        ];
        
        return res.json({ 
          articles: fallbackArticles, 
          cached: false,
          message: "Showing curated articles. Add NEWS_API_KEY for live news." 
        });
      }

      // Fetch from NewsAPI
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=diabetes+health&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`NewsAPI responded with ${response.status}`);
      }

      const data = await response.json();
      
      const articles: NewsArticle[] = (data.articles || []).map((article: any) => ({
        title: article.title || "Untitled",
        description: article.description || "",
        url: article.url || "#",
        source: article.source?.name || "Unknown",
        publishedAt: article.publishedAt || new Date().toISOString(),
        urlToImage: article.urlToImage,
      }));

      // Cache the results
      newsCache = {
        articles,
        fetchedAt: Date.now(),
      };

      res.json({ articles, cached: false });
    } catch (error) {
      console.error("News fetch error:", error);
      
      // Return cached data if available, even if stale
      if (newsCache) {
        return res.json({ articles: newsCache.articles, cached: true, stale: true });
      }
      
      res.status(500).json({ error: "Failed to fetch news", articles: [] });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
