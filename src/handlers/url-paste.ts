import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  createVideoRecord,
  extractVideoMetadata,
  getShortLink,
} from "../storage.js";
import { registerMainMenuItem } from "../toolkit/index.js";

// Register main menu item for URL paste feature
registerMainMenuItem({ label: "🔗 Paste URL", data: "url:paste", order: 10 });

const composer = new Composer<Ctx>();

// URL pattern for detecting video URLs
const URL_REGEX = /https?:\/\/[^\s]+/i;

// Handle /url_paste command
composer.command("url_paste", async (ctx) => {
  const userId = ctx.from?.id;
  const userName = ctx.from?.first_name || "User";
  
  if (!userId) {
    await ctx.reply("Couldn't identify your account. Try again.");
    return;
  }
  
  await ctx.reply(
    "Paste a video URL and I'll process it for you.\n\n" +
    "Supported formats: YouTube, Vimeo, Dailymotion, and most video sites."
  );
});

// Handle the main menu button tap
composer.callbackQuery("url:paste", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Paste a video URL and I'll process it for you.\n\n" +
    "Supported formats: YouTube, Vimeo, Dailymotion, and most video sites.",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

// Handle text messages that contain URLs (only when user is in URL paste mode)
composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from?.id;
  const userName = ctx.from?.first_name || "User";
  
  // Skip if this is a command (already handled by command handlers)
  if (text.startsWith("/")) {
    return next();
  }
  
  // Check if message contains a URL
  const urlMatch = text.match(URL_REGEX);
  if (!urlMatch) {
    return next();
  }
  
  const url = urlMatch[0];
  
  if (!userId) {
    await ctx.reply("Couldn't identify your account. Try again.");
    return;
  }
  
  // Send "processing" message
  const processingMsg = await ctx.reply("Processing your video URL...");
  
  try {
    // Extract metadata from URL
    const metadata = await extractVideoMetadata(url);
    
    if (!metadata) {
      await ctx.reply(
        "Couldn't process that URL. Make sure it's a valid video link and try again."
      );
      return;
    }
    
    // Create video record
    const videoRecord = await createVideoRecord(
      url,
      metadata.title,
      userId,
      metadata.duration,
      metadata.thumbnailUrl,
      "public",
    );
    
    if (!videoRecord) {
      await ctx.reply(
        "You've reached the daily limit of 20 videos. Try again tomorrow."
      );
      return;
    }
    
    // Build response with video info and buttons
    const shortLink = getShortLink(videoRecord.short_id);
    
    const keyboard = inlineKeyboard([
      [inlineButton("🔗 Open video", url)],
      [
        inlineButton("📋 Share", `share:${videoRecord.short_id}`),
        inlineButton("🗑 Delete", `delete:${videoRecord.short_id}`),
      ],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);
    
    await ctx.reply(
      `Video processed successfully!\n\n` +
      `📺 ${metadata.title}\n` +
      `🔗 ${shortLink}`,
      { reply_markup: keyboard },
    );
  } catch (error) {
    console.error("[url-paste] Error processing URL:", error);
    await ctx.reply(
      "Something went wrong while processing that URL. Please try again."
    );
  }
});

export default composer;
