document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificação de sessão
  const username = new Contas().usuarioLogado();
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
  let chatAtual = null;
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
    btnEnviar.disabled = !estaConectado || !chatAtual;
    inputMensagem.disabled = !estaConectado || !chatAtual;
  }

  // 2. Renderização da barra lateral de conversas
  function renderSidebar() {
    renderPessoas();
    listaChats.innerHTML = '';

    const contatos = new Contas().contatos();
    if (chatAtual && !usuarios.some(u => contatos.includes(u.id) && idPrivado(u.id) === chatAtual)) {
      delete notificacoes[chatAtual];
      chatAtual = null;
      tituloChat.textContent = 'Selecione um contato';
      inputMensagem.value = '';
      atualizarEstadoConexao(conectado);
      renderMensagens();
    }
    if (!contatos.length) {
      const vazio = document.createElement('li');
      vazio.className = 'small text-secondary';
      vazio.textContent = 'Nenhum contato. Use Adicionar pessoas para começar.';
      listaChats.appendChild(vazio);
    }

    // Lista de usuários ordenada (online primeiro, depois por nome)
    const usuariosOrdenados = usuarios.filter(u => contatos.includes(u.id)).sort((a, b) => {
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

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'btn-remover-contato';
      const iconeLixeira = document.createElement('span');
      iconeLixeira.className = 'icone-lixeira';
      iconeLixeira.textContent = 'delete';
      iconeLixeira.setAttribute('aria-hidden', 'true');
      remover.appendChild(iconeLixeira);
      remover.title = `Remover ${user.username} dos contatos`;
      remover.setAttribute('aria-label', `Remover ${user.username} dos contatos`);
      remover.addEventListener('click', () => {
        const erro = new Contas().removerContato(user.id);
        const mensagemErro = document.getElementById('msg-erro');
        mensagemErro.textContent = erro;
        mensagemErro.style.display = erro ? 'block' : 'none';
        if (erro) return;
        delete notificacoes[chatId];
        renderSidebar();
        document.getElementById('btn-adicionar-pessoas').focus();
      });
      li.className = 'contato-item';
      li.appendChild(btn);
      li.appendChild(remover);
      listaChats.appendChild(li);
    });
  }

  // 3. Seleção de conversa
  function selecionarChat(chatId) {
    if (!usuarios.some(u => idPrivado(u.id) === chatId && new Contas().contatos().includes(u.id))) return;
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
    atualizarEstadoConexao(conectado);
    inputMensagem.focus();
  }

  // 4. Renderização do painel de mensagens
  function renderMensagens() {
    painelMensagens.innerHTML = '';
    const msgs = conversas[chatAtual] || [];

    if (msgs.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'text-center text-secondary py-5 small';
      vazio.textContent = chatAtual ? 'Nenhuma mensagem ainda. Inicie a conversa!' : 'Adicione uma pessoa ou selecione um contato para conversar.';
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
      atualizarEstadoConexao(false);
      socket.send(JSON.stringify({ type: 'register', username }));
    };

    socket.onclose = (evento) => {
      atualizarEstadoConexao(false);
      if (evento.code === 1008) {
        new Contas().sair();
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
          try {
            new Contas().sincronizarId(meuId);
          } catch {
            document.getElementById('msg-erro').textContent = 'Não foi possível atualizar a conta neste navegador.';
            document.getElementById('msg-erro').style.display = 'block';
          }
          atualizarEstadoConexao(true);
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

        case 'user_available':
        case 'user_online':
          if (dados.username !== username) {
            const index = usuarios.findIndex(u => u.id === dados.id);
            if (index >= 0) {
              usuarios[index].online = dados.type === 'user_online';
            } else {
              usuarios.push({ id: dados.id, username: dados.username, online: dados.type === 'user_online' });
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
          if (!chatId || chatId === 'global') return;

          if (!conversas[chatId]) conversas[chatId] = [];

          // Evita mensagens duplicadas
          if (conversas[chatId].some(m => m.id === dados.id)) return;

          conversas[chatId].push(dados);
          salvarConversas();

          if (chatId === chatAtual) {
            renderMensagens();
          } else if (dados.remetenteId !== meuId && new Contas().contatos().includes(dados.remetenteId)) {
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
    if (!chatAtual || !texto || !conectado || !socket || socket.readyState !== WebSocket.OPEN) return;

    let destinatario = null;
    if (chatAtual !== 'global') {
      const usuarioDestino = usuarios.find(u => idPrivado(u.id) === chatAtual);
      if (!usuarioDestino || !new Contas().contatos().includes(usuarioDestino.id)) return;
      destinatario = usuarioDestino.username;
    }

    socket.send(JSON.stringify({
      content: texto,
      to: destinatario
    }));

    inputMensagem.value = '';
    inputMensagem.focus();
  });

  // Diretório de pessoas, independente do status online.
  const dialogPessoas = document.getElementById('dialog-pessoas');
  const buscaPessoas = document.getElementById('busca-pessoas');
  const resultadoPessoas = document.getElementById('resultado-pessoas');
  const statusContato = document.getElementById('status-contato');
  document.getElementById('btn-adicionar-pessoas').addEventListener('click', () => {
    buscaPessoas.value = '';
    statusContato.textContent = '';
    renderPessoas();
    dialogPessoas.showModal();
    buscaPessoas.focus();
  });
  document.getElementById('btn-fechar-pessoas').addEventListener('click', () => dialogPessoas.close());
  buscaPessoas.addEventListener('input', renderPessoas);
  window.addEventListener('storage', evento => {
    if (evento.key === 'contasChat') renderSidebar();
  });

  function renderPessoas() {
    resultadoPessoas.replaceChildren();
    const termo = buscaPessoas.value.trim().toLocaleLowerCase('pt-BR');
    const contatos = new Contas().contatos();
    const pessoas = usuarios.filter(u => u.id !== meuId && !contatos.includes(u.id) &&
      (u.username.toLocaleLowerCase('pt-BR').includes(termo) || String(u.id) === termo))
      .sort((a, b) => a.username.localeCompare(b.username));
    for (const pessoa of pessoas) {
      const item = document.createElement('li');
      item.className = 'pessoa-item';
      const nome = document.createElement('span');
      nome.textContent = pessoa.username + ' · ID ' + pessoa.id + ' · ' + (pessoa.online ? 'Online' : 'Offline');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn-primary';
      botao.textContent = 'Adicionar';
      botao.setAttribute('aria-label', 'Adicionar ' + pessoa.username);
      botao.addEventListener('click', () => {
        const erro = new Contas().adicionarContato(pessoa.id, usuarios);
        statusContato.textContent = erro || pessoa.username + ' adicionado aos contatos.';
        renderSidebar();
      });
      item.append(nome, botao);
      resultadoPessoas.appendChild(item);
    }
    if (!pessoas.length) {
      const vazio = document.createElement('li');
      vazio.textContent = conectado ? 'Nenhuma pessoa disponível para adicionar.' : 'Conectando ao diretório de pessoas…';
      resultadoPessoas.appendChild(vazio);
    }
  }

  // 7. Botão Sair
  btnSair.addEventListener('click', () => {
    new Contas().sair();
    if (socket) socket.close();
    window.location.replace('/login.html');
  });

  atualizarEstadoConexao(false);
  // Inicializa a interface e conecta
  renderSidebar();
  renderMensagens();
  try {
    await new Contas().migrarContasAntigas();
  } catch {
    document.getElementById('msg-erro').textContent = 'Não foi possível atualizar o diretório das contas antigas. Recarregue a página para tentar novamente.';
    document.getElementById('msg-erro').style.display = 'block';
  }
  conectar();
});

