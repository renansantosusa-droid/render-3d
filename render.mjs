// Poe os CTAs animados (Instagram, comentario, barra do YouTube com cursor e sininho) + efeitos sonoros
// por cima de um video horizontal ja editado, sem cortar nada. Roda no GitHub Actions (enviar.mjs).
//   node render.mjs <eventos.json> <video> <saida.mp4>
//   node render.mjs <eventos.json> --quadros <pasta> t1 t2 ...   -> so os PNGs transparentes (conferir)
// Precisa: FFMPEG (env) e playwright com chromium.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { chromium } from "playwright";

const AQUI = import.meta.dirname;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FPS = 30;
const [cfgArq, a2, a3, ...resto] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(cfgArq, "utf8"));
const EV = cfg.eventos;

function ff(args) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1e8 });
  if (r.status !== 0) throw new Error("ffmpeg falhou:\n" + r.stderr);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + path.join(AQUI, "ov.html").replace(/\\/g, "/"));
await page.evaluate((v) => window.setEV(v), EV);
await page.evaluate(() => document.fonts.ready);
const shot = async (t, arq) => { await page.evaluate((t) => window.setT(t), t); await page.screenshot({ path: arq, omitBackground: true }); };

if (a2 === "--quadros") {
  fs.mkdirSync(a3, { recursive: true });
  for (const t of resto) await shot(Number(t), path.join(a3, `ov-${t}.png`));
  await browser.close();
  process.exit(0);
}

const video = a2, saida = a3;
const TMP = path.join(AQUI, "tmp");
fs.rmSync(TMP, { recursive: true, force: true });

// 1) quadros transparentes de cada evento
for (const [i, e] of EV.entries()) {
  const dir = path.join(TMP, `e${i}`);
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.ceil((e.fim - e.ini) * FPS);
  for (let f = 0; f <= n; f++) await shot(e.ini + f / FPS, path.join(dir, String(f).padStart(5, "0") + ".png"));
  console.log(`evento ${i} (${e.tipo}): ${n + 1} quadros`);
}
await browser.close();

// 2) efeitos sonoros sinteticos (sem depender de banco de sons)
const SFX = {
  pop: "0.7*sin(2*PI*(380+1500*t)*t)*exp(-22*t)",
  click: "0.8*(random(0)*2-1)*exp(-350*t)+0.6*sin(2*PI*1800*t)*exp(-90*t)",
  bell: "0.32*(sin(2*PI*1318.5*t)+0.55*sin(2*PI*2637*t)+0.25*sin(2*PI*3955*t))*exp(-3.2*t)",
};
const DUR = { pop: 0.18, click: 0.08, bell: 1.4 };
for (const [k, ex] of Object.entries(SFX)) ff(["-f", "lavfi", "-i", `aevalsrc=${ex}:s=44100:d=${DUR[k]}`, "-ac", "2", path.join(TMP, `${k}.wav`)]);
const sons = [];
for (const e of EV) {
  sons.push(["pop", e.ini]);
  if (e.tipo === "ig") sons.push(["click", e.ini + 1.4]);
  if (e.tipo === "yt") { for (const k of ["like", "share", "sub", "cmt"]) sons.push(["click", e[k]]); sons.push(["bell", e.sub + 0.12]); }
}

// 3) compor: video original + quadros (com atraso) + sons; video em alta qualidade, audio dela intacto + efeitos
const ins = ["-i", video];
let fc = "", base = "[0:v]";
EV.forEach((e, i) => {
  ins.push("-framerate", String(FPS), "-i", path.join(TMP, `e${i}`, "%05d.png"));
  fc += `[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${e.ini}/TB[o${i}];`;
  fc += `${base}[o${i}]overlay=0:0:eof_action=pass:enable='between(t,${e.ini},${e.fim})'[v${i}];`;
  base = `[v${i}]`;
});
const nV = EV.length + 1;
sons.forEach(([k], j) => ins.push("-i", path.join(TMP, `${k}.wav`)));
const VOL = { pop: 0.55, click: 0.7, bell: 0.45 };
sons.forEach(([k, t], j) => { const ms = Math.round(t * 1000); fc += `[${nV + j}:a]volume=${VOL[k]},adelay=${ms}|${ms}[s${j}];`; });
fc += `[0:a]${sons.map((_, j) => `[s${j}]`).join("")}amix=inputs=${sons.length + 1}:duration=first:normalize=0[aout]`;

fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
ff([...ins, "-filter_complex", fc, "-map", base, "-map", "[aout]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS),
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", saida]);
console.log("pronto:", saida);
