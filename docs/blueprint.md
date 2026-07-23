# VideoLinkPlayer — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot that accepts pasted video URLs, extracts metadata, and provides inline playback with a short shareable link. Users can manage recent videos and delete them to invalidate links. No uploads or account system required.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Telegram users
- Video sharers
- Quick media consumers

## Success criteria

- Users can paste a video URL and receive inline playback with a short link
- Users can view up to 10 recent videos via /myvideos with deletion options
- Short links expire after 90 days by default

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with usage instructions
- **Paste URL** (command, actor: user, command: /url_paste) — Trigger video processing when user sends a URL in chat
- **/myvideos** (command, actor: user, command: /myvideos) — Show user's recent video records
- **Share** (button, actor: user, callback: share:video_id) — Copy short link for video
  - inputs: video_id
  - outputs: short_link
- **Delete** (button, actor: user, callback: delete:video_id) — Remove video record and invalidate link
  - inputs: video_id
  - outputs: confirmation

## Flows

### url_processing
_Trigger:_ url_paste

1. Validate URL format
2. Probe metadata (title, duration, thumbnail)
3. Generate 7-character short ID
4. Store video record with owner Telegram ID
5. Reply with inline playable message and short link button

_Data touched:_ video_record

### video_listing
_Trigger:_ /myvideos

1. Fetch up to 10 most recent video records
2. Display list with metadata and action buttons

_Data touched:_ video_record, user

### deletion_flow
_Trigger:_ delete:video_id

1. Verify ownership
2. Delete video record
3. Send confirmation message

_Data touched:_ video_record

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **video_record** _(retention: persistent)_ — Processed video metadata and link information
  - fields: source_url, title, duration, thumbnail_url, short_id, visibility, owner_id, created_at, expire_at
- **user** _(retention: persistent)_ — User account and rate-limiting data
  - fields: telegram_id, display_name, daily_creation_count, request_timestamps

## Integrations

- **Telegram** (required) — Bot API messaging and inline media delivery
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure rate limits (default 20/day)
- Set retention TTL (default 90 days)
- Adjust listing cap (default 10 items)

## Notifications

- Rate limit exceeded warning
- Video deletion confirmation
- URL validation errors
- TTL expiration alerts for owners

## Permissions & privacy

- Only store Telegram user IDs and video metadata
- Private videos require direct short link access
- Public videos can be viewed by anyone with the link
- Data retention respects configured TTL

## Edge cases

- Unsupported URL formats
- Rate limit violations
- Expired video records
- Invalid short link requests
- Metadata extraction failures

## Required tests

- End-to-end URL paste → inline playback flow
- Verify /myvideos shows correct deletion buttons
- Test rate limiting with 20+ daily creations
- Validate short link expiration after 90 days

## Assumptions

- Metadata extraction works for common video hosts
- 7-character short IDs provide sufficient collision resistance
- Telegram's inline media API handles all supported formats
