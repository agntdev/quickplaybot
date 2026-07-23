import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getVideoByShortId, getShortLink } from "../storage.js";

const composer = new Composer<Ctx>();

// Handle share callback
composer.callbackQuery(/^share:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const shortId = ctx.match?.[1];
  if (!shortId) {
    await ctx.reply("Invalid share link. Try again.");
    return;
  }
  
  const video = await getVideoByShortId(shortId);
  
  if (!video) {
    await ctx.reply(
      "This video link has expired or been removed.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  const shortLink = getShortLink(video.short_id);
  
  // Check if expired
  if (new Date(video.expire_at) < new Date()) {
    await ctx.reply(
      "This video link has expired.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  const keyboard = inlineKeyboard([
    [inlineButton("🔗 Open video", video.source_url)],
    [
      inlineButton("📋 Share", `share:${video.short_id}`),
      inlineButton("🗑 Delete", `delete:${video.short_id}`),
    ],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
  
  await ctx.reply(
    `📺 ${video.title}\n\n` +
    `Share this link:\n${shortLink}`,
    { reply_markup: keyboard },
  );
});

export default composer;
