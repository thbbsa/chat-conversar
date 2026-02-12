import React, { useEffect, useState, useRef } from 'react';
import './css/chatPage.css';

export default function ChatPage() {
    const username = localStorage.getItem('username');
    const [mensagem, setMensagem] = useState('');
    const [conversas, setConversas] = useState({});
    const [chatAtualId, setChatAtualId] = useState('global');
    const [usuariosOnline, setUsuariosOnline] = useState([]);
    const [notificacoes, setNotificacoes] = useState({});
    const ws = useRef(null);

    const chatAtualIdRef = useRef(chatAtualId);

    useEffect(() => {
        chatAtualIdRef.current = chatAtualId;
    }, [chatAtualId]);


    const gerarIdChat = (userA, userB) => {
        return [userA, userB].sort().join('-');
    };

    const audioNotificacao = () => {
        const audio = new Audio('/audio/notificacao.mp3');
        audio.play().catch(err => console.error('Erro ao tocar áudio de notificação:', err));
    }

    useEffect(() => {
        ws.current = new WebSocket('ws://localhost:8080');

        ws.current.onopen = () => {
            ws.current.send(JSON.stringify({
                type: 'register',
                username: username
            }));
        };

        ws.current.onmessage = (event) => {
            const dados = JSON.parse(event.data);

            if (dados.type === 'online_list') {
                setUsuariosOnline(dados.users.filter(u => u !== username));
                return;
            }

            if (dados.type === 'user_online') {
                if (dados.username !== username) {
                    setUsuariosOnline(prev => [...new Set([...prev, dados.username])]);
                }
                return;
            }

            if (dados.type === 'user_offline') {
                setUsuariosOnline(prev => prev.filter(u => u !== dados.username));
                return;
            }

            const { chatId } = dados;

            setConversas(prev => ({
                ...prev,
                [chatId]: [...(prev[chatId] || []), dados]
            }));

            // Se a mensagem for do chat atual, não notifica
            if (chatId === chatAtualIdRef.current) {
                return
            } else if (dados.sender !== username) {
                setNotificacoes(prev => {
                    const novo = { ...prev };
                    novo[chatId] = (novo[chatId] || 0) + 1;
                    return novo;
                });
                audioNotificacao();
            }
        };

        ws.current.onclose = () => console.log('Desconectado do servidor WebSocket');
        ws.current.onerror = (error) => console.error('Erro no WebSocket:', error);

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const handleEnviarMensagem = (e) => {
        e.preventDefault();
        if (mensagem.trim() === '' || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

        const chatId = chatAtualId;
        const destinatario = chatId === 'global' ? null : chatId.replace(username, '').replace('-', '');

        const novaMensagem = {
            sender: username,
            content: mensagem,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            chatId,
            to: destinatario
        };

        ws.current.send(JSON.stringify(novaMensagem));
        setMensagem('');
    };

    return (
        <div className="d-flex vh-100 bg-black text-light">
            {/* Barra lateral */}
            <div className="d-flex flex-column w-25 h-100 p-4 bg-dark border-end">
                <div className='d-flex justify-content-between align-items-center mb-4'>
                    <h2 className="text-start mb-4 text-light">Chat</h2>
                </div>
                <ul className="list-unstyled">
                    {/* Chat global fixo */}
                    <li
                        onClick={() => setChatAtualId('global')}
                        className={`chat-item d-flex align-items-center p-3 rounded bg-secondary bg-opacity-25 mb-3 ${chatAtualId === 'global' ? 'bg-opacity-50' : ''}`}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="avatar rounded-circle me-3 text-center bg-light text-dark fw-bold" style={{ width: 45, height: 45, lineHeight: '45px' }}>
                            G
                        </div>
                        <div className="flex-grow-1">
                            <div className="fw-semibold">Chat Global</div>
                            <small className="text-muted">Converse com todos</small>
                        </div>
                    </li>

                    {/* Chats privados */}
                    {usuariosOnline.map((usuario, index) => {
                        const chatIdPrivado = gerarIdChat(username, usuario);
                        const notificacao = notificacoes[chatIdPrivado] || 0;

                        return (
                            <li
                                onClick={() => {
                                    setChatAtualId(chatIdPrivado);
                                    setNotificacoes(prev => {
                                        const novo = { ...prev };
                                        delete novo[chatIdPrivado];
                                        return novo;
                                    });
                                }}
                                key={index}
                                className={`chat-item d-flex align-items-center p-3 rounded bg-secondary bg-opacity-25 mb-3 ${chatAtualId === chatIdPrivado ? 'bg-opacity-50' : ''}`}
                                style={{ cursor: 'pointer' }}
                            >
                                <div
                                    className="avatar rounded-circle me-3 text-center bg-light text-dark fw-bold"
                                    style={{ width: 45, height: 45, lineHeight: '45px' }}
                                >
                                    {usuario.charAt(0).toUpperCase()}
                                </div>

                                <div className="flex-grow-1 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="fw-semibold">{usuario}</div>
                                        <small className="text-muted">Conversa privada</small>
                                    </div>

                                    {notificacao > 0 && (
                                        <span className="badge bg-danger ms-2">{notificacao}</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Área de mensagens */}
            <div className="d-flex flex-column w-75 h-100 p-4 bg-dark">
                <h4 className="text-center mb-4 text-light">Mensagens</h4>

                <div className="flex-grow-1 overflow-auto mb-3 px-2">
                    {(conversas[chatAtualId] || []).map((msg, index) => (
                        <div
                            key={index}
                            className={`d-flex ${msg.sender === username ? 'justify-content-end' : 'justify-content-start'} mb-2`}
                        >
                            <div
                                style={{
                                    backgroundColor: msg.sender === username ? '#007bff' : '#2a2a40',
                                    color: 'white',
                                    borderRadius: '10px',
                                    padding: '10px 14px',
                                    maxWidth: '75%',
                                    wordBreak: 'break-word'
                                }}
                            >
                                <strong>{msg.sender}:</strong> {msg.content}
                                <div className="text-end text-light opacity-50 small mt-1">{msg.timestamp}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Campo de envio */}
                <form className="d-flex mt-auto" onSubmit={handleEnviarMensagem}>
                    <input
                        type="text"
                        className="form-control me-2 bg-secondary text-light border-0 rounded-pill px-4"
                        placeholder="Digite sua mensagem..."
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                    />
                    <button className="btn btn-primary px-4 rounded-pill">Enviar</button>
                </form>
            </div>
        </div>
    );
}
