document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-cadastro');
  const inputNome = document.getElementById('username');
  const inputSenha = document.getElementById('senha');
  const msgErro = document.getElementById('msg-erro');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msgErro.style.display = 'none';
    msgErro.textContent = '';

    const erro = new Contas().cadastrar(inputNome.value, inputSenha.value);
    if (erro) {
      msgErro.textContent = erro;
      msgErro.style.display = 'block';
      return;
    }

    // Sucesso no cadastro, redireciona para a tela de login
    window.location.assign('/login.html?cadastro=ok');
  });
});

