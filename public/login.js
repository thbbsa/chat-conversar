const inputUsername = document.getElementById('username');
const btnEntrar = document.getElementById('btn-entrar');

function saveNameLocalStorage() {
    const trimmed = inputUsername.value.trim();
    if (trimmed === '') {
        alert('Digite um nome para continuar.');
        return;
    }
    localStorage.setItem('username', trimmed);
    window.location.href = 'chat.html';
}

btnEntrar.addEventListener('click', saveNameLocalStorage);
btnEntrar.addEventListener('mouseover', () => (btnEntrar.style.backgroundColor = '#2c2cff'));
btnEntrar.addEventListener('mouseout', () => (btnEntrar.style.backgroundColor = '#3a3aff'));

// Permite entrar apertando Enter
inputUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNameLocalStorage();
});