// SERVER-ONLY. In-memory ring of announcements sent FROM the panel, merged
// into the /api/chat feed (owner order 2026-07-14: a message sent from the
// panel must show up in the panel's own chat log).
//
// Why an echo ring: Palworld's server journal logs announce calls WITHOUT
// their content ("[LOG] REST accessed endpoint /v1/api/announce OK"), so a
// panel-sent broadcast can never be recovered from the journal the way player
// [CHAT] lines are. Announces sent by OTHER tools (RCON consoles, bots) are
// equally invisible — out of scope by design.
//
// In-memory module state by design (same pattern as panel-auth-store's verify
// cache): lost on dashboard restart, which matches the feed's rolling 3h scope.

export interface AnnounceEcho {
  type: 'chat'
  ts: string
  name: string
  text: string
}

const WINDOW_MS = 3 * 60 * 60 * 1000 // match the feed's `journalctl --since -3h`
const MAX_ECHOES = 200

const echoes: Array<AnnounceEcho & { at: number }> = []

function formatTs(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

/**
 * Record a panel-sent announce. `message` is the full in-game string
 * (e.g. "[Admin] hello" or "Operator: hello"); a leading "<label>: " is split
 * off as the display name so the feed line reads like what players saw.
 */
export function recordAnnounceEcho(message: string): void {
  const now = new Date()
  const m = /^(.{1,32}?):\s+(.*)$/s.exec(message)
  echoes.push({
    type: 'chat',
    ts: formatTs(now),
    name: m ? m[1]! : 'SYSTEM',
    text: m ? m[2]! : message,
    at: now.getTime(),
  })
  if (echoes.length > MAX_ECHOES) {
    echoes.splice(0, echoes.length - MAX_ECHOES)
  }
}

export function getAnnounceEchoes(): AnnounceEcho[] {
  const cutoff = Date.now() - WINDOW_MS
  return echoes.filter((echo) => echo.at >= cutoff).map(({ at: _at, ...event }) => event)
}
