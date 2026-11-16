import amqp from "amqplib";
import { AMQP_URL } from "./config.js";
import { assertTopology } from "./topology.js";

const redact = (url) => url.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");

// Owns one AMQP connection + confirm channel and keeps it alive.
// `onReady(channel, connection)` runs after every (re)connect — workers use it
// to re-register their consumers.
export function createBroker({ name, onReady } = {}) {
  let connection = null;
  let channel = null;
  let pending = null;
  let stopped = false;
  let retryTimer = null;
  let attempt = 0;

  async function open() {
    const conn = await amqp.connect(AMQP_URL, {
      timeout: 10000,
      clientProperties: { connection_name: name },
    });

    conn.on("error", (err) => console.error(`[mq:${name}] connection error: ${err.message}`));
    conn.on("close", () => {
      connection = null;
      channel = null;
      if (!stopped) {
        console.warn(`[mq:${name}] connection closed`);
        scheduleReconnect();
      }
    });

    try {
      const ch = await conn.createConfirmChannel();
      ch.on("error", (err) => console.error(`[mq:${name}] channel error: ${err.message}`));
      // A channel can be closed by the broker on its own (e.g. a protocol
      // error). Drop the whole connection so the reconnect path rebuilds it.
      ch.on("close", () => {
        channel = null;
        if (!stopped) conn.close().catch(() => {});
      });

      await assertTopology(ch);
      if (onReady) await onReady(ch, conn);

      connection = conn;
      channel = ch;
      attempt = 0;
      console.log(`[mq:${name}] connected to ${redact(AMQP_URL)}`);
      return ch;
    } catch (err) {
      await conn.close().catch(() => {});
      throw err;
    }
  }

  function getChannel() {
    if (channel) return Promise.resolve(channel);
    if (stopped) return Promise.reject(new Error("broker is shut down"));
    if (!pending) pending = open().finally(() => (pending = null));
    return pending;
  }

  function scheduleReconnect() {
    if (retryTimer || stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** attempt++);
    console.warn(`[mq:${name}] reconnecting in ${delay}ms`);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      try {
        await getChannel();
      } catch (err) {
        console.error(`[mq:${name}] reconnect failed: ${err.message}`);
        scheduleReconnect();
      }
    }, delay);
  }

  // Connect now, but don't crash the process if the broker is down — keep
  // retrying in the background.
  async function start() {
    try {
      await getChannel();
    } catch (err) {
      console.error(`[mq:${name}] initial connect failed: ${err.message}`);
      scheduleReconnect();
    }
  }

  async function close() {
    stopped = true;
    clearTimeout(retryTimer);
    if (connection) await connection.close().catch(() => {});
  }

  // Runs `fn` on a short-lived extra channel, so operations that can close a
  // channel on error (e.g. checkQueue on a missing queue) never take down the
  // main one.
  async function withTemporaryChannel(fn) {
    await getChannel();
    const ch = await connection.createChannel();
    ch.on("error", () => {});
    try {
      return await fn(ch);
    } finally {
      await ch.close().catch(() => {});
    }
  }

  return { getChannel, start, close, withTemporaryChannel, isConnected: () => channel !== null };
}
