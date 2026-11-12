document.addEventListener('DOMContentLoaded', () => {
  // Se já estiver logado, redireciona para o chat
  const usuario = new Contas().usuarioLogado()
  if (usuario) {
    window.location.replace('/chat.html');
    return;
  }

  const form = document.getElementById('form-login');
  const inputNome = document.getElementById('username');
  const inputSenha = document.getElementById('senha');
  const msgErro = document.getElementById('msg-erro');
  const msgSucesso = document.getElementById('msg-sucesso');

  // Exibe mensagem caso venha do cadastro com sucesso
  const params = new URLSearchParams(window.location.search);
  if (params.get('cadastro') === 'ok') {
    msgSucesso.style.display = 'block';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msgErro.style.display = 'none';
    msgErro.textContent = '';

    const erro = new Contas().entrar(inputNome.value, inputSenha.value);
    if (erro) {
      msgErro.textContent = erro;
      msgErro.style.display = 'block';
      return;
    }

    // Sucesso no login, vai para o chat
    window.location.assign('/chat.html');
  });
});

