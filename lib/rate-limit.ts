// Auth brute-force limiter (owner: 4 attempts / 4 minutes, 2026-07-10).
// Counts ONLY failed (invalid-password) attempts per client IP; a locked-out IP
// is blocked entirely for the window (even a subsequently-correct guess).
// Successful auth is never counted, so the mod widget's 5s polling with a valid
// password can never lock itself out. In-memory, single self-hosted instance.
const WINDOW_MS = 4 * 60 * 1000
const MAX_FAILURES = 4
const failures = new Map<string, number[]>()

export function clientIp(request: { headers: Headers }): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'local'
}

function recent(ip: string, now: number): number[] {
  const arr = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length > 0) failures.set(ip, arr)
  else failures.delete(ip)
  return arr
}

export function isLockedOut(ip: string, now = Date.now()): boolean {
  return recent(ip, now).length >= MAX_FAILURES
}

export function recordFailure(ip: string, now = Date.now()): void {
  const arr = recent(ip, now)
  arr.push(now)
  failures.set(ip, arr)
  // opportunistic sweep so the map can't grow unbounded under a distributed probe
  if (failures.size > 2048) {
    for (const [k, v] of failures) if (v.every((t) => now - t >= WINDOW_MS)) failures.delete(k)
  }
}
