// Testa a Festa da Turma como um celular, no GitHub: sobe uma cópia do servidor (festa-server.js) com chave descartável e serve a página
// publicada no site por um endereço local, trocando só o servidor. Nada toca na festa no ar nem precisa de segredo.
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
const CHAVE = randomBytes(8).toString("hex"), PORTA_WS = 4301, PORTA_WEB = 4302, WS = `ws://localhost:${PORTA_WS}/ws`, SITE = "https://brasildaturma.online";
fs.mkdirSync("fotos-festa", { recursive: true });
const sv = spawn(process.execPath, ["festa-server.mjs"], { env: { ...process.env, PORT: String(PORTA_WS), TESTE_CHAVE: CHAVE }, stdio: "inherit" });
const web = http.createServer(async (q, r) => {
  if (q.url.startsWith("/festa/config.js")) { r.setHeader("content-type", "application/javascript"); return r.end(`window.FESTA={servidor:${JSON.stringify(WS)},musicas:[{nome:"🤠 Sertanejo",id:"YrvU5E-iF_s"},{nome:"🥁 Pagode",id:"Vxl-SEI02wE"}]};`); }
  try {
    const u = await fetch(SITE + q.url), b = Buffer.from(await u.arrayBuffer());
    r.statusCode = u.status; r.setHeader("content-type", u.headers.get("content-type") || "application/octet-stream"); r.end(b);
  } catch (e) { r.statusCode = 502; r.end(String(e)); }
}).listen(PORTA_WEB);
await new Promise((ok) => setTimeout(ok, 2500));
const bots = [];
for (let i = 0; i < 30; i++) { const w = new WebSocket(WS); bots.push(w); w.onopen = () => w.send(JSON.stringify({ t: "entrar", u: "turma_" + i, chave: CHAVE })); }
const passeio = setInterval(() => bots.forEach((w, i) => { if (w.readyState === 1) { if (Math.random() < .3) w.send(JSON.stringify({ t: "andar", x: Math.random() * 16 - 8, z: -27 + Math.random() * 14 - 7 })); if (Math.random() < .12) w.send(JSON.stringify({ t: "emoji", i: i % 6 })); } }), 1500);
const nav = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
const g = await ctx.newPage(), erros = [];
g.on("pageerror", (e) => erros.push("página: " + e)); g.on("console", (m) => { if (m.type() === "error" && !/favicon|404|CORS|ERR_/.test(m.text())) erros.push("console: " + m.text()); });
g.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) erros.push(`${r.status()} ${r.url().split("?")[0]}`); });
await g.goto(`http://localhost:${PORTA_WEB}/festa/?chave=${CHAVE}&u=teste_github`, { waitUntil: "load", timeout: 120000 });
await g.click("#entrar");
await g.waitForFunction(() => document.getElementById("entrada").hidden, null, { timeout: 60000 });
await g.waitForTimeout(6000);
console.log("topo:", await g.locator("#quantos").innerText(), "| bonecos:", await g.evaluate(() => window.__festa.P.size));
await g.screenshot({ path: "fotos-festa/0-chegada.png", timeout: 180000 });
const nomes = await g.evaluate(() => window.__festa.AREAS.map((a) => a.id));
for (let i = 0; i < nomes.length; i++) {
  await g.click("#btn-mapa"); await g.waitForTimeout(300);
  await g.click(`#ambientes button:nth-child(${i + 1})`); await g.waitForTimeout(5000);
  const topo = await g.locator("#quantos").innerText();
  console.log(nomes[i], "->", topo);
  if (!topo.includes(await g.evaluate((k) => window.__festa.AREAS[k].nome, i))) erros.push("nome da área não apareceu: " + nomes[i]);
  await g.screenshot({ path: `fotos-festa/${i + 1}-${nomes[i]}.png`, timeout: 180000 });
}
// feirinha: tocar numa barraca abre o produto
await g.click("#btn-mapa"); await g.waitForTimeout(300); await g.click("#ambientes button:nth-child(5)"); await g.waitForTimeout(4000);
await g.evaluate(() => { const c = document.getElementById("palco"); const e = (t) => c.dispatchEvent(new PointerEvent(t, { clientX: innerWidth * .78, clientY: innerHeight * .44, bubbles: true })); e("pointerdown"); e("pointerup"); });
await g.waitForTimeout(1500);
const barraca = await g.locator("#barraca").isVisible();
console.log("barraca abriu:", barraca, barraca ? (await g.locator("#barraca").innerText()).replace(/\n+/g, " | ") : "");
await g.screenshot({ path: "fotos-festa/7-barraca.png", timeout: 180000 });
await g.evaluate(() => { document.getElementById("barraca").hidden = true; });
// campinho: um boneco chuta a bola e ela precisa sair do lugar, com todos vendo o mesmo
await g.click("#btn-mapa"); await g.waitForTimeout(300); await g.click("#ambientes button:nth-child(3)"); await g.waitForTimeout(3000);
const chute = new WebSocket(WS), bolas = [];
await new Promise((ok) => { chute.onopen = () => { chute.send(JSON.stringify({ t: "entrar", u: "chutador", chave: CHAVE })); ok(); }; });
chute.onmessage = (e) => { const m = JSON.parse(e.data); if (m.b) bolas.push(m.b); };
await new Promise((r) => setTimeout(r, 800)); chute.send(JSON.stringify({ t: "andar", x: 37, z: 0 })); await new Promise((r) => setTimeout(r, 400));
chute.send(JSON.stringify({ t: "chute", x: 1, z: 0 })); await new Promise((r) => setTimeout(r, 1500));
console.log("bola:", JSON.stringify(bolas[0]), "->", JSON.stringify(bolas.at(-1)));
await g.screenshot({ path: "fotos-festa/8-chute.png", timeout: 180000 });
// música: escolhe cada gênero, vê o player e o que ele mostra
for (const n of [1, 2]) {
  await g.click("#btn-som"); await g.waitForTimeout(300); await g.click(`#musicas button:nth-child(${n})`); await g.waitForTimeout(7000);
  const fr = g.frames().find((f) => f.url().includes("youtube.com/embed"));
  const txt = fr ? (await fr.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160) : "(sem player)";
  console.log("música", n, await g.locator("#btn-som").innerText(), "| player:", txt);
  await g.screenshot({ path: `fotos-festa/9-musica${n}.png`, timeout: 180000 });
}
console.log("ERROS:", erros.length ? "\n" + [...new Set(erros)].join("\n") : "nenhum");
clearInterval(passeio); bots.forEach((w) => w.close()); chute.close(); await nav.close(); web.close(); sv.kill();
process.exit(0);
