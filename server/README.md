# Shared song catalogue service (local preparation only)

Requires Node 22.13+ with node:sqlite. Start `node server/community.mjs`, then `npx vite --config vite.pages.config.ts --host 127.0.0.1` and open the printed /-/ URL. SQLite is stored in ignored work/community.sqlite. Stop/restart retains all profiles, likes, copy events and wishes.

No identity verification: an ID is a shared editable profile key, as explicitly requested. IDs are case-sensitive, NFKC-normalized, 3–40 letters/numbers/underscore/hyphen. No passwords or personal contact information are collected. Likes and supports are unique per ID. Wishes merge by normalized case-insensitive title+artist. Each submission adds its author's support once. Copy event UUIDs deduplicate retries, not repeated intentional copies. Manual clipboard operations cannot be observed and are not counted. This is not resistant to users inventing IDs or sending fabricated copy events.

Production is deployed as Cloudflare Worker `jiuju-community` with D1 database `jiuju-community` (database id `05a4d0b0-ef08-4b44-9d0e-6bf5557235e3`). The frontend still requires `VITE_COMMUNITY_API` at build time and remains unpublished until requested. The local Node service remains available for offline development. Never place database files or credentials in Git or static assets.

API: GET /api/state?id=ID; POST /api/login {id,merge?:songIds}; /api/like {id,song,active}; /api/copy {song,event}; /api/wish {id,title,artist}; /api/vote {id,wish,active}. Responses return current profile and public rankings without exposing other profile IDs. Writes are transactional. Results refresh every 15 seconds while the frontend is open. No historical copy backfill.
