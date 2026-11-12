document.addEventListener('DOMContentLoaded', () => {
  // 1. Verificação de sessão
  const username = Contas.usuarioLogado();
  if (!username) {
    window.location.replace('/login.html');
    return;
  }

  // Elementos da interface
  const nomeUsuarioLogado = document.getElementById('nome-usuario-logado');
  const listaChats = document.getElementById('lista-chats');
  const tituloChat = document.getElementById('titulo-chat');
  const painelMensagens = document.getElementById('painel-mensagens');
  const formMensagem = document.getElementById('form-mensagem');
  const inputMensagem = document.getElementById('input-mensagem');
  const btnEnviar = document.getElementById('btn-enviar');
  const alertaConexao = document.getElementById('alerta-conexao');
  const btnSair = document.getElementById('btn-sair');

  nomeUsuarioLogado.textContent = username;

  // Estado da aplicação
  let meuId = null;
  let chatAtual = 'global';
  let usuarios = [];
  let notificacoes = {};
  let conversas = carregarConversas();
  let socket = null;
  let conectado = false;

  function carregarConversas() {
    try {
      return JSON.parse(localStorage.getItem(`conversas:${username}`)) || {};
    } catch {
      return {};
    }
  }

  function salvarConversas() {
    try {
      localStorage.setItem(`conversas:${username}`, JSON.stringify(conversas));
    } catch (err) {
      console.error('Erro ao salvar conversas no localStorage:', err);
    }
  }

  function idPrivado(outroId) {
    return [meuId, outroId].sort((a, b) => Number(a) - Number(b)).join('-');
  }

  function nomePorId(id) {
    if (id === meuId) return username;
    const usuario = usuarios.find(u => u.id === id);
    return usuario ? usuario.username : 'Desconhecido';
  }

  function tocarAudioNotificacao() {
    new Audio('/audio/notificacao.mp3').play().catch(() => {});
  }

  function atualizarEstadoConexao(estaConectado) {
    conectado = estaConectado;
    alertaConexao.style.display = estaConectado ? 'none' : 'block';
    btnEnviar.disabled = !estaConectado;
  }

  // 2. Renderização da barra lateral de conversas
  function renderSidebar() {
    listaChats.innerHTML = '';

    // Item: Chat Global
    const liGlobal = document.createElement('li');
    const btnGlobal = document.createElement('button');
    btnGlobal.type = 'button';
    btnGlobal.className = `chat-item ${chatAtual === 'global' ? 'ativo' : ''}`;
    btnGlobal.addEventListener('click', () => selecionarChat('global'));

    const avatarGlobal = document.createElement('span');
    avatarGlobal.className = 'avatar';
    avatarGlobal.textContent = 'G';

    const labelGlobal = document.createElement('span');
    labelGlobal.className = 'chat-label';
    const strongGlobal = document.createElement('strong');
    strongGlobal.textContent = 'Chat Global';
    const smallGlobal = document.createElement('small');
    smallGlobal.className = 'text-secondary';
    smallGlobal.textContent = 'Converse com todos';
    labelGlobal.appendChild(strongGlobal);
    labelGlobal.appendChild(smallGlobal);

    btnGlobal.appendChild(avatarGlobal);
    btnGlobal.appendChild(labelGlobal);

    const totalGlobal = notificacoes['global'] || 0;
    if (totalGlobal > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge bg-danger';
      badge.textContent = totalGlobal;
      btnGlobal.appendChild(badge);
    }

    liGlobal.appendChild(btnGlobal);
    listaChats.appendChild(liGlobal);

    // Lista de usuários ordenada (online primeiro, depois por nome)
    const usuariosOrdenados = [...usuarios].sort((a, b) => {
      if (b.online !== a.online) return Number(b.online) - Number(a.online);
      return a.username.localeCompare(b.username);
    });

    usuariosOrdenados.forEach((user) => {
      const chatId = idPrivado(user.id);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chat-item ${chatAtual === chatId ? 'ativo' : ''}`;
      btn.addEventListener('click', () => selecionarChat(chatId));

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = user.username.charAt(0).toUpperCase();

      const label = document.createElement('span');
      label.className = 'chat-label';

      const strong = document.createElement('strong');
      strong.textContent = user.username;

      const small = document.createElement('small');
      small.className = user.online ? 'text-success' : 'text-secondary';
      small.textContent = user.online ? 'Online' : 'Offline';

      label.appendChild(strong);
      label.appendChild(small);

      btn.appendChild(avatar);
      btn.appendChild(label);

      const totalNotif = notificacoes[chatId] || 0;
      if (totalNotif > 0) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-danger';
        badge.textContent = totalNotif;
        btn.appendChild(badge);
      }

      li.appendChild(btn);
      listaChats.appendChild(li);
    });
  }

  // 3. Seleção de conversa
  function selecionarChat(chatId) {
    chatAtual = chatId;
    notificacoes[chatId] = 0;

    if (chatId === 'global') {
      tituloChat.textContent = 'Chat Global';
    } else {
      const outroUsuario = usuarios.find(u => idPrivado(u.id) === chatId);
      tituloChat.textContent = outroUsuario ? `Conversa com ${outroUsuario.username}` : 'Conversa Privada';
    }

    renderSidebar();
    renderMensagens();
    inputMensagem.focus();
  }

  // 4. Renderização do painel de mensagens
  function renderMensagens() {
    painelMensagens.innerHTML = '';
    const msgs = conversas[chatAtual] || [];

    if (msgs.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'text-center text-secondary py-5 small';
      vazio.textContent = 'Nenhuma mensagem ainda. Inicie a conversa!';
      painelMensagens.appendChild(vazio);
      return;
    }

    msgs.forEach((msg) => {
      const ehMinha = msg.remetenteId === meuId;

      const linha = document.createElement('div');
      linha.className = `d-flex mb-2 ${ehMinha ? 'justify-content-end' : 'justify-content-start'}`;

      const balao = document.createElement('div');
      balao.className = `balao ${ehMinha ? 'minha' : ''}`;

      const remetente = document.createElement('strong');
      remetente.textContent = `${nomePorId(msg.remetenteId)}: `;

      const texto = document.createTextNode(msg.conteudo);

      const hora = document.createElement('div');
      hora.className = 'text-end opacity-75 small mt-1';
      hora.textContent = msg.timestamp || '';

      balao.appendChild(remetente);
      balao.appendChild(texto);
      balao.appendChild(hora);

      linha.appendChild(balao);
      painelMensagens.appendChild(linha);
    });

    // Rola para o final da conversa
    painelMensagens.scrollTop = painelMensagens.scrollHeight;
  }

  // 5. Conexão WebSocket
  function conectar() {
    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocolo}//${window.location.host}/ws`);

    socket.onopen = () => {
      atualizarEstadoConexao(true);
      socket.send(JSON.stringify({ type: 'register', username }));
    };

    socket.onclose = (evento) => {
      atualizarEstadoConexao(false);
      if (evento.code === 1008) {
        Contas.sair();
        window.location.replace('/login.html');
      }
    };

    socket.onerror = () => {
      atualizarEstadoConexao(false);
    };

    socket.onmessage = (evento) => {
      let dados;
      try {
        dados = JSON.parse(evento.data);
      } catch {
        return;
      }

      switch (dados.type) {
        case 'online_list':
          meuId = dados.id;
          usuarios = dados.users || [];
          conversas = carregarConversas();
          renderSidebar();
          renderMensagens();
          break;

        case 'historico': {
          const novasConversas = carregarConversas();
          for (const msg of (dados.mensagens || [])) {
            if (!novasConversas[msg.chatId]) novasConversas[msg.chatId] = [];
            if (!novasConversas[msg.chatId].some(m => m.id === msg.id)) {
              novasConversas[msg.chatId].push(msg);
            }
          }
          conversas = novasConversas;
          salvarConversas();
          renderMensagens();
          break;
        }

        case 'user_online':
          if (dados.username !== username) {
            const index = usuarios.findIndex(u => u.id === dados.id);
            if (index >= 0) {
              usuarios[index].online = true;
            } else {
              usuarios.push({ id: dados.id, username: dados.username, online: true });
            }
            renderSidebar();
          }
          break;

        case 'user_offline': {
          const usuario = usuarios.find(u => u.username === dados.username);
          if (usuario) {
            usuario.online = false;
            renderSidebar();
          }
          break;
        }

        default: {
          // Nova mensagem de chat recebida
          const chatId = dados.chatId;
          if (!chatId) return;

          if (!conversas[chatId]) conversas[chatId] = [];

          // Evita mensagens duplicadas
          if (conversas[chatId].some(m => m.id === dados.id)) return;

          conversas[chatId].push(dados);
          salvarConversas();

          if (chatId === chatAtual) {
            renderMensagens();
          } else if (dados.remetenteId !== meuId) {
            notificacoes[chatId] = (notificacoes[chatId] || 0) + 1;
            renderSidebar();
            tocarAudioNotificacao();
          }
          break;
        }
      }
    };
  }

  // 6. Envio de mensagem
  formMensagem.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = inputMensagem.value.trim();
    if (!texto || !conectado || !socket || socket.readyState !== WebSocket.OPEN) return;

    let destinatario = null;
    if (chatAtual !== 'global') {
      const usuarioDestino = usuarios.find(u => idPrivado(u.id) === chatAtual);
      if (!usuarioDestino) return;
      destinatario = usuarioDestino.username;
    }

    socket.send(JSON.stringify({
      content: texto,
      to: destinatario
    }));

    inputMensagem.value = '';
    inputMensagem.focus();
  });

  // 7. Botão Sair
  btnSair.addEventListener('click', () => {
    Contas.sair();
    if (socket) socket.close();
    window.location.replace('/login.html');
  });

  // Inicializa a interface e conecta
  renderSidebar();
  renderMensagens();
  conectar();
});

