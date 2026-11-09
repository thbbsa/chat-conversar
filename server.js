import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;

// ---------- HTTP: serve o site (pasta public) ----------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// ---------- WebSocket: usa o mesmo servidor/porta ----------
const wss = new WebSocketServer({ server });
const users = new Map(); // username -> { socket, online }

function enviar(client, payload) {
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }
}

wss.on('connection', (ws) => {
  let username = null;

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return; // ignora mensagens que não são JSON
    }

    if (data.type === 'register') {
      username = data.username;

      if (users.has(username)) {
        const user = users.get(username);
        user.socket = ws;
        user.online = true;
      } else {
        users.set(username, { socket: ws, online: true });
      }

      const onlineUsers = Array.from(users.entries())
        .filter(([name, userData]) => name !== username)
        .map(([name, userData]) => ({ username: name, online: userData.online }));

      enviar(ws, { type: 'online_list', users: onlineUsers });

      // Notifica os outros
      wss.clients.forEach((client) => {
        if (client !== ws) enviar(client, { type: 'user_online', username });
      });

      return;
    }

    // Mensagem privada: vai só para quem enviou e para o destinatário
    if (data.to) {
      enviar(ws, msg.toString());
      const destino = users.get(data.to);
      if (destino && destino.online && destino.socket !== ws) {
        enviar(destino.socket, msg.toString());
      }
      return;
    }

    // Chat global: broadcast para todos
    wss.clients.forEach((client) => enviar(client, msg.toString()));
  });

  ws.on('close', () => {
    if (!username || !users.has(username)) return;

    const user = users.get(username);

    // Se o usuário já reconectou com outro socket, não marca como offline
    if (user.socket !== ws) return;

    user.online = false;

    wss.clients.forEach((client) => {
      enviar(client, { type: 'user_offline', username });
    });
  });
});

server.listen(PORT, () => {
  console.log(`Site e WebSocket rodando em http://localhost:${PORT}`);
});