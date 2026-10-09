import { GoogleGenAI, Type } from "@google/genai";
import { logger } from "../../lib/logger";

const API_KEY = process.env.GEMINI_API_KEY;

const ai = API_KEY
  ? new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

export interface ModerationResult {
  flagged: boolean;
  category: string;
  reason: string;
  confidence: number;
}

/**
 * Scan text for scam, phishing, or other prohibited patterns using Gemini AI.
 * Enhanced with Google Search grounding to verify scam domains across the whole internet.
 */
export async function scanTextWithGemini(text: string, categories: string[]): Promise<ModerationResult | null> {
  if (!ai || !text.trim()) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze the following Discord message for content moderation. 
Categories to check for: ${categories.join(", ")}.
Pay special attention to scams (nitro links, crypto, fake giveaways), phishing, and malicious domains.

If you find any URLs, please use Google Search to verify if they are known scam/malicious domains or if they are legitimate.

Message: "${text}"

Respond in JSON format:
{
  "flagged": boolean,
  "category": "category_name" or "safe",
  "reason": "short explanation (mention if search verified a scam domain)",
  "confidence": number (0-100)
}`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }] as any,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["flagged", "category", "reason", "confidence"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (err) {
    logger.warn({ err, text: text.slice(0, 50) }, "Gemini text scanning failed");
    return null;
  }
}

/**
 * Specifically scan for scam domains using Google Search grounding.
 */
export async function scanScamDomains(urls: string[]): Promise<ModerationResult | null> {
  if (!ai || urls.length === 0) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Investigate the following domains to see if they are part of any known scams, phishing campaigns, or malicious activities.
Check specifically for Discord Nitro scams, Steam phishing, and crypto drainers.

Domains: ${urls.join(", ")}

Respond in JSON format:
{
  "flagged": boolean,
  "category": "scam" or "phishing" or "malicious" or "safe",
  "reason": "reason including which domain is bad",
  "confidence": number (0-100)
}`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }] as any,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["flagged", "category", "reason", "confidence"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (err) {
    logger.warn({ err, urls }, "Gemini scam domain scan failed");
    return null;
  }
}

/**
 * Scan an image/gif for NSFW content or scam patterns using Gemini Vision.
 */
export async function scanMediaWithGemini(
  mediaUrl: string,
  mimeType: string,
): Promise<ModerationResult | null> {
  if (!ai || !mediaUrl) return null;

  try {
    // Fetch image data
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image", // Use lite-image for speed/cost unless high quality is needed
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Analyze this image/media for content moderation and safety violations. 
Check for:
1. NSFW content (pornography, sexual acts, explicit nudity).
2. Illegal content (CSAM/Child Safety violations - identify and flag immediately with 100% priority).
3. Scams (Discord Nitro scams, fake QR codes, phishing links).
4. Extreme violence or gore.

Provide a highly accurate assessment.

Respond in JSON format:
{
  "flagged": boolean,
  "category": "nsfw" | "scam" | "violence" | "illegal" | "safe",
  "reason": "short explanation of the violation",
  "confidence": number (0-100)
}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["flagged", "category", "reason", "confidence"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (err) {
    logger.warn({ err, url: mediaUrl }, "Gemini media scanning failed");
    return null;
  }
}
