document.addEventListener('DOMContentLoaded', () => {
    gerarRelatorio();
});

function gerarRelatorio() {
    // 1. Busca o usuário conectado no LocalStorage (testa usuarioLogadoChat e username)
    const usuarioLogado = localStorage.getItem('usuarioLogadoChat') || localStorage.getItem('username') || 'Nenhum usuário';
    document.getElementById('relatorio-usuario').innerText = usuarioLogado;

    // 2. Calcula quantidade de USUÁRIOS CADASTRADOS lendo a chave contasChat
    try {
        const contas = JSON.parse(localStorage.getItem('contasChat')) || [];
        document.getElementById('relatorio-qtd-usuarios').innerText = Array.isArray(contas) ? contas.length : 0;
    } catch (e) {
        document.getElementById('relatorio-qtd-usuarios').innerText = 0;
    }

    // 3. Calcula quantidade TOTAL DE MENSAGENS salvas nas conversas
    let totalMensagens = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (chave.startsWith('conversas:')) {
            try {
                const dados = JSON.parse(localStorage.getItem(chave));
                if (typeof dados === 'object' && dados !== null) {
                    Object.values(dados).forEach(arr => {
                        if (Array.isArray(arr)) totalMensagens += arr.length;
                    });
                }
            } catch (e) {}
        }
    }
    document.getElementById('relatorio-qtd-mensagens').innerText = totalMensagens;

    // 4. Calcula o tamanho em KB ocupado no LocalStorage
    let totalBytes = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalBytes += (localStorage[key].length + key.length) * 2;
        }
    }
    document.getElementById('relatorio-tamanho').innerText = (totalBytes / 1024).toFixed(2) + ' KB';

    // 5. Preenche a tabela do relatório via manipulação da árvore DOM
    const tabelaBody = document.getElementById('tabela-localStorage');
    if (!tabelaBody) return;

    tabelaBody.innerHTML = '';

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${key}</td>
            <td>${value.length > 90 ? value.substring(0, 90) + '...' : value}</td>
        `;
        tabelaBody.appendChild(tr);
    }
}

// 6. Função de remoção dos dados (Exigência do LocalStorage)
function limparTudo() {
    if (confirm('Deseja realmente apagar todos os dados armazenados no LocalStorage?')) {
        localStorage.clear();
        alert('Dados removidos com sucesso!');
        window.location.href = 'login.html';
    }
}

function fazerLogoutELogin(event) {
    event.preventDefault();
    // Remove as chaves do usuário logado para permitir novo login
    localStorage.removeItem('usuarioLogadoChat');
    localStorage.removeItem('username');
    // Redireciona para a página de login
    window.location.href = 'login.html';
}