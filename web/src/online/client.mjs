const API = '/smartCockpit/api/games';
export class RoomClient {
  constructor(onMessage, onStatus) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socket = null;
    this.closed = false;
    this.attempts = 0;
  }
  async enter(options) {
    const r = await fetch(API + '/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.message || body.detail || '房间服务暂时繁忙，请稍后重试');
    this.ticket = body;
    this.open();
    return body;
  }
  open() {
    if (this.closed) return;
    this.onStatus('connecting');
    const url = new URL(API + '/ws', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = (this.socket = new WebSocket(url));
    socket.onopen = () => {
      this.send({ type: 'auth', code: this.ticket.room.code, token: this.ticket.token });
    };
    socket.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data);
        if (m.type === 'welcome') {
          this.attempts = 0;
          this.onStatus('connected');
        }
        if (m.type === 'pong') this.onStatus('connected', Math.max(0, Date.now() - m.at));
        this.onMessage(m);
      } catch (error) {
        console.error('Online snapshot processing failed', error);
        this.onStatus('error');
      }
    };
    socket.onclose = () => {
      clearInterval(this.ping);
      if (this.closed) return;
      this.onStatus('disconnected');
      if (++this.attempts <= 10)
        this.retry = setTimeout(() => this.open(), Math.min(5000, 600 * this.attempts));
    };
    socket.onerror = () => socket.close();
    clearInterval(this.ping);
    this.ping = setInterval(() => this.send({ type: 'ping', at: Date.now() }), 5000);
  }
  send(m) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 180000)
      return false;
    if (m.type === 'frame' && !this.canSendFrame()) return false;
    this.socket.send(JSON.stringify(m));
    return true;
  }
  canSendFrame() {
    return this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 24000;
  }
  close() {
    this.send({ type: 'leave' });
    this.closed = true;
    clearTimeout(this.retry);
    clearInterval(this.ping);
    this.socket?.close();
  }
}
