import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const CHANNEL_PREFIX = 'mesa-viva:broadcast:'

// Two connections are required: ioredis puts a connection that has called
// (p)SUBSCRIBE into a special mode where it can no longer run other
// commands, so publishing and subscribing each need their own client.
const publisher = new Redis(REDIS_URL)
const subscriber = new Redis(REDIS_URL)

publisher.on('error', (err) => console.error('[redis:publisher]', err.message))
subscriber.on('error', (err) => console.error('[redis:subscriber]', err.message))

export function publishBroadcast(tenantId: string, message: unknown) {
  publisher.publish(CHANNEL_PREFIX + tenantId, JSON.stringify(message)).catch((err) => {
    console.error('[redis:publish]', err.message)
  })
}

// Registers the single handler that re-broadcasts every message (from any
// backend instance, including this one) to this instance's own WebSocket
// clients *for that same tenant only* — this is both what lets state
// changes fan out correctly across multiple backend instances (e.g. ECS
// tasks behind a load balancer) and what keeps one client's data from ever
// reaching another client's connected browsers. One pattern subscription
// covers every tenant's channel; the tenantId comes back out of the
// channel name itself.
export function onBroadcast(handler: (tenantId: string, message: unknown) => void) {
  subscriber.psubscribe(`${CHANNEL_PREFIX}*`).catch((err) => {
    console.error('[redis:psubscribe]', err.message)
  })
  subscriber.on('pmessage', (_pattern, channel, raw) => {
    const tenantId = channel.slice(CHANNEL_PREFIX.length)
    if (!tenantId) return
    try {
      handler(tenantId, JSON.parse(raw))
    } catch {
      // ignore malformed frames
    }
  })
}
