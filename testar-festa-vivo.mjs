// PROTÓTIPO da festa com as páginas QUE ESTÃO NO AR (brasildaturma.online/festa/); servidor = cópia local, robô e Pix de mentira.
// o resto (assets) vem do site. Servidor = festa-server.mjs (cópia) com chave descartável; robô das skins = falso, aqui dentro.
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
const CHAVE = randomBytes(8).toString("hex"), PORTA_WS = 4301, PORTA_WEB = 4302, PORTA_ROBO = 4303, WS = `ws://localhost:${PORTA_WS}/ws`, SITE = "https://brasildaturma.online";
fs.mkdirSync("fotos-festa", { recursive: true });
// robô falso: donos das skins (bots de 1 a 6 vestem uma cada) + loja
const donos = { teste_github: [0, 6], turma_1: [6], turma_2: [1], turma_3: [2], turma_4: [3], turma_5: [4], turma_6: [5], turma_7: [7], turma_10: [8], turma_11: [9], turma_12: [10], turma_13: [11], turma_8: [2], turma_9: [5] };
let consultas = 0;
const CATALOGO = [["coroa", "Coroa dourada", "👑", 4.9], ["oculos", "Óculos escuros", "🕶️", 2.9], ["capa", "Capa de herói", "🦸", 3.9], ["brasil", "Camisa do Brasil", "🇧🇷", 2.9], ["cowboy", "Chapéu de cowboy", "🤠", 2.9], ["asas", "Asas de anjo", "👼", 4.9], ...[["aura", "#9b3dff"], ["aura_azul", "#2f7bff"], ["aura_verde", "#1fd15a"], ["aura_vermelha", "#ff2a2a"], ["aura_dourada", "#ffb300"], ["aura_rosa", "#ff3fb4"]].map(([id, cor]) => [id, "Farmador de Aura", "✨", 9.9, cor])].map(([id, nome, icone, preco, cor]) => ({ id, nome, icone, preco, lendaria: !!cor, grupo: cor ? "aura" : null, cor: cor || null }));
http.createServer((q, r) => { r.setHeader("content-type", "application/json"); if (q.url.startsWith("/skins/donos")) return r.end(JSON.stringify(donos)); r.statusCode = 404; r.end("{}"); }).listen(PORTA_ROBO);
const sv = spawn(process.execPath, ["festa-server.mjs"], { env: { ...process.env, PORT: String(PORTA_WS), TESTE_CHAVE: CHAVE, CICLO_TESTE: "1", ROBO_URL: `http://localhost:${PORTA_ROBO}` }, stdio: "inherit" });
const web = http.createServer(async (q, r) => {
  const caminho = q.url.split("?")[0];
  if (caminho === "/festa/config.js") { r.setHeader("content-type", "application/javascript"); return r.end(`window.FESTA={servidor:${JSON.stringify(WS)},musicas:[]};`); }
  if (false) {
    const arq = caminho.endsWith("/") ? "index.html" : caminho.slice(7);
    r.setHeader("content-type", arq.endsWith(".js") ? "application/javascript" : "text/html; charset=utf-8"); return r.end(fs.readFileSync("festa-local/" + arq));
  }
  try {
    const u = await fetch(SITE + q.url), b = Buffer.from(await u.arrayBuffer());
    r.statusCode = u.status; r.setHeader("content-type", u.headers.get("content-type") || "application/octet-stream"); r.end(b);
  } catch (e) { r.statusCode = 502; r.end(String(e)); }
}).listen(PORTA_WEB);
await new Promise((ok) => setTimeout(ok, 2500));
// bots: 1-9 ficam perto (com skin), 10-29 de vários estados pintam o chão
const CIDS = [3550308, 2611606, 2927408, 4314902, 3106200, 2304400];
const bots = [];
for (let i = 0; i < 30; i++) { const w = new WebSocket(WS); bots.push(w); w.onopen = () => w.send(JSON.stringify({ t: "entrar", u: "turma_" + i, chave: CHAVE, cid: CIDS[i % 6] })); }
let modoBots = "perto";
const passeio = setInterval(() => bots.forEach((w, i) => {
  if (w.readyState !== 1) return;
  if (modoBots === "perto" && i < 10) { if (Math.random() < .25) w.send(JSON.stringify({ t: "andar", x: Math.random() * 10 - 5, z: 4 + Math.random() * 6 })); }
  else if (modoBots === "pinta" || i >= 10) { if (Math.random() < .5) w.send(JSON.stringify({ t: "andar", x: -38 + Math.random() * 24 - 12, z: Math.random() * 24 - 12 })); }
  if (Math.random() < .08) w.send(JSON.stringify({ t: "emoji", i: i % 6 }));
}), 900);
const nav = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
const g = await ctx.newPage(), erros = [];
// a página chama o robô de verdade: aqui ele responde de mentira (lista, Pix, situação: paga na 2ª consulta)
await g.route("https://brasildaturma-renan.squareweb.app/skins/**", async (rt) => {
  const u = new URL(rt.request().url());
  if (u.pathname === "/skins/lista") return rt.fulfill({ json: { venda: true, skins: CATALOGO, minhas: donos[u.searchParams.get("u")] || [] } });
  if (u.pathname === "/skins/pix") return rt.fulfill({ json: { id: "abc", segredo: "x", copia: "00020126580014BR.GOV.BCB.PIX-TESTE", qr: null, expira: Date.now() + 18e5, preco: 3.9 } });
  if (u.pathname === "/skins/situacao") { consultas++; if (consultas >= 2) donos.teste_github = [0, 2, 6]; return rt.fulfill({ json: { status: consultas >= 2 ? "pago" : "pendente", n: 2 } }); }
  return rt.fulfill({ status: 404, json: {} });
});
g.on("pageerror", (e) => erros.push("página: " + e)); g.on("console", (m) => { if (m.type() === "error" && !/favicon|404|CORS|ERR_/.test(m.text())) erros.push("console: " + m.text()); });
g.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) erros.push(`${r.status()} ${r.url().split("?")[0]}`); });
await g.goto(`http://localhost:${PORTA_WEB}/festa/?chave=${CHAVE}&u=teste_github`, { waitUntil: "load", timeout: 120000 });
await g.screenshot({ path: "fotos-festa/00-entrada.png" });
// loja antes de entrar
await g.click("#btn-loja-entrada"); await g.waitForTimeout(1500);
console.log("loja (entrada):", (await g.locator("#loja").innerText()).replace(/\n+/g, " | "));
await g.screenshot({ path: "fotos-festa/01-loja-entrada.png" });
await g.click("#loja .sk.lend"); await g.waitForTimeout(1200); console.log("provador (coroa + aura):", await g.locator("#loja .provNome").innerText()); await g.screenshot({ path: "fotos-festa/01b-provador-junto.png" });
await g.locator("#loja .cores .cor").nth(2).click(); await g.waitForTimeout(1200); console.log("provador (cor verde):", await g.locator("#loja .provNome").innerText()); await g.screenshot({ path: "fotos-festa/01c-provador-verde.png" });
await g.click("#loja .fechar");
await g.click("#entrar");
await g.waitForFunction(() => document.getElementById("entrada").hidden, null, { timeout: 60000 });
await g.waitForTimeout(7000);
console.log("topo:", await g.locator("#quantos").innerText(), "| bonecos:", await g.evaluate(() => window.__festa.P.size), "| skins vistas:", await g.evaluate(() => [...window.__festa.P.values()].map((p) => p.sk + "+" + p.au).join(",")));
await g.screenshot({ path: "fotos-festa/02-chegada-skins.png", timeout: 180000 });
// compra de skin dentro da festa: capa de herói
await g.click("#btn-loja"); await g.waitForTimeout(1500);
await g.screenshot({ path: "fotos-festa/03-loja.png" });
await g.locator("#loja .sk").nth(3).click(); await g.waitForTimeout(1500); await g.screenshot({ path: "fotos-festa/03b-provando-capa.png" });
await g.locator("#loja .cores .cor").nth(1).click(); await g.waitForTimeout(1500); await g.screenshot({ path: "fotos-festa/03c-aura-azul.png" });
await g.locator("#loja .cores .cor").nth(3).click(); await g.waitForTimeout(1500); await g.screenshot({ path: "fotos-festa/03d-aura-vermelha.png" });
await g.locator("#loja .sk").nth(3).locator("button").click(); await g.waitForTimeout(500);
await g.fill("#lojaMail", "teste@exemplo.com");
await g.screenshot({ path: "fotos-festa/04-dados.png" });
await g.click("#loja .ok"); await g.waitForTimeout(1200);
await g.screenshot({ path: "fotos-festa/05-pix.png" });
await g.waitForTimeout(9000);
console.log("depois do Pix:", (await g.locator("#loja").innerText()).replace(/\n+/g, " | "), "| minha skin:", await g.evaluate(() => window.__festa.P.get(window.__festa.meuId)?.sk) + " aura " + (await g.evaluate(() => window.__festa.P.get(window.__festa.meuId)?.au)));
await g.screenshot({ path: "fotos-festa/06-liberada.png" });
await g.click("#loja .ok");
await g.waitForTimeout(2500);
await g.screenshot({ path: "fotos-festa/07-com-capa.png", timeout: 180000 });
const meu = await g.evaluate(() => window.__festa.meuId);
bots[2].send(JSON.stringify({ t: "frase", i: 1, a: meu })); await g.waitForTimeout(1200);
console.log("resposta rápida:", await g.locator("#resp").isVisible() ? await g.locator("#resp").innerText() : "NÃO APARECEU");
await g.screenshot({ path: "fotos-festa/08-resposta.png", timeout: 180000 });
if (await g.locator("#resp").isVisible()) await g.click("#resp");
await g.click("#btn-frases"); await g.waitForTimeout(500); console.log("frases:", (await g.locator("#frases").innerText()).split("\n").join(" | ")); await g.screenshot({ path: "fotos-festa/09-frases.png" }); await g.click("#btn-frases");
// áreas
const nomes = await g.evaluate(() => window.__festa.AREAS.map((a) => a.id));
for (let i = 0; i < nomes.length; i++) {
  if (nomes[i] === "pinta") modoBots = "pinta";
  await g.click("#btn-mapa"); await g.waitForTimeout(300);
  await g.click(`#ambientes button:nth-child(${i + 1})`); await g.waitForTimeout(nomes[i] === "pinta" ? 12000 : 4000);
  const topo = await g.locator("#quantos").innerText();
  console.log(nomes[i], "->", topo);
  await g.screenshot({ path: `fotos-festa/1${i}-${nomes[i]}.png`, timeout: 180000 });
  modoBots = "perto";
}
// Pinta o Chão: eu ando pela grade (pinta o caminho)
await g.click("#btn-mapa"); await g.waitForTimeout(300); await g.click(`#ambientes button:nth-child(${nomes.indexOf("pinta") + 1})`); modoBots = "pinta"; await g.waitForTimeout(3000);
for (const [fx, fy] of [[.2, .55], [.8, .55], [.8, .35], [.2, .35]]) { await g.evaluate(([a, b]) => { const c = document.getElementById("palco"); const e = (t) => c.dispatchEvent(new PointerEvent(t, { clientX: innerWidth * a, clientY: innerHeight * b, bubbles: true })); e("pointerdown"); e("pointerup"); }, [fx, fy]); await g.waitForTimeout(2200); }
await g.screenshot({ path: "fotos-festa/20-pinta-depois.png", timeout: 180000 });
await g.waitForTimeout(16000);
await g.screenshot({ path: "fotos-festa/21-pinta-rodada.png", timeout: 180000 });
console.log("placar:", await g.locator("#medalhas").innerText().catch(() => ""), "| olimp:", await g.locator("#olimp").innerText());
console.log("ERROS:", erros.length ? "\n" + [...new Set(erros)].join("\n") : "nenhum");
clearInterval(passeio); bots.forEach((w) => w.close()); await nav.close(); web.close(); sv.kill();
process.exit(0);
