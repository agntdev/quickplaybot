import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUserVideos, getShortLink } from "../storage.js";
import { registerMainMenuItem } from "../toolkit/index.js";

// Register main menu item for myvideos feature
registerMainMenuItem({ label: "📹 My videos", data: "videos:list", order: 30 });

const composer = new Composer<Ctx>();

// Handle /myvideos command
composer.command("myvideos", async (ctx) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply("Couldn't identify your account. Try again.");
    return;
  }
  
  const videos = await getUserVideos(userId, 10);
  
  if (videos.length === 0) {
    await ctx.reply(
      "No videos yet — paste a URL to add one.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  const keyboard = videos.map((video) => [
    inlineButton(`📋 ${video.title.slice(0, 30)}`, `share:${video.short_id}`),
    inlineButton("🗑", `delete:${video.short_id}`),
  ]);
  
  keyboard.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  
  await ctx.reply(
    `Your videos (${videos.length}):`,
    { reply_markup: inlineKeyboard(keyboard) },
  );
});

// Handle main menu button tap
composer.callbackQuery("videos:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.editMessageText("Couldn't identify your account. Try again.");
    return;
  }
  
  const videos = await getUserVideos(userId, 10);
  
  if (videos.length === 0) {
    await ctx.editMessageText(
      "No videos yet — paste a URL to add one.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  
  const keyboard = videos.map((video) => [
    inlineButton(`📋 ${video.title.slice(0, 30)}`, `share:${video.short_id}`),
    inlineButton("🗑", `delete:${video.short_id}`),
  ]);
  
  keyboard.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  
  await ctx.editMessageText(
    `Your videos (${videos.length}):`,
    { reply_markup: inlineKeyboard(keyboard) },
  );
});

export default composer;
