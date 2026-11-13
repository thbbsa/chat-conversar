# Chat Conversar

Chat em tempo real com **HTML5**, **CSS3**, **JavaScript puro (Vanilla JS)**, **Bootstrap**, **Node.js** e **WebSocket** para exercício acadêmico (Programação Web).

## Como Executar

1. Instale as dependências (se ainda não tiver instalado):
   ```bash
   npm install
   ```

2. Inicie o servidor:
   ```bash
   npm start
   ```
   *(ou diretamente `node server.js`)*

3. Acesse no navegador:
   [http://localhost:8080/](http://localhost:8080/)

---

## Estrutura do Projeto

- **`server.js`**: Servidor HTTP (Express) e WebSocket (porta 8080) com persistência de mensagens e controle de usuários online.
- **`banco.js` / `dados-demo.json`**: Leitura e gravação das mensagens e usuários salvos no backend.
- **`public/`**: Frontend em HTML5, CSS e JavaScript puro (sem necessidade de build ou compilação):
  - `login.html` (e `index.html`): Tela de login.
  - `cadastro.html`: Tela de criação de conta com validação de campos.
  - `chat.html`: Interface de conversas privadas, sidebar de contatos e busca de pessoas por nome ou ID, incluindo pessoas offline.
  - `css/estilos.css`: Folha de estilos personalizada combinada com o Bootstrap 5.
  - `js/contas.js`: Módulo com as regras de cadastro, login, verificação de sessão e saída usando `localStorage`.
  - `js/login.js`: Lógica e validação da tela de login.
  - `js/cadastro.js`: Lógica e validação da tela de criação de conta.
  - `js/chat.js`: Lógica completa do chat com WebSocket, histórico, status online/offline e notificações.
  - `audio/notificacao.mp3`: Efeito sonoro tocado ao receber nova mensagem.

---

## Cadastro e Login

As funções de autenticação local ficam em `public/js/contas.js`:
- **`carregarContas()`**: Lê as contas salvas no `localStorage` sob a chave `contasChat`.
- **`cadastrar(nome, senha)`**: Valida tamanho do nome (3 a 40 caracteres), senha (8 a 128 caracteres), impede nomes duplicados e salva no `localStorage`.
- **`entrar(nome, senha)`**: Valida credenciais com as contas cadastradas e salva o usuário ativo na chave `usuarioLogadoChat`.
- **`usuarioLogado()`**: Retorna o nome do usuário logado se a sessão for válida.
- **`sair()`**: Remove a sessão ativa do `localStorage`.

> **Nota Acadêmica:** Demonstração para fins acadêmicos. As senhas ficam no armazenamento local do navegador (`localStorage`) para simulação.

## Contatos

Cada conta em `contasChat` contém `{ id, username, senha, contatos: [] }`.
O campo `username` mantém o nome usado pela aplicação e `contatos` guarda somente
os IDs adicionados por aquela conta. Adicionar alguém não adiciona automaticamente
a conta de volta na lista da outra pessoa.
Cada contato tem um botão **Remover**, que retira seu ID da conta atual e da sidebar.
Se a conversa estiver aberta, ela é fechada; o histórico fica salvo e pode ser
acessado novamente ao adicionar a pessoa de volta.

O botão **Adicionar pessoas** abre uma busca por nome ou ID, sem filtrar por presença.
O cadastro registra o nome no diretório do servidor, mesmo antes do primeiro acesso
ao chat. Contas antigas deste navegador recebem seus IDs ao abrir o chat, preservando
senhas e históricos. A sidebar exibe somente os contatos adicionados; o histórico
antigo do chat global continua salvo, mas não aparece nessa lista.

As contas e seus contatos continuam locais ao navegador, como no fluxo original.
O endpoint `POST /api/usuarios` registra apenas nome e ID no diretório público;
não recebe nem retorna senhas. Esta mudança mantém a autenticação demonstrativa
existente, sem criar autenticação de produção no servidor.

Execute `node --test tests/contatos.test.cjs` para verificar contas, migração,
isolamento dos contatos, filtro da sidebar, cadastro offline e entrega de mensagens.
Os testes do servidor usam uma base temporária, sem alterar `dados-demo.json` do projeto.
