// Сервер-посредник для игры с друзьями: пересылает сообщения между хостом и друзьями,
// если прямое соединение браузеров (WebRTC) не пробивается через роутеры.
// Комната = код игры. Хост: ?room=КОД&role=host, друг: ?room=КОД&role=guest
const http = require('http');
const { WebSocketServer } = require('ws');

const MAX_GUESTS = 4;
const rooms = new Map(); // код -> { host, guests: Map(id -> ws), seq }

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end('countryfail relay ok, rooms: ' + rooms.size);
});
const wss = new WebSocketServer({ server, maxPayload: 32 * 1024 * 1024 });

const sendJSON = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const code = (url.searchParams.get('room') || '').toUpperCase().slice(0, 12);
  const role = url.searchParams.get('role');
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  if (!code) return ws.close();

  if (role === 'host') {
    const old = rooms.get(code);
    if (old && old.host && old.host.readyState === 1) old.host.close();
    const room = { host: ws, guests: old ? old.guests : new Map(), seq: old ? old.seq : 0 };
    rooms.set(code, room);
    sendJSON(ws, { ev: 'hosting' });
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
      if (m.kick) { const g = room.guests.get(m.kick); if (g) g.close(); return; }
      const g = room.guests.get(m.to);
      if (g && g.readyState === 1) g.send(m.m);
    });
    ws.on('close', () => {
      if (rooms.get(code) !== room) return;
      for (const g of room.guests.values()) { sendJSON(g, { ev: 'hostleft' }); g.close(); }
      rooms.delete(code);
    });
    return;
  }

  // друг
  const room = rooms.get(code);
  if (!room || !room.host || room.host.readyState !== 1) { sendJSON(ws, { ev: 'nohost' }); return ws.close(); }
  if (room.guests.size >= MAX_GUESTS) { sendJSON(ws, { ev: 'full' }); return ws.close(); }
  const id = 'g' + (++room.seq);
  room.guests.set(id, ws);
  sendJSON(ws, { ev: 'ready' });
  sendJSON(room.host, { ev: 'join', id });
  ws.on('message', raw => { if (room.host.readyState === 1) room.host.send(JSON.stringify({ from: id, m: raw.toString() })); });
  ws.on('close', () => { room.guests.delete(id); sendJSON(room.host, { ev: 'leave', id }); });
});

// держим соединения живыми и убираем зависшие
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 25000);

server.listen(process.env.PORT || 10000, () => console.log('relay listening on', process.env.PORT || 10000));
