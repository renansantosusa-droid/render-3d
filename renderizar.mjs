// Renderiza um video 3D em partes de 10s (300 quadros).
//   node renderizar.mjs partes <video> <segundos>       -> imprime quantas partes tem
//   node renderizar.mjs parte  <video> <segundos> <k>   -> renderiza so a parte k em saida/parte-k.mp4
//   node renderizar.mjs juntar <video>                  -> junta saida/parte-*.mp4 + <video>/voz.wav em saida/<video>.mp4
//   node renderizar.mjs tudo   <video> <segundos>       -> tudo no PC local (pula partes prontas; pra pausar crie saida/PARAR)
// <video> = nome da cena: <video>.html + pasta <video>/ (tempos.json e voz.wav)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
// o navegador so e carregado quando vai renderizar (o "juntar" nao precisa dele)
const carregarChromium = async () => (await import("playwright")).chromium;

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FPS = 30, POR_PARTE = 300;
const [modo, video, segStr, kStr] = process.argv.slice(2);
const SAIDA = path.join(RAIZ, "saida");
fs.mkdirSync(SAIDA, { recursive: true });
const TOTAL = Math.round(Number(segStr) * FPS), NPARTES = Math.ceil(TOTAL / POR_PARTE);
const nomeParte = (k) => path.join(SAIDA, `parte-${String(k).padStart(3, "0")}.mp4`);
const tipos = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

function servidor() {
  const srv = http.createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split("?")[0]));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(r);
  }).listen(0);
  return srv;
}

async function renderParte(k, porta) {
  const ini = k * POR_PARTE, fim = Math.min(TOTAL, ini + POR_PARTE);
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const nav = await (await carregarChromium()).launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const tmp = nomeParte(k).replace(".mp4", ".tmp.mp4");
    try {
      const pg = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
      pg.on("pageerror", (e) => console.error("ERRO NA PAGINA:", e.message));
      await pg.goto(`http://localhost:${porta}/${video}.html`);
      await pg.waitForFunction(() => window.pronto === true, null, { timeout: 90000 });
      const ff = spawn(FFMPEG, ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", tmp], { stdio: ["pipe", "ignore", "inherit"] });
      const fechou = new Promise((ok) => ff.on("close", ok));
      for (let i = ini; i < fim; i++) {
        await pg.evaluate((t) => window.renderFrame(t), i / FPS);
        const buf = await pg.screenshot({ type: "jpeg", quality: 94 });
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
        if (i % 30 === 0) console.log(`parte ${k + 1}/${NPARTES} | quadro ${i}/${TOTAL} | ${Math.floor(i / TOTAL * 100)}%`);
      }
      ff.stdin.end(); await fechou;
      fs.renameSync(tmp, nomeParte(k));
      await nav.close();
      return;
    } catch (e) {
      console.error(`parte ${k + 1} falhou (tentativa ${tentativa}):`, e.message);
      fs.rmSync(tmp, { force: true });
      await nav.close().catch(() => {});
    }
  }
  throw new Error(`parte ${k + 1} falhou 3 vezes`);
}

function juntar() {
  const partes = fs.readdirSync(SAIDA).filter((f) => /^parte-\d+\.mp4$/.test(f)).sort();
  const lista = path.join(SAIDA, "lista.txt");
  fs.writeFileSync(lista, partes.map((f) => `file '${path.join(SAIDA, f).replace(/\\/g, "/")}'`).join("\n"));
  const final = path.join(SAIDA, `${video}.mp4`);
  const r = spawnSync(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-i", path.join(RAIZ, video, "voz.wav"),
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", final], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg falhou ao juntar");
  console.log(`PRONTO: ${final} (${partes.length} partes)`);
}

if (modo === "quadro") { // prévia: node renderizar.mjs quadro <video> <t1,t2,...> -> saida/previa.jpg (tira com os quadros)
  const srv = servidor();
  const nav = await (await carregarChromium()).launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const pg = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on("pageerror", (e) => console.error("ERRO NA PAGINA:", e.message));
  pg.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
  await pg.goto(`http://localhost:${srv.address().port}/${video}.html`);
  await pg.waitForFunction(() => window.pronto === true, null, { timeout: 90000 });
  const ts = segStr.split(","), arqs = [];
  for (const t of ts) {
    await pg.evaluate((t) => window.renderFrame(t), Number(t));
    const f = path.join(SAIDA, `q-${t}.jpg`); arqs.push(f);
    await pg.screenshot({ path: f, type: "jpeg", quality: 85 });
  }
  await nav.close(); srv.close();
  spawnSync(FFMPEG, ["-y", "-v", "error", ...arqs.flatMap((f) => ["-i", f]), "-filter_complex",
    arqs.length > 1 ? `${arqs.map((_, i) => `[${i}]`).join("")}hstack=${arqs.length},scale=${Math.min(2400, arqs.length * 300)}:-1` : "[0]scale=300:-1", path.join(SAIDA, "previa.jpg")], { stdio: "inherit" });
  console.log("previa:", path.join(SAIDA, "previa.jpg"));
} else if (modo === "partes") {
  console.log(JSON.stringify(Array.from({ length: NPARTES }, (_, k) => k)));
} else if (modo === "parte") {
  const srv = servidor(); await renderParte(Number(kStr), srv.address().port); srv.close();
} else if (modo === "juntar") {
  juntar();
} else if (modo === "tudo") {
  const srv = servidor();
  for (let k = 0; k < NPARTES; k++) {
    if (fs.existsSync(path.join(SAIDA, "PARAR"))) { fs.rmSync(path.join(SAIDA, "PARAR")); console.log(`PAUSADO antes da parte ${k + 1}/${NPARTES}`); srv.close(); process.exit(0); }
    if (!fs.existsSync(nomeParte(k))) await renderParte(k, srv.address().port);
  }
  srv.close(); juntar();
} else {
  console.log("uso: node renderizar.mjs partes|parte|juntar|tudo <video> [segundos] [parte]");
}
