import { MemorySessionStorage } from "./toolkit/index.js";

/**
 * Persistent storage for durable domain data (video records, user data).
 * Uses MemorySessionStorage for both test harness and development.
 * Production would use Redis-backed storage via REDIS_URL env var.
 */

export interface VideoRecord {
  id: string;
  source_url: string;
  title: string;
  duration?: string;
  thumbnail_url?: string;
  short_id: string;
  visibility: "public" | "private";
  owner_id: number;
  created_at: string;
  expire_at: string;
}

export interface UserData {
  telegram_id: number;
  display_name: string;
  daily_creation_count: number;
  request_timestamps: number[];
}

// Singleton storage instances for durable data
const videoStorage = new MemorySessionStorage<VideoRecord>();
const userStorage = new MemorySessionStorage<UserData>();
const videoIndexStorage = new MemorySessionStorage<string[]>(); // userId -> videoIds[]

// Short link base URL (would be configured in production)
const SHORT_LINK_BASE = process.env.SHORT_LINK_BASE || "https://vl.ink";

// Default settings
const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_EXPIRY_DAYS = 90;
const DEFAULT_MAX_LISTING = 10;

/**
 * Generate a 7-character short ID from a string
 */
function generateShortId(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  let result = "";
  const absHash = Math.abs(hash);
  for (let i = 0; i < 7; i++) {
    result += chars[(absHash + i * 31) % chars.length];
  }
  return result;
}

/**
 * Get or create user data
 */
export async function getOrCreateUser(telegramId: number, displayName: string): Promise<UserData> {
  const key = `user:${telegramId}`;
  let user = await userStorage.read(key);
  
  if (!user) {
    user = {
      telegram_id: telegramId,
      display_name: displayName,
      daily_creation_count: 0,
      request_timestamps: [],
    };
    await userStorage.write(key, user);
  }
  
  return user;
}

/**
 * Check if user has exceeded daily creation limit
 */
export function canUserCreateVideo(user: UserData, now: Date = new Date()): boolean {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  // Filter timestamps to only today
  const todayTimestamps = user.request_timestamps.filter(
    (ts) => ts >= todayStart.getTime()
  );
  
  return todayTimestamps.length < DEFAULT_DAILY_LIMIT;
}

/**
 * Create a new video record
 */
export async function createVideoRecord(
  sourceUrl: string,
  title: string,
  ownerId: number,
  duration?: string,
  thumbnailUrl?: string,
  visibility: "public" | "private" = "public",
  now: Date = new Date(),
): Promise<VideoRecord | null> {
  // Check rate limit
  const user = await getOrCreateUser(ownerId, "");
  if (!canUserCreateVideo(user, now)) {
    return null;
  }
  
  // Generate unique short ID
  const shortId = generateShortId(sourceUrl + Date.now());
  
  // Set expiry date
  const expireAt = new Date(now);
  expireAt.setDate(expireAt.getDate() + DEFAULT_EXPIRY_DAYS);
  
  const videoId = `vid:${shortId}`;
  const record: VideoRecord = {
    id: videoId,
    source_url: sourceUrl,
    title,
    duration,
    thumbnail_url: thumbnailUrl,
    short_id: shortId,
    visibility,
    owner_id: ownerId,
    created_at: now.toISOString(),
    expire_at: expireAt.toISOString(),
  };
  
  // Store the record
  await videoStorage.write(videoId, record);
  
  // Update user's video index
  const indexKey = `userVideos:${ownerId}`;
  const videoIds = (await videoIndexStorage.read(indexKey)) || [];
  videoIds.unshift(videoId); // Add to front for most recent first
  await videoIndexStorage.write(indexKey, videoIds.slice(0, 50)); // Keep last 50
  
  // Update user's daily count and timestamps
  user.daily_creation_count++;
  user.request_timestamps.push(now.getTime());
  await userStorage.write(`user:${ownerId}`, user);
  
  return record;
}

/**
 * Get user's recent videos (up to limit)
 */
export async function getUserVideos(
  ownerId: number,
  limit: number = DEFAULT_MAX_LISTING,
): Promise<VideoRecord[]> {
  const indexKey = `userVideos:${ownerId}`;
  const videoIds = (await videoIndexStorage.read(indexKey)) || [];
  
  const videos: VideoRecord[] = [];
  for (const videoId of videoIds.slice(0, limit)) {
    const video = await videoStorage.read(videoId);
    if (video) {
      // Check if expired
      if (new Date(video.expire_at) < new Date()) {
        // Skip expired videos
        continue;
      }
      videos.push(video);
    }
  }
  
  return videos;
}

/**
 * Get video record by short ID
 */
export async function getVideoByShortId(shortId: string): Promise<VideoRecord | null> {
  const record = await videoStorage.read(`vid:${shortId}`);
  return record ?? null;
}

/**
 * Delete a video record
 */
export async function deleteVideoRecord(videoId: string, ownerId: number): Promise<boolean> {
  const video = await videoStorage.read(videoId);
  if (!video || video.owner_id !== ownerId) {
    return false;
  }
  
  await videoStorage.delete(videoId);
  
  // Remove from user's video index
  const indexKey = `userVideos:${ownerId}`;
  const videoIds = (await videoIndexStorage.read(indexKey)) || [];
  const updatedIds = videoIds.filter((id) => id !== videoId);
  await videoIndexStorage.write(indexKey, updatedIds);
  
  return true;
}

/**
 * Get short link for a video
 */
export function getShortLink(shortId: string): string {
  return `${SHORT_LINK_BASE}/${shortId}`;
}

/**
 * Extract video metadata from URL (simplified implementation)
 * In production, this would call real oembed APIs
 */
export async function extractVideoMetadata(
  url: string,
): Promise<{ title: string; duration?: string; thumbnailUrl?: string } | null> {
  try {
    // Basic URL validation
    const urlObj = new URL(url);
    
    // Extract domain for title
    const domain = urlObj.hostname.replace("www.", "");
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1 || 0] || domain;
    
    // Create a reasonable title from the URL
    const title = `${domain} - ${decodeURIComponent(lastPart).replace(/[-_]/g, " ")}`;
    
    return {
      title,
      duration: undefined,
      thumbnailUrl: undefined,
    };
  } catch {
    return null;
  }
}
