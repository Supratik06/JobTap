import { EventEmitter } from 'events';

class TelemetryEventBus extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.history = [];
    this.maxHistory = 200;
  }

  addClient(res) {
    this.clients.add(res);
    // Send initial connection handshake and recent history
    try {
      res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), clientCount: this.clients.size })}\n\n`);
    } catch (e) {}
    
    // Replay recent history to new client
    if (this.history.length > 0) {
      try {
        res.write(`event: history\ndata: ${JSON.stringify(this.history.slice(-30))}\n\n`);
      } catch (e) {}
    }

    // Keepalive ping for Vercel / serverless proxy persistence
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (err) {
        clearInterval(keepAliveTimer);
        this.clients.delete(res);
      }
    }, 15000);

    const removeClient = () => {
      clearInterval(keepAliveTimer);
      this.clients.delete(res);
    };

    res.on('close', removeClient);
    res.on('finish', removeClient);
  }

  broadcast(type, payload) {
    const eventData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Store in history
    this.history.push(eventData);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Emit internally
    this.emit(type, eventData);

    // Stream to all connected SSE clients
    const sseMessage = `event: ${type}\ndata: ${JSON.stringify(eventData)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(sseMessage);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  log(level, stage, message, meta = {}) {
    this.broadcast('LOG', {
      level, // 'info' | 'warn' | 'error' | 'stealth' | 'resilience' | 'chaos'
      stage, // 'PACING' | 'STEALTH' | 'REQUEST' | 'PARSE' | 'VALIDATION' | 'FALLBACK' | 'CIRCUIT'
      message,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  metric(name, value, unit = '', tags = {}) {
    this.broadcast('METRIC', {
      name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString(),
    });
  }

  clearHistory() {
    this.history = [];
    this.broadcast('HISTORY_CLEARED', {});
  }
}

export const eventBus = new TelemetryEventBus();
