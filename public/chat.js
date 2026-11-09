const username = localStorage.getItem('username');

if (!username) {
    // Sem nome salvo, volta para o login
    window.location.href = 'index.html';
}

// ---------- Cache no localStorage ----------
const CHAVE_CONVERSAS = `conversas:${username}`;
const CHAVE_ID = `userId:${username}`;

function carregarConversas() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_CONVERSAS)) || {};
    } catch {
        return {};
    }
}

function salvarConversas() {
    try {
        localStorage.setItem(CHAVE_CONVERSAS, JSON.stringify(conversas));
    } catch (err) {
        console.error('Erro ao salvar conversas:', err);
    }
}

// ---------- Estado ----------
let conversas = carregarConversas();   // { chatId: [mensagens] }
let chatAtualId = 'global';
let usuarios = {};                     // { nome: { id, online } }
let notificacoes = {};                 // { chatId: quantidade }
let ws = null;

let myUserId = Number(localStorage.getItem(CHAVE_ID)) || null;

// ---------- Elementos ----------
const listaChats = document.getElementById('lista-chats');
const areaMensagens = document.getElementById('mensagens');
const formEnvio = document.getElementById('form-envio');
const inputMensagem = document.getElementById('input-mensagem');

// ---------- Utilitários ----------
function gerarIdChat(idA, idB) {
    return [idA, idB].sort((a, b) => a - b).join('-');
}

// Descobre o nome de quem enviou a partir do id
function nomePorId(id) {
    if (id === myUserId) return username;
    return Object.keys(usuarios).find((nome) => usuarios[nome].id === id) || 'Desconhecido';
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
                delete notificacoes['global'];
                renderSidebar();
                renderMensagens();
            }
        })
    );

    // Chats privados (online primeiro)
    Object.entries(usuarios)
        .sort((a, b) => Number(b[1].online) - Number(a[1].online))
        .forEach(([usuario, dadosUsuario]) => {
            const chatIdPrivado = gerarIdChat(myUserId, dadosUsuario.id);

            listaChats.appendChild(
                criarItemChat({
                    inicial: usuario.charAt(0).toUpperCase(),
                    titulo: usuario,
                    subtitulo: dadosUsuario.online ? 'Online' : 'Offline',
                    online: dadosUsuario.online,
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
        const minha = msg.remetenteId === myUserId; // compara pelo id, não pelo nome

        const linha = criarEl('div', `d-flex ${minha ? 'justify-content-end' : 'justify-content-start'} mb-2`);

        const balao = criarEl('div');
        balao.style.backgroundColor = minha ? '#007bff' : '#2a2a40';
        balao.style.color = 'white';
        balao.style.borderRadius = '10px';
        balao.style.padding = '10px 14px';
        balao.style.maxWidth = '75%';
        balao.style.wordBreak = 'break-word';

        balao.appendChild(criarEl('strong', '', `${nomePorId(msg.remetenteId)}:`));
        balao.appendChild(document.createTextNode(` ${msg.conteudo}`));
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

        // Lista inicial: todos os usuários cadastrados, com o status de cada um
        if (dados.type === 'online_list') {
            usuarios = {};
            myUserId = dados.id;
            localStorage.setItem(CHAVE_ID, String(myUserId));

            dados.users.forEach((u) => {
                usuarios[u.username] = { id: u.id, online: u.online };
            });
            renderSidebar();
            return;
        }

        // Histórico completo vindo do servidor: substitui o que havia no cache
        if (dados.type === 'historico') {
            conversas = {};

            dados.mensagens.forEach((msg) => {
                if (!conversas[msg.chatId]) conversas[msg.chatId] = [];
                conversas[msg.chatId].push(msg);
            });

            salvarConversas();
            renderSidebar();
            renderMensagens();
            return;
        }

        if (dados.type === 'user_online') {
            if (dados.username !== username) {
                usuarios[dados.username] = { id: dados.id, online: true };
                renderSidebar();
            }
            return;
        }

        if (dados.type === 'user_offline') {
            if (usuarios[dados.username]) {
                usuarios[dados.username].online = false;
            }
            renderSidebar();
            return;
        }

        // ---------- Mensagem nova ----------
        const { chatId } = dados;

        if (!conversas[chatId]) conversas[chatId] = [];

        // Ignora se essa mensagem já foi recebida (evita duplicar)
        if (conversas[chatId].some((m) => m.id === dados.id)) return;

        conversas[chatId].push(dados);
        salvarConversas();

        if (chatId === chatAtualId) {
            // Mensagem do chat aberto: só atualiza a tela, sem notificar
            renderMensagens();
        } else if (dados.remetenteId !== myUserId) {
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

    // Descobre o nome do destinatário a partir do chat aberto
    const destinatario = chatAtualId === 'global'
        ? null
        : Object.keys(usuarios).find(
            (nome) => gerarIdChat(myUserId, usuarios[nome].id) === chatAtualId
        );

    ws.send(JSON.stringify({ content: texto, to: destinatario }));
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