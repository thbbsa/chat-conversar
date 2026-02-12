import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const users = new Map(); // Corrigido

wss.on('connection', (ws) => {
  let username = null;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg); // Corrigido

    if (data.type === 'register') {
      username = data.username;

      if (users.has(username)) {
        const user = users.get(username);
        user.socket = ws;
        user.online = true;
      } else {
        users.set(username, {
          socket: ws,
          online: true
        });
      }

      const onlineUsers = Array.from(users.entries())
        .filter(([name, userData]) => userData.online && name !== username)
        .map(([name]) => name);

      ws.send(JSON.stringify({
        type: 'online_list',
        users: onlineUsers
      }));

      // Notifica os outros
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user_online',
            username: username
          }));
        }
      });

      return;
    }

    // Broadcast geral
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  });

  ws.on('close', () => {
    if (username && users.has(username)) {
      const user = users.get(username);
      user.online = false;

      // Notificar que ficou offline
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user_offline',
            username: username
          }));
        }
      });
    }
  });
});
