import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

import { dados, salvarDados } from './banco.js';

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

    // ---------- Registro ----------
    if (data.type === 'register') {
      username = String(data.username || '').trim();
      if (!username) return;

      // Cadastra o usuário se for a primeira vez
      let userData = dados.usuarios.find((u) => u.username === username);

      if (!userData) {
        userData = { id: dados.proximoIdUsuario++, username };
        dados.usuarios.push(userData); // mesmo objeto: o id fica igual
        salvarDados();
      }

      if (users.has(username)) {
        const user = users.get(username);
        user.socket = ws;
        user.online = true;
      } else {
        users.set(username, { socket: ws, online: true });
      }

      // Todos os usuários cadastrados (menos você), com o status de cada um
      const lista = dados.usuarios
        .filter((u) => u.id !== userData.id)
        .map((u) => ({
          id: u.id,
          username: u.username,
          online: users.get(u.username)?.online || false
        }));

      enviar(ws, { type: 'online_list', id: userData.id, users: lista });

      // Histórico: global + conversas privadas em que a pessoa participa
      const historico = dados.mensagens.filter(
        (m) =>
          m.chatId === 'global' ||
          m.remetenteId === userData.id ||
          m.destinatarioId === userData.id
      );
      enviar(ws, { type: 'historico', mensagens: historico });

      // Notifica os outros
      wss.clients.forEach((client) => {
        if (client !== ws) {
          enviar(client, { type: 'user_online', id: userData.id, username });
        }
      });

      return;
    }

    // Ignora mensagens de quem ainda não se registrou
    if (!username) return;

    const sender = dados.usuarios.find((u) => u.username === username);
    if (!sender) return;

    // Ignora mensagens vazias
    if (typeof data.content !== 'string' || data.content.trim() === '') return;

    const destinatario = data.to ? dados.usuarios.find((u) => u.username === data.to) : null;

    // Se pediu um destinatário que não existe, descarta
    if (data.to && !destinatario) return;

    const chatId = destinatario
      ? [sender.id, destinatario.id].sort((a, b) => a - b).join('-')
      : 'global';

    // ---------- Nova mensagem: cria, guarda e salva ----------
    const mensagem = {
      id: dados.proximoIdMensagem++,
      chatId,
      remetenteId: sender.id,
      destinatarioId: destinatario ? destinatario.id : null,
      conteudo: data.content,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      data: new Date().toISOString()
    };

    dados.mensagens.push(mensagem);
    salvarDados();

    const texto = JSON.stringify(mensagem);

    // Mensagem privada: vai para quem enviou e para o destinatário (se estiver online)
    if (destinatario) {
      enviar(ws, texto);

      const destino = users.get(destinatario.username);
      if (destino && destino.online && destino.socket !== ws) {
        enviar(destino.socket, texto);
      }
      // Se estiver offline, recebe pelo histórico ao voltar
      return;
    }

    // Chat global: broadcast para todos
    wss.clients.forEach((client) => enviar(client, texto));
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