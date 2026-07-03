# 💬 Chat Conversar

Aplicação de chat em tempo real, feita com **React** no front-end e **WebSocket (ws)** no back-end.

## 🚀 Tecnologias

- [React](https://react.dev/) 19
- [React Router](https://reactrouter.com/)
- [Bootstrap](https://getbootstrap.com/)
- [ws](https://github.com/websockets/ws) — servidor WebSocket para Node.js

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) instalado (recomendado v18+)

## ⚙️ Instalação

```bash
# Clone o repositório
git clone https://github.com/thbbsa/chat-conversar.git

# Entre na pasta
cd chat-conversar

# Instale as dependências
npm install
```

## ▶️ Como rodar

Este projeto tem duas partes que precisam rodar ao mesmo tempo, em terminais separados:

**1. Servidor WebSocket**
```bash
node server.js
```

**2. Aplicação React**
```bash
npm start
```

O front-end abre em `http://localhost:3000`, conectando ao servidor WebSocket em segundo plano.

## 📁 Estrutura do projeto
├── public/        → arquivos estáticos
├── src/             → código-fonte do React
├── server.js          → servidor WebSocket
└── package.json         → dependências do projeto

## 📝 Sobre

Projeto feito como exercício de estudo de React e comunicação em tempo real via WebSocket.
