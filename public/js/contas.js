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
      return contas;
    } catch {
      return [];
    }
  }

  cadastrar(nome, senha) {
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

    contas.push({ username, senha });
    localStorage.setItem('contasChat', JSON.stringify(contas));
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

  sair() {
    localStorage.removeItem('usuarioLogadoChat');
  }
};

