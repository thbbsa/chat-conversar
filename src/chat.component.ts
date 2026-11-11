import * as contas from './contas';
import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';

interface Usuario {
  id: number;
  username: string;
  online: boolean;
}

interface Mensagem {
  id: number;
  chatId: string;
  remetenteId: number;
  conteudo: string;
  timestamp: string;
  type?: never;
}

type Evento =
  | { type: 'online_list'; id: number; users: Usuario[] }
  | { type: 'historico'; mensagens: Mensagem[] }
  | { type: 'user_online'; id: number; username: string }
  | { type: 'user_offline'; username: string }
  | Mensagem;

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent {
  readonly username = signal<string | null>(null);
  readonly paginaChat = location.pathname === '/chat';
  readonly cadastro = location.pathname === '/cadastro';
  readonly cadastroConcluido = new URLSearchParams(location.search).has('cadastro');
  readonly conectado = signal(false);

  readonly erro = signal('');
  readonly chatAtual = signal('global');
  readonly notificacoes = signal<Record<string, number>>({});
  readonly meuId = signal<number | null>(null);
  private readonly usuarios = signal<Usuario[]>([]);
  private readonly conversas = signal<Record<string, Mensagem[]>>({});
  private readonly painel = viewChild<ElementRef<HTMLElement>>('painel');
  private socket?: WebSocket;

  readonly lista = computed(() => [...this.usuarios()]
    .sort((a, b) => Number(b.online) - Number(a.online)));
  readonly mensagens = computed(() => this.conversas()[this.chatAtual()] ?? []);

  constructor() {
    if (this.paginaChat) {
      this.carregarSessao();
      inject(DestroyRef).onDestroy(() => this.socket?.close());
    }

    afterRenderEffect(() => {
      this.mensagens();
      const painel = this.painel()?.nativeElement;
      if (painel) painel.scrollTop = painel.scrollHeight;
    });
  }

  private carregarSessao(): void {
    try {
      const nome = contas.usuarioLogado();
      if (nome === null) {
        location.replace('/login');
        return;
      }
      this.username.set(nome);
      this.conectar();
    } catch {
      this.erro.set('Não foi possível ler o cadastro salvo neste navegador.');
    }
  }

  autenticar(evento: Event, nome: string, senha: string): void {
    evento.preventDefault();
    this.erro.set('');
    try {
      let mensagem = '';
      if (this.cadastro) {
        mensagem = contas.cadastrar(nome, senha);
      } else {
        mensagem = contas.entrar(nome, senha);
      }
      if (mensagem !== '') {
        this.erro.set(mensagem);
        return;
      }
      if (this.cadastro) {
        location.assign('/login?cadastro=ok');
      } else {
        location.assign('/chat');
      }
    } catch {
      this.erro.set('Não foi possível acessar o armazenamento do navegador.');
    }
  }

  sair(): void {
    try {
      contas.sair();
      this.socket?.close();
      location.replace('/login');
    } catch {
      this.erro.set('Não foi possível sair. Tente novamente.');
    }
  }
  idPrivado(usuario: Usuario): string {
    const meuId = this.meuId();
    return [meuId, usuario.id].sort((a, b) => Number(a) - Number(b)).join('-');
  }

  selecionar(chatId: string): void {
    this.chatAtual.set(chatId);
    this.notificacoes.update(atual => ({ ...atual, [chatId]: 0 }));
  }

  nomePorId(id: number): string {
    if (id === this.meuId()) return this.username() ?? '';
    return this.usuarios().find(usuario => usuario.id === id)?.username ?? 'Desconhecido';
  }

  enviar(evento: Event, campo: HTMLInputElement): void {
    evento.preventDefault();
    const content = campo.value;
    if (!content.trim() || this.socket?.readyState !== WebSocket.OPEN || !this.conectado()) return;
    const chatId = this.chatAtual();
    const destino = this.usuarios().find(usuario => this.idPrivado(usuario) === chatId);
    if (chatId !== 'global' && !destino) return;
    this.socket.send(JSON.stringify({ content, to: destino?.username }));
    campo.value = '';
    campo.focus();
  }

  private carregarConversas(): Record<string, Mensagem[]> {
    try {
      return JSON.parse(localStorage.getItem(`conversas:${this.username()}`) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }

  private salvarConversas(conversas: Record<string, Mensagem[]>): void {
    this.conversas.set(conversas);
    try {
      localStorage.setItem(`conversas:${this.username()}`, JSON.stringify(conversas));
    } catch (erro) {
      console.error('Erro ao salvar conversas:', erro);
    }
  }

  private conectar(): void {
    const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocolo}//${location.host}/ws`);
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'register', username: this.username() }));
    socket.onclose = evento => {
      this.conectado.set(false);
      if (evento.code === 1008) location.replace('/login');
    };
    socket.onerror = () => this.conectado.set(false);
    socket.onmessage = evento => this.receber(JSON.parse(evento.data) as Evento);
  }

  private receber(evento: Evento): void {
    switch (evento.type) {
      case 'online_list':
        this.meuId.set(evento.id);
        this.usuarios.set(evento.users);
        this.conversas.set(this.carregarConversas());
        this.conectado.set(true);
        break;
      case 'historico': {
        const conversas: Record<string, Mensagem[]> = {};
        for (const mensagem of evento.mensagens) {
          (conversas[mensagem.chatId] ??= []).push(mensagem);
        }
        this.salvarConversas(conversas);
        break;
      }
      case 'user_online':
        if (evento.username !== this.username()) {
          this.usuarios.update(atuais => [
            ...atuais.filter(usuario => usuario.id !== evento.id),
            { id: evento.id, username: evento.username, online: true },
          ]);
        }
        break;
      case 'user_offline':
        this.usuarios.update(atuais => atuais.map(usuario =>
          usuario.username === evento.username ? { ...usuario, online: false } : usuario));
        break;
      default: {
        const { chatId } = evento;
        const conversas = this.conversas();
        const anteriores = conversas[chatId] ?? [];
        if (anteriores.some(mensagem => mensagem.id === evento.id)) return;
        this.salvarConversas({ ...conversas, [chatId]: [...anteriores, evento] });
        if (chatId !== this.chatAtual() && evento.remetenteId !== this.meuId()) {
          this.notificacoes.update(atuais => ({ ...atuais, [chatId]: (atuais[chatId] ?? 0) + 1 }));
          new Audio('/audio/notificacao.mp3').play().catch(() => {});
        }
      }
    }
  }
}

