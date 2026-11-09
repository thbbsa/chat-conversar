const username = localStorage.getItem('username');

if (!username) {
    // Sem nome salvo, volta para o login
    window.location.href = 'index.html';
}

// ---------- Estado ----------
let conversas = {};            // { chatId: [mensagens] }
let chatAtualId = 'global';
let usuarios = {};             // { nome: true/false }  (true = online)
let notificacoes = {};         // { chatId: quantidade }
let ws = null;

// ---------- Elementos ----------
const listaChats = document.getElementById('lista-chats');
const areaMensagens = document.getElementById('mensagens');
const formEnvio = document.getElementById('form-envio');
const inputMensagem = document.getElementById('input-mensagem');

// ---------- Utilitários ----------
function gerarIdChat(userA, userB) {
    return [userA, userB].sort().join('-');
}

function audioNotificacao() {
    const audio = new Audio('/audio/notificacao.mp3');
    audio.play().catch((err) => console.error('Erro ao tocar áudio de notificação:', err));
}

// Cria um elemento com classes e texto de forma segura (sem innerHTML)
function criarEl(tag, classes = '', texto = '') {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (texto) el.textContent = texto;
    return el;
}

// ---------- Renderização ----------
function criarItemChat({ inicial, titulo, subtitulo, online, ativo, notificacao, onClick }) {
    const li = criarEl(
        'li',
        `chat-item d-flex align-items-center p-3 rounded bg-secondary bg-opacity-25 mb-3 ${ativo ? 'bg-opacity-50' : ''}`
    );
    li.style.cursor = 'pointer';
    li.addEventListener('click', onClick);

    const avatar = criarEl('div', 'avatar position-relative rounded-circle me-3 text-center bg-light text-dark fw-bold', inicial);
    avatar.style.width = '45px';
    avatar.style.height = '45px';
    avatar.style.lineHeight = '45px';

    // Bolinha de status (o chat global não passa "online", então fica sem)
    if (online !== undefined) {
        const bolinha = criarEl(
            'span',
            `position-absolute bottom-0 end-0 rounded-circle border border-dark ${online ? 'bg-success' : 'bg-secondary'}`
        );
        bolinha.style.width = '12px';
        bolinha.style.height = '12px';
        avatar.appendChild(bolinha);
    }

    const conteudo = criarEl('div', 'flex-grow-1 d-flex justify-content-between align-items-center');
    const textos = criarEl('div');
    textos.appendChild(criarEl('div', 'fw-semibold', titulo));
    textos.appendChild(criarEl('small', 'text-muted', subtitulo));
    conteudo.appendChild(textos);

    if (notificacao > 0) {
        conteudo.appendChild(criarEl('span', 'badge bg-danger ms-2', String(notificacao)));
    }

    li.appendChild(avatar);
    li.appendChild(conteudo);
    return li;
}

function renderSidebar() {
    listaChats.innerHTML = '';

    // Chat global fixo
    listaChats.appendChild(
        criarItemChat({
            inicial: 'G',
            titulo: 'Chat Global',
            subtitulo: 'Converse com todos',
            ativo: chatAtualId === 'global',
            notificacao: notificacoes['global'] || 0,
            onClick: () => {
                chatAtualId = 'global';
                renderSidebar();
                renderMensagens();
            }
        })
    );

    // Chats privados (online primeiro)
    Object.entries(usuarios)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .forEach(([usuario, online]) => {
            const chatIdPrivado = gerarIdChat(username, usuario);

            listaChats.appendChild(
                criarItemChat({
                    inicial: usuario.charAt(0).toUpperCase(),
                    titulo: usuario,
                    subtitulo: online ? 'Online' : 'Offline',
                    online,
                    ativo: chatAtualId === chatIdPrivado,
                    notificacao: notificacoes[chatIdPrivado] || 0,
                    onClick: () => {
                        chatAtualId = chatIdPrivado;
                        delete notificacoes[chatIdPrivado];
                        renderSidebar();
                        renderMensagens();
                    }
                })
            );
        });
}

function renderMensagens() {
    areaMensagens.innerHTML = '';

    (conversas[chatAtualId] || []).forEach((msg) => {
        const minha = msg.sender === username;

        const linha = criarEl('div', `d-flex ${minha ? 'justify-content-end' : 'justify-content-start'} mb-2`);

        const balao = criarEl('div');
        balao.style.backgroundColor = minha ? '#007bff' : '#2a2a40';
        balao.style.color = 'white';
        balao.style.borderRadius = '10px';
        balao.style.padding = '10px 14px';
        balao.style.maxWidth = '75%';
        balao.style.wordBreak = 'break-word';

        balao.appendChild(criarEl('strong', '', `${msg.sender}:`));
        balao.appendChild(document.createTextNode(` ${msg.content}`));
        balao.appendChild(criarEl('div', 'text-end text-light opacity-50 small mt-1', msg.timestamp));

        linha.appendChild(balao);
        areaMensagens.appendChild(linha);
    });

    // Rola para a última mensagem
    areaMensagens.scrollTop = areaMensagens.scrollHeight;
}

// ---------- WebSocket ----------
function conectar() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', username }));
    };

    ws.onmessage = (event) => {
        const dados = JSON.parse(event.data);

        // Lista inicial: todos os usuários conhecidos, com o status de cada um
        if (dados.type === 'online_list') {
            usuarios = {};
            dados.users.forEach((u) => (usuarios[u.username] = u.online));
            renderSidebar();
            return;
        }

        if (dados.type === 'user_online') {
            if (dados.username !== username) {
                usuarios[dados.username] = true;
                renderSidebar();
            }
            return;
        }

        if (dados.type === 'user_offline') {
            usuarios[dados.username] = false;   // continua na lista, só muda o status
            renderSidebar();
            return;
        }

        const { chatId } = dados;

        if (!conversas[chatId]) conversas[chatId] = [];
        conversas[chatId].push(dados);

        if (chatId === chatAtualId) {
            // Mensagem do chat aberto: só atualiza a tela, sem notificar
            renderMensagens();
        } else if (dados.sender !== username) {
            notificacoes[chatId] = (notificacoes[chatId] || 0) + 1;
            renderSidebar();
            audioNotificacao();
        }
    };

    ws.onclose = () => console.log('Desconectado do servidor WebSocket');
    ws.onerror = (error) => console.error('Erro no WebSocket:', error);
}

// ---------- Envio ----------
formEnvio.addEventListener('submit', (e) => {
    e.preventDefault();

    const texto = inputMensagem.value;
    if (texto.trim() === '' || !ws || ws.readyState !== WebSocket.OPEN) return;

    const chatId = chatAtualId;
    const destinatario = chatId === 'global' ? null : chatId.replace(username, '').replace('-', '');

    const novaMensagem = {
        sender: username,
        content: texto,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chatId,
        to: destinatario
    };

    ws.send(JSON.stringify(novaMensagem));
    inputMensagem.value = '';
});

// Fecha a conexão ao sair da página
window.addEventListener('beforeunload', () => {
    if (ws) ws.close();
});

// ---------- Início ----------
renderSidebar();
renderMensagens();
conectar();