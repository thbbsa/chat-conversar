# Chat Conversar

Chat com Angular, Bootstrap, Node.js e WebSocket para um exercício acadêmico.

## Executar

Na pasta chat-conversar, execute npm.cmd start e abra http://localhost:8080/.
Para desenvolver, execute node server.js em um terminal e npx.cmd ng serve em outro.
Nesse modo, abra http://localhost:4200/.

## Cadastro e login

As funções ficam em src/contas.ts.
- carregarContas usa getItem e JSON.parse para ler o array.
- cadastrar verifica o nome, adiciona um objeto com push e salva com JSON.stringify e setItem.
- entrar percorre as contas com for e compara nome e senha com if.
- usuarioLogado recupera o nome salvo.
- sair remove o nome com removeItem.

Use contas e senhas fictícias. As senhas ficam visíveis no armazenamento do navegador.
Esse login é uma simulação acadêmica e pode ser alterado pelas ferramentas do navegador.
As contas funcionam no navegador e endereço em que foram cadastradas.
localhost:4200 e localhost:8080 possuem armazenamentos separados.

Cadastre novamente suas contas fictícias para este modelo. O histórico da demonstração
fica em dados-demo.json. O arquivo dados.json contém os dados da versão anterior.
O servidor usa o nome informado pelo navegador para identificar o participante.
