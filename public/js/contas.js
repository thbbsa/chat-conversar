// Gerenciamento de contas e sessão com localStorage
class Contas {

  constructor() {
    this.contas = this.carregarContas();
  }
  carregarContas() {
    const texto = localStorage.getItem('contasChat');

    if (texto === null) return [];
    try {
      const contas = JSON.parse(texto);
      if (!Array.isArray(contas)) return [];
      return contas.map(conta => ({ ...conta, id: conta.id ?? null,
        contatos: Array.isArray(conta.contatos) ? [...new Set(conta.contatos)] : [] }));
    } catch {
      return [];
    }
  }

  async cadastrar(nome, senha) {
    const username = (nome || '').trim();
    if (username.length < 3 || username.length > 40) {
      return 'Digite um nome de 3 a 40 caracteres.';
    }
    if (!senha || senha.length < 8 || senha.length > 128) {
      return 'Digite uma senha de 8 a 128 caracteres.';
    }

    const contas = this.contas;
    for (const conta of contas) {
      if (conta.username.toLowerCase() === username.toLowerCase()) {
        return 'Esse nome já está cadastrado neste navegador.';
      }
    }

    try {
      const id = await this.registrarNome(username);
      contas.push({ id, username, senha, contatos: [] });
      localStorage.setItem('contasChat', JSON.stringify(contas));
    } catch {
      return 'Não foi possível salvar a conta. Verifique a conexão e tente novamente.';
    }
    return '';
  }

  entrar(nome, senha) {
    const contas = this.contas;
    const nomeNormalizado = (nome || '').trim().toLowerCase();
    for (const conta of contas) {
      if (conta.username.toLowerCase() === nomeNormalizado && conta.senha === senha) {
        localStorage.setItem('usuarioLogadoChat', conta.username);
        return '';
      }
    }
    return 'Nome ou senha incorretos.';
  }

  usuarioLogado() {
    const nome = localStorage.getItem('usuarioLogadoChat');
    if (!nome) return null;
    const contas = this.contas;
    for (const conta of contas) {
      if (conta.username === nome) return nome;
    }
    return null;
  }

  async registrarNome(username) {
    const resposta = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!resposta.ok) throw new Error('Falha ao registrar usuário');
    const usuario = await resposta.json();
    return usuario.id;
  }

  async migrarContasAntigas() {
    for (const conta of this.carregarContas().filter(c => c.id === null)) {
      const id = await this.registrarNome(conta.username);
      const contas = this.carregarContas();
      const atual = contas.find(c => c.username === conta.username);
      if (atual) atual.id = id;
      localStorage.setItem('contasChat', JSON.stringify(contas));
    }
  }

  sincronizarId(id) {
    const contas = this.carregarContas();
    const conta = contas.find(c => c.username === this.usuarioLogado());
    if (!conta) return;
    conta.id = id;
    localStorage.setItem('contasChat', JSON.stringify(contas));
    this.contas = contas;
  }

  contatos() {
    return this.carregarContas().find(c => c.username === this.usuarioLogado())?.contatos || [];
  }

  adicionarContato(id, usuarios) {
    const contas = this.carregarContas();
    const conta = contas.find(c => c.username === this.usuarioLogado());
    if (!conta || !Number.isInteger(id) || !usuarios.some(u => u.id === id)) return 'Pessoa não encontrada.';
    if (id === conta.id) return 'Você não pode adicionar sua própria conta.';
    if (conta.contatos.includes(id)) return 'Essa pessoa já está nos seus contatos.';
    conta.contatos.push(id);
    try {
      localStorage.setItem('contasChat', JSON.stringify(contas));
      this.contas = contas;
      return '';
    } catch {
      return 'Não foi possível salvar o contato neste navegador.';
    }
  }

  removerContato(id) {
    const contas = this.carregarContas();
    const conta = contas.find(c => c.username === this.usuarioLogado());
    if (!conta || !conta.contatos.includes(id)) return 'Contato não encontrado.';
    conta.contatos = conta.contatos.filter(contatoId => contatoId !== id);
    try {
      localStorage.setItem('contasChat', JSON.stringify(contas));
      this.contas = contas;
      return '';
    } catch {
      return 'Não foi possível remover o contato neste navegador.';
    }
  }

  sair() {
    localStorage.removeItem('usuarioLogadoChat');
  }
};

