import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const CHANNEL = 'mesa-viva:broadcast'

// Two connections are required: ioredis puts a connection that has called
// SUBSCRIBE into a special mode where it can no longer run other commands,
// so publishing and subscribing each need their own client.
const publisher = new Redis(REDIS_URL)
const subscriber = new Redis(REDIS_URL)

publisher.on('error', (err) => console.error('[redis:publisher]', err.message))
subscriber.on('error', (err) => console.error('[redis:subscriber]', err.message))

export function publishBroadcast(message: unknown) {
  publisher.publish(CHANNEL, JSON.stringify(message)).catch((err) => {
    console.error('[redis:publish]', err.message)
  })
}

// Registers the single handler that re-broadcasts every message (from any
// backend instance, including this one) to this instance's own WebSocket
// clients. This is what lets state changes fan out correctly when the
// backend is scaled to more than one running instance (e.g. several ECS
// tasks behind a load balancer) instead of only reaching whichever instance
// happened to handle the request that produced the change.
export function onBroadcast(handler: (message: unknown) => void) {
  subscriber.subscribe(CHANNEL).catch((err) => {
    console.error('[redis:subscribe]', err.message)
  })
  subscriber.on('message', (_channel, raw) => {
    try {
      handler(JSON.parse(raw))
    } catch {
      // ignore malformed frames
    }
  })
}
