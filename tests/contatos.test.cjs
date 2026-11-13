const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const WebSocket = require("ws");
const root = path.resolve(__dirname, "..");
function contasContext() {
  const storage = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    fetch: async () => ({ ok: true, json: async () => ({ id: 12 }) }),
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "public/js/contas.js"), "utf8") +
      "\nglobalThis.Contas = Contas;",
    context,
  );
  return { context, storage };
}
test("cadastro, migração e contatos isolados por conta, sem duplicatas", async () => {
  const { context: c, storage: s } = contasContext();
  const contas = new c.Contas();
  assert.equal(await contas.cadastrar("Alice", "senha123"), "");
  assert.deepEqual(JSON.parse(s.get("contasChat")), [
    { id: 12, username: "Alice", senha: "senha123", contatos: [] },
  ]);
  assert.equal(contas.entrar("Alice", "senha123"), "");
  const users = [{ id: 12 }, { id: 2, online: false }];
  assert.equal(contas.adicionarContato(2, users), "");
  assert.notEqual(contas.adicionarContato(2, users), "");
  assert.notEqual(contas.adicionarContato(12, users), "");
  assert.notEqual(contas.adicionarContato(999, users), "");
  assert.deepEqual(Array.from(new c.Contas().contatos()), [2]);
  const data = JSON.parse(s.get("contasChat"));
  data.push({ username: "Antiga", senha: "preservada" });
  s.set("contasChat", JSON.stringify(data));
  s.set("usuarioLogadoChat", "Antiga");
  const antiga = new c.Contas();
  antiga.sincronizarId(3);
  assert.deepEqual(Array.from(antiga.contatos()), []);
  assert.deepEqual(JSON.parse(s.get("contasChat"))[1], {
    id: 3,
    username: "Antiga",
    senha: "preservada",
    contatos: [],
  });
  assert.deepEqual(JSON.parse(s.get("contasChat"))[0].contatos, [2]);
  assert.notEqual(antiga.removerContato(2), "");
  s.set("usuarioLogadoChat", "Alice");
  assert.equal(new c.Contas().removerContato(2), "");
  assert.deepEqual(Array.from(new c.Contas().contatos()), []);
  assert.equal(JSON.parse(s.get("contasChat"))[1].senha, "preservada");
});
test(
  "diretório inclui cadastro offline e mensagem privada é recuperada ao entrar",
  { timeout: 15000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chat-contatos-"));
    fs.copyFileSync(path.join(root, "banco.js"), path.join(tmp, "banco.mjs"));
    let source = fs.readFileSync(path.join(root, "server.js"), "utf8");
    source = source
      .replace(
        "from 'express'",
        `from '${pathToFileURL(require.resolve("express")).href}'`,
      )
      .replace(
        "from 'ws'",
        `from '${pathToFileURL(path.join(path.dirname(require.resolve("ws")), "wrapper.mjs")).href}'`,
      )
      .replace("'./banco.js'", "'./banco.mjs'")
      .replace("const porta = 8080;", "const porta = 0;")
      .replace("${porta}", "${server.address().port}");
    fs.writeFileSync(path.join(tmp, "server.mjs"), source);
    const child = spawn(process.execPath, [path.join(tmp, "server.mjs")], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const sockets = [];
    try {
      const base = await new Promise((resolve, reject) => {
        let text = "";
        child.stdout.on("data", (data) => {
          text += data;
          const m = text.match(/http:\/\/localhost:\d+/);
          if (m) resolve(m[0]);
        });
        child.on("error", reject);
        child.on("exit", (code) =>
          reject(new Error("Servidor encerrou: " + code)),
        );
      });
      const register = async (username) => {
        const r = await fetch(base + "/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        assert.equal(r.status, 200);
        return r.json();
      };
      const alice = await register("Alice");
      const bob = await register("Bob");
      assert.equal((await register("bob")).id, bob.id);
      function inbox(ws) {
        const messages = [];
        ws.on("message", (m) => messages.push(JSON.parse(m)));
        return async (type) => {
          const deadline = Date.now() + 3000;
          while (Date.now() < deadline) {
            const i = messages.findIndex((m) => type(m));
            if (i >= 0) return messages.splice(i, 1)[0];
            await new Promise((r) => setTimeout(r, 10));
          }
          throw new Error("Mensagem esperada não recebida");
        };
      }
      const a = new WebSocket(base.replace("http:", "ws:") + "/ws");
      sockets.push(a);
      const nextA = inbox(a);
      await once(a, "open");
      a.send(JSON.stringify({ type: "register", username: "Alice" }));
      const list = await nextA((m) => m.type === "online_list");
      assert.equal(list.id, alice.id);
      assert.equal(list.users.find((u) => u.id === bob.id).online, false);
      assert.equal("senha" in list.users[0], false);
      const carol = await register("Carol");
      const available = await nextA((m) => m.type === "user_available");
      assert.equal(available.id, carol.id);
      assert.equal(available.online, false);
      a.send(JSON.stringify({ content: "Mensagem para offline", to: "Bob" }));
      const sent = await nextA((m) => m.conteudo === "Mensagem para offline");
      assert.equal(sent.destinatarioId, bob.id);
      const b = new WebSocket(base.replace("http:", "ws:") + "/ws");
      sockets.push(b);
      const nextB = inbox(b);
      await once(b, "open");
      b.send(JSON.stringify({ type: "register", username: "Bob" }));
      const history = await nextB((m) => m.type === "historico");
      assert.ok(history.mensagens.some((m) => m.id === sent.id));
      const saved = JSON.parse(
        fs.readFileSync(path.join(tmp, "dados-demo.json"), "utf8"),
      );
      assert.equal(saved.usuarios.length, 3);
    } finally {
      sockets.forEach((s) => s.terminate());
      child.kill();
    }
  },
);

test("sidebar só mostra contatos; busca permite adicionar offline e selecionar conversa", async () => {
  const { context: c, storage: s } = contasContext();
  s.set(
    "contasChat",
    JSON.stringify([
      { id: 1, username: "Alice", senha: "senha123", contatos: [] },
    ]),
  );
  s.set("usuarioLogadoChat", "Alice");
  class Element {
    constructor() {
      this.children = [];
      this.handlers = {};
      this.style = {};
      this.value = "";
      this.textContent = "";
    }
    set innerHTML(v) {
      this.children = [];
    }
    appendChild(e) {
      this.children.push(e);
      return e;
    }
    append(...e) {
      this.children.push(...e);
    }
    replaceChildren() {
      this.children = [];
    }
    addEventListener(name, fn) {
      this.handlers[name] = fn;
    }
    setAttribute() {}
    focus() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
  }
  const elements = new Map();
  let ready;
  c.document = {
    addEventListener: (n, fn) => {
      ready = fn;
    },
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: () => new Element(),
    createTextNode: (text) => text,
  };
  c.window = {
    location: { protocol: "http:", host: "test", replace() {} },
    addEventListener() {},
  };
  let socket;
  class FakeSocket {
    static OPEN = 1;
    constructor() {
      socket = this;
      this.readyState = 1;
    }
    send(data) {
      this.last = JSON.parse(data);
    }
  }
  c.WebSocket = FakeSocket;
  c.Audio = class {
    play() {
      return Promise.resolve();
    }
  };
  vm.runInContext(
    fs.readFileSync(path.join(root, "public/js/chat.js"), "utf8"),
    c,
  );
  await ready();
  const receive = (data) => socket.onmessage({ data: JSON.stringify(data) });
  receive({
    type: "online_list",
    id: 1,
    users: [
      { id: 2, username: "Bob", online: false },
      { id: 3, username: "Carol", online: true },
    ],
  });
  const sidebar = elements.get("lista-chats"),
    results = elements.get("resultado-pessoas");
  assert.match(sidebar.children[0].textContent, /Nenhum contato/);
  assert.equal(results.children.length, 2);
  results.children[0].children[1].handlers.click();
  assert.deepEqual(JSON.parse(s.get("contasChat"))[0].contatos, [2]);
  assert.equal(sidebar.children.length, 1);
  const button = sidebar.children[0].children[0];
  assert.equal(button.children[1].children[0].textContent, "Bob");
  button.handlers.click();
  assert.equal(elements.get("btn-enviar").disabled, false);
  elements.get("input-mensagem").value = "Oi offline";
  elements.get("form-mensagem").handlers.submit({ preventDefault() {} });
  assert.deepEqual(socket.last, { content: "Oi offline", to: "Bob" });
  receive({ type: "user_online", id: 3, username: "Carol" });
  assert.equal(sidebar.children.length, 1);
  elements.get("busca-pessoas").value = "3";
  elements.get("busca-pessoas").handlers.input();
  assert.equal(results.children.length, 1);
  receive({
    type: "historico",
    mensagens: [
      {
        id: 10,
        chatId: "1-2",
        remetenteId: 2,
        conteudo: "Histórico preservado",
      },
    ],
  });
  const history = s.get("conversas:Alice");
  sidebar.children[0].children[1].handlers.click();
  assert.deepEqual(JSON.parse(s.get("contasChat"))[0].contatos, []);
  assert.match(sidebar.children[0].textContent, /Nenhum contato/);
  assert.equal(elements.get("titulo-chat").textContent, "Selecione um contato");
  assert.equal(elements.get("btn-enviar").disabled, true);
  assert.equal(s.get("conversas:Alice"), history);
  elements.get("busca-pessoas").value = "Bob";
  elements.get("busca-pessoas").handlers.input();
  results.children[0].children[1].handlers.click();
  sidebar.children[0].children[0].handlers.click();
  assert.equal(elements.get("btn-enviar").disabled, false);
  assert.equal(s.get("conversas:Alice"), history);
});
