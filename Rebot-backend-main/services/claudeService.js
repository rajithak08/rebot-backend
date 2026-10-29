import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Helper function to detect image media type from file extension
const getImageMediaType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const mediaTypeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
  };

  return mediaTypeMap[extension] || "image/jpeg"; // Default to jpeg if unknown
};

const isRemoteUrl = (value) => /^https?:\/\//i.test(value || "");

const readImageAsBase64 = async (imageSource) => {
  if (isRemoteUrl(imageSource)) {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.status}`);
    }

    const contentType = response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim();
    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    return {
      base64Image,
      mediaType: contentType || getImageMediaType(imageSource),
    };
  }

  const absolutePath = path.isAbsolute(imageSource)
    ? imageSource
    : path.join(process.cwd(), imageSource);
  const imageBuffer = await fs.readFile(absolutePath);

  return {
    base64Image: imageBuffer.toString("base64"),
    mediaType: getImageMediaType(absolutePath),
  };
};

export const analyzeProductImages = async (imagePaths, categoryHint = null) => {
  try {
    console.log("Starting product analysis with Claude 3.7 Sonnet...");

    if (!imagePaths || imagePaths.length === 0) {
      throw new Error("No images provided for analysis");
    }

    const firstImageSource = imagePaths[0];
    const { base64Image, mediaType } =
      await readImageAsBase64(firstImageSource);

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert product analyst for an electronics marketplace. 

FIRST: Determine if this image shows electronic products suitable for marketplace listing.

If you see electronic devices (smartphone, laptop, tablet, smartwatch, headphones, gaming console, camera, smart speaker, fitness tracker, e-reader, drone, or any other electronic gadget), analyze it and respond with valid JSON in this exact format:

{
  "product_category": "smartphone|laptop|tablet|smartwatch|headphones|gaming_console|camera|smart_speaker|fitness_tracker|e_reader|drone|other_electronics",
  "brand": "Apple|Samsung|Sony|Microsoft|Nintendo|etc",
  "model": "iPhone 14|MacBook Pro|PlayStation 5|etc", 
  "manufacture_year": 2023,
  "condition": "excellent|good|fair|poor",
  "description": "Detailed description of the product condition and features visible in the image",
  "accessories": ["charger", "case", "earphones"],
  "battery": "90%|good|unknown",
  "color": "black|white|silver|blue|red|etc",
  "storage": "128GB|256GB|512GB|1TB|unknown",
  "screen_size": "6.1 inch|13 inch|15 inch|unknown",
  "visible_damage": "none|minor scratches|screen crack|significant wear",
  "completeness": "complete|missing accessories|box only|device only",
  "estimated_price_range": {"min": 300, "max": 500},
  "confidence_score": 0.85
}

If this is NOT an electronic product (animals, people, nature, food, etc.), respond with:
{"error": "not_electronics", "message": "This image contains a [what you see] which is not an electronic product suitable for marketplace listing"}

RULES:
- Use "unknown" for any field you cannot determine from the image
- Be conservative with price estimates
- Confidence score should be between 0.1 and 1.0
- Respond with ONLY valid JSON, no extra text
- If you see anything other than electronic devices, use the error format`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      temperature: 0.3,
    });

    const analysisText = response.content[0].text;
    console.log("Raw Claude 3.7 response:", analysisText);

    const cleanedResponse = analysisText
      .replace(/```json\n?|\n?```/g, "")
      .trim();

    let analysisResult;
    try {
      analysisResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error(" JSON parsing failed, raw response:", analysisText);
      throw new Error(
        "Could not parse AI response as JSON: " + parseError.message,
      );
    }

    // Check if Claude detected non-electronics
    if (analysisResult.error === "not_electronics") {
      console.log("Non-electronics detected:", analysisResult.message);
      return {
        error: "invalid_product_type",
        message: "No electronic products detected in the uploaded images.",
        detailed_message: analysisResult.message,
        suggested_action:
          "Please upload clear images of electronic products only.",
        examples:
          "Valid products: smartphones, laptops, tablets, headphones, gaming consoles, cameras, etc.",
      };
    }

    // Check if the description suggests non-electronics
    if (
      analysisResult.description &&
      (analysisResult.description.toLowerCase().includes("cow") ||
        analysisResult.description.toLowerCase().includes("animal") ||
        analysisResult.description
          .toLowerCase()
          .includes("not an electronic") ||
        analysisResult.description.toLowerCase().includes("not electronic"))
    ) {
      console.log("Non-electronics detected in description");
      return {
        error: "invalid_product_type",
        message: "No electronic products detected in the uploaded images.",
        detailed_message: `Detected: ${analysisResult.description}`,
        suggested_action:
          "Please upload clear images of electronic products only.",
        examples:
          "Valid products: smartphones, laptops, tablets, headphones, gaming consoles, cameras, etc.",
      };
    }

    analysisResult.analysis_metadata = {
      analyzed_at: new Date().toISOString(),
      images_count: imagePaths.length,
      model_used: "claude-3-7-sonnet-20250219",
      processing_time: Date.now(),
    };

    console.log("Claude 3.7 analysis completed successfully");
    return analysisResult;
  } catch (error) {
    console.error("Error analyzing with Claude 3.7:", error);
    return {
      error: true,
      message: error.message,
      fallback_data: {
        product_category: "unknown",
        brand: "unknown",
        model: "unknown",
        condition: "unknown",
        description: "AI analysis failed. Please fill in details manually.",
        confidence_score: 0.0,
      },
    };
  }
};

export const detectProductCategory = async (imagePath) => {
  return true; // Always allow for now
};

export const validateAndEnhanceAnalysis = (analysisResult) => {
  return analysisResult;
};

export default {
  analyzeProductImages,
  detectProductCategory,
  validateAndEnhanceAnalysis,
};
