document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-cadastro');
  const inputNome = document.getElementById('username');
  const inputSenha = document.getElementById('senha');
  const msgErro = document.getElementById('msg-erro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgErro.style.display = 'none';
    msgErro.textContent = '';

    const botao = form.querySelector('button[type="submit"]');
    if (botao.disabled) return;
    botao.disabled = true;
    const erro = await new Contas().cadastrar(inputNome.value, inputSenha.value);
    botao.disabled = false;
    if (erro) {
      msgErro.textContent = erro;
      msgErro.style.display = 'block';
      return;
    }

    // Sucesso no cadastro, redireciona para a tela de login
    window.location.assign('/login.html?cadastro=ok');
  });
});


const senha = document.getElementById('senha');
document.getElementById('btn-olho').addEventListener('click', () => {
  senha.type = senha.type === 'password' ? 'text' : 'password';
});

senha.addEventListener('input', () => {
  const v = senha.value;
  let n = 0;
  if (v.length >= 8) n++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) n++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) n++;
  document.getElementById('forca').dataset.nivel = n;
});
