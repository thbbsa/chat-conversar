import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO = path.join(__dirname, 'dados-demo.json');

const DADOS_INICIAIS = {
  proximoIdUsuario: 1,
  proximoIdMensagem: 1,
  usuarios: [],
  mensagens: []
};

function carregarDados() {
  let texto;

  try {
    texto = fs.readFileSync(ARQUIVO, 'utf8');
  } catch (erro) {
    if (erro.code === 'ENOENT') {
      console.log('dados-demo.json não existe, começando vazio.');
      return structuredClone(DADOS_INICIAIS);
    }
    throw erro;
  }

  try {
    return { ...structuredClone(DADOS_INICIAIS), ...JSON.parse(texto) };
  } catch {
    console.error('dados-demo.json está corrompido. Corrija ou apague o arquivo.');
    process.exit(1);
  }
}

export const dados = carregarDados();

export function salvarDados() {
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2));
}
