export interface Conta {
  username: string;
  senha: string;
}

export function carregarContas(): Conta[] {
  const texto = localStorage.getItem('contasChat');
  if (texto === null) return [];
  const contas = JSON.parse(texto);
  if (!Array.isArray(contas)) throw new Error('Cadastro inválido.');
  return contas;
}

export function cadastrar(nome: string, senha: string): string {
  const username = nome.trim();
  if (username.length < 3 || username.length > 40) {
    return 'Digite um nome de 3 a 40 caracteres.';
  }
  if (senha.length < 8 || senha.length > 128) {
    return 'Digite uma senha de 8 a 128 caracteres.';
  }

  const contas = carregarContas();
  for (const conta of contas) {
    if (conta.username.toLowerCase() === username.toLowerCase()) {
      return 'Esse nome já está cadastrado neste navegador.';
    }
  }

  contas.push({ username: username, senha: senha });
  localStorage.setItem('contasChat', JSON.stringify(contas));
  return '';
}

export function entrar(nome: string, senha: string): string {
  const contas = carregarContas();
  for (const conta of contas) {
    if (conta.username.toLowerCase() === nome.trim().toLowerCase() && conta.senha === senha) {
      localStorage.setItem('usuarioLogadoChat', conta.username);
      return '';
    }
  }
  return 'Nome ou senha incorretos.';
}

export function usuarioLogado(): string | null {
  const nome = localStorage.getItem('usuarioLogadoChat');
  const contas = carregarContas();
  for (const conta of contas) {
    if (conta.username === nome) return nome;
  }
  return null;
}

export function sair(): void {
  localStorage.removeItem('usuarioLogadoChat');
}
