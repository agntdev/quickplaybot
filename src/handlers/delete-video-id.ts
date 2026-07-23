import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { deleteVideoRecord, getVideoByShortId } from "../storage.js";

const composer = new Composer<Ctx>();

// Handle delete callback
composer.callbackQuery(/^delete:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const shortId = ctx.match?.[1];
  if (!shortId) {
    await ctx.reply("Invalid delete request. Try again.");
    return;
  }
  
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Couldn't identify your account. Try again.");
    return;
  }
  
  const video = await getVideoByShortId(shortId);
  
  if (!video) {
    await ctx.reply(
      "This video link has already been removed.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  // Verify ownership
  if (video.owner_id !== userId) {
    await ctx.reply(
      "You can only delete your own videos.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  // Delete the video
  const deleted = await deleteVideoRecord(video.id, userId);
  
  if (deleted) {
    await ctx.reply(
      `Deleted "${video.title}". The share link is no longer active.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("📹 My videos", "videos:list")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  } else {
    await ctx.reply(
      "Couldn't delete that video. Please try again.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  }
});

export default composer;
