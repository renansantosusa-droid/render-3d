// Monta um criativo 1080x1920 a partir de <pasta>/spec.json (roda no GitHub Actions; nada de render no PC).
//   node montar-criativo.mjs <pasta>   -> <pasta>/final.mp4
// spec: { dur, voz:{arq, vel, atraso}, musica:{arq, vol},
//   segs: [ {de, ate, pix:{id, ini}} | {de, ate, img, modo:'cheio'|'esq'} ],      (cenas de fundo, coladas em sequência)
//   celular: {de, ate, x, y, rolaDe, rolaAte} (print do grupo rolando, entra e sai pela direita),
//   sobre: [ {png, de, ate, x, y, w, sobe} ] }                                     (textos/CTA/print por cima)
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { createRequire } from 'module';
const FF = process.env.FFMPEG || (() => { try { return createRequire(import.meta.url)('ffmpeg-static'); } catch { return 'ffmpeg'; } })();
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const P = path.resolve(process.argv[2]); const S = JSON.parse(fs.readFileSync(path.join(P, 'spec.json'), 'utf8'));
const PIX = JSON.parse(fs.readFileSync(path.join(AQUI, 'pixabay/escolhidos.json'), 'utf8'));
const T = path.join(P, 'tmp'); fs.mkdirSync(T, { recursive: true });
const ff = (args) => execFileSync(FF, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-an'];
const COBRE = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';

// 1) trechos do Pixabay
const cache = path.join(AQUI, 'pixabay', 'cache'); fs.mkdirSync(cache, { recursive: true });
for (const id of new Set(S.segs.filter((s) => s.pix).map((s) => s.pix.id))) {
  const f = path.join(cache, `${id}.mp4`);
  if (!fs.existsSync(f)) { const r = await fetch(PIX[id].url); if (!r.ok) throw new Error(`pixabay ${id}: ${r.status}`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
}
// 2) cada cena vira um mp4 com a duração exata
const lista = [];
S.segs.forEach((s, i) => {
  const d = +(s.ate - s.de).toFixed(3), out = path.join(T, `s${i}.mp4`);
  if (s.pix) ff(['-ss', String(s.pix.ini || 0), '-t', String(d), '-i', path.join(cache, `${s.pix.id}.mp4`), '-vf', `${COBRE},fps=30`, ...ENC, out]);
  else {
    const W = s.modo === 'esq' ? 520 : 960, cx = s.modo === 'esq' ? 280 : 540, cy = s.modo === 'esq' ? 900 : 900;
    ff(['-framerate', '30', '-loop', '1', '-t', String(d), '-i', path.join(AQUI, s.img), '-filter_complex',
      `[0]split[a][b];[a]${COBRE},boxblur=40:3,eq=brightness=-0.06:saturation=1.2[bg];` +
      `[b]scale=w='trunc(${W}*(1+0.07*t/${d})/2)*2':h=-2:eval=frame[fg];` +
      `[bg][fg]overlay=x='${cx}-overlay_w/2':y='${cy}-overlay_h/2':eval=frame,format=yuv420p`, ...ENC, out]);
  }
  lista.push(`file '${out.replace(/\\/g, '/')}'`);
});
fs.writeFileSync(path.join(T, 'lista.txt'), lista.join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(T, 'lista.txt'), '-c', 'copy', path.join(T, 'fundo.mp4')]);

// 3) por cima: celular com o chat rolando, textos, CTA; áudio = voz + música baixa
const D = S.dur, ent = ['-i', path.join(T, 'fundo.mp4'), '-i', path.join(P, S.voz.arq), '-i', path.join(AQUI, S.musica.arq)];
const img = (f) => { ent.push('-framerate', '30', '-loop', '1', '-t', String(D), '-i', path.join(AQUI, f)); return ent.filter((x) => x === '-i').length - 1; };
let fc = '', base = '0:v', n = 0;
const passo = () => `v${++n}`;
if (S.celular) {
  const c = S.celular, ic = img('pecas/chat.png'), im = img('pecas/mascara.png'), iF = img('pecas/celular.png');
  const maxY = Math.max(0, c.chatH - 900); // altura do pecas/chat.png (vai no spec)
  const yRola = `${maxY}*min(1,max(0,(t-${c.rolaDe})/${c.rolaAte - c.rolaDe}))`;
  const fora = 1080 - c.x, xs = `if(lt(t,${c.de + 0.3}),${c.x}+${fora}*(1-(t-${c.de})/0.3),if(lt(t,${c.ate - 0.3}),${c.x},${c.x}+${fora}*(t-${c.ate - 0.3})/0.3))`;
  const en = `between(t,${c.de},${c.ate})`;
  fc += `[${ic}]crop=470:900:0:'${yRola}',format=rgba[cc];[${im}]format=gray[mk];[cc][mk]alphamerge[cm];`;
  let a = passo(); fc += `[${base}][cm]overlay=x='${xs}+14':y=${c.y + 14}:enable='${en}'[${a}];`; base = a;
  a = passo(); fc += `[${base}][${iF}]overlay=x='${xs}':y=${c.y}:enable='${en}'[${a}];`; base = a;
}
for (const o of S.sobre || []) {
  const i = img(o.png), en = `between(t,${o.de},${o.ate})`, lbl = `p${n}`;
  fc += `[${i}]${o.w ? `scale=${o.w}:-2,` : ''}format=rgba[${lbl}];`;
  const y = o.sobe ? `if(lt(t,${o.de + 0.25}),${o.y}+300*(1-(t-${o.de})/0.25),${o.y})` : String(o.y);
  const x = o.x === 'c' ? '(main_w-overlay_w)/2' : String(o.x);
  const a = passo(); fc += `[${base}][${lbl}]overlay=x='${x}':y='${y}':enable='${en}'[${a}];`; base = a;
}
const atraso = Math.round((S.voz.atraso || 0) * 1000);
fc += `[1:a]atempo=${S.voz.vel || 1},adelay=${atraso}|${atraso},apad[vz];[2:a]volume=${S.musica.vol}[mu];[vz][mu]amix=inputs=2:duration=longest:normalize=0,atrim=0:${D},afade=t=out:st=${D - 0.4}:d=0.4[au]`;
ff([...ent, '-filter_complex', fc, '-map', `[${base}]`, '-map', '[au]', '-t', String(D), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(P, 'final.mp4')]);
fs.rmSync(T, { recursive: true, force: true });
console.log('ok', path.join(P, 'final.mp4'));
