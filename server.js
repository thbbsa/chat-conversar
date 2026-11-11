import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { dados, salvarDados } from './banco.js';


const pasta = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(pasta, 'dist', 'chat-conversar', 'browser');
const porta = 8080;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const conexoes = new Map();

app.use(express.static(frontend));
app.get(['/chat', '/cadastro', '/login'], (_req, res) => res.sendFile(path.join(frontend, 'index.html')));
app.get('/chat.html', (_req, res) => res.redirect('/chat'));

function enviar(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function online(id) {
  return [...conexoes].some(([socket, usuario]) =>
    socket.readyState === WebSocket.OPEN && usuario.id === id);
}

wss.on('connection', (ws) => {
  let usuario = null;

  function registrar(nome) {
    if (typeof nome !== 'string' || nome.trim().length < 3 || nome.length > 40) return;
    nome = nome.trim();
    usuario = dados.usuarios.find(item => item.username.toLowerCase() === nome.toLowerCase());
    if (!usuario) {
      usuario = { id: dados.proximoIdUsuario++, username: nome };
      dados.usuarios.push(usuario);
      try {
        salvarDados();
      } catch {
        dados.usuarios.pop();
        dados.proximoIdUsuario--;
        usuario = null;
        ws.close(1011, 'Erro ao salvar');
        return;
      }
    }
    const jaOnline = online(usuario.id);
    conexoes.set(ws, usuario);
    const lista = dados.usuarios.filter(u => u.id !== usuario.id).map(u => ({
      id: u.id, username: u.username, online: online(u.id)
    }));
    enviar(ws, { type: 'online_list', id: usuario.id, users: lista });
    enviar(ws, {
      type: 'historico',
      mensagens: dados.mensagens.filter(m =>
        m.chatId === 'global' || m.remetenteId === usuario.id || m.destinatarioId === usuario.id)
    });
    if (!jaOnline) {
      for (const client of conexoes.keys()) {
        if (client !== ws) enviar(client, { type: 'user_online', id: usuario.id, username: usuario.username });
      }
    }
  }
  ws.on('error', () => ws.terminate());
  ws.on('message', msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }
    if (!usuario) {
      if (data?.type === 'register') registrar(data.username);
      return;
    }
    if (typeof data?.content !== 'string' || !data.content.trim()) return;
    const destinatario = data.to ? dados.usuarios.find(u => u.username === data.to) : null;
    if (data.to && !destinatario) return;

    const chatId = destinatario
      ? [usuario.id, destinatario.id].sort((a, b) => a - b).join('-')
      : 'global';
    const mensagem = {
      id: dados.proximoIdMensagem++,
      chatId,
      remetenteId: usuario.id,
      destinatarioId: destinatario?.id ?? null,
      conteudo: data.content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: new Date().toISOString()
    };

    dados.mensagens.push(mensagem);
    try {
      salvarDados();
    } catch (erro) {
      dados.mensagens.pop();
      dados.proximoIdMensagem--;
      console.error('Erro ao salvar mensagem:', erro);
      return;
    }

    for (const [client, requisicao] of conexoes) {
      const id = requisicao.id;
      if (!destinatario || id === usuario.id || id === destinatario.id) enviar(client, mensagem);
    }
  });

  ws.on('close', () => {
    if (!usuario) return;
    conexoes.delete(ws);
    if (!online(usuario.id)) {
      for (const client of conexoes.keys()) enviar(client, { type: 'user_offline', username: usuario.username });
    }
  });
});

server.listen(porta, () => console.log(`Site e WebSocket rodando em http://localhost:${porta}`));
