// Live per-user notifications over Server-Sent Events. Each signed-in browser
// tab keeps one stream open (GET /api/auth/events); the server writes a named
// event when something about that user changes — e.g. 'user' after the owner
// edits their permissions — and the client reacts at once instead of polling.
// In-memory: fine for the single API container this app runs as.

const streams = new Map(); // userId → Set<res>
const PING_MS = 25000; // under nginx's 60 s proxy_read_timeout

export function subscribe(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: pass each event through unbuffered
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const id = req.user.id;
  if (!streams.has(id)) streams.set(id, new Set());
  streams.get(id).add(res);

  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  req.on('close', () => {
    clearInterval(ping);
    const set = streams.get(id);
    set?.delete(res);
    if (set && !set.size) streams.delete(id);
  });
}

// Send `event` to every open stream of one user.
export function notifyUser(userId, event, data = {}) {
  for (const res of streams.get(userId) || []) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
