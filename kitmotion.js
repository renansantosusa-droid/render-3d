// Kit de MOTION DE NOTÍCIA (26/10/2026): canvas 2D puro, sem imagem. Base: anulacao.html.
// Uso numa página: import { motion } from "/kitmotion.js"; const K = await motion("<video>", TEMA); ... K.rodar(CENA)
// CENA = [null, (t) => {...cena 1...}, (t) => {...cena 2...}]  — cada função desenha a cena no instante t.
// P(cena, "palavra", k) = instante em que a palavra é dita (k = qual ocorrência). Todo evento sincroniza por ele.
export async function motion(video, tema = {}) {
  const TM = {
    fundo: "#0b1220", fundo2: "#121e35", padrao: "grade", destaque: "#ffd23a", alerta: "#ff4d4d",
    rotulo: "ELEIÇÕES 2026", rotuloCor: "#ff4d4d", sub: "• 2º TURNO", tag: "ENTENDA",
    fonte: "Oswald", fonteLeg: "Nunito", legenda: "contorno", palavras: 3, legY: 1500, transicao: "sobe", ...tema,
  };
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; document.body.appendChild(cv);
  const g = cv.getContext("2d");
  const T = await (await fetch(`/${video}/tempos.json`)).json(), CENAS = T.cenas;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const back = (k) => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const P = (c, w, k = 0) => { const cn = CENAS[c - 1]; const l = cn.palavras.filter((p) => norm(p.w) === norm(w)); if (!l.length) console.warn("palavra não achada", c, w); return (l[k] || l[0] || { t: cn.ini + .2 }).t; };
  const ini = (c) => CENAS[c - 1].ini;
  const ap = (t, t0, d = .35) => ease((t - t0) / d);
  const C = { AM: TM.destaque, VM: TM.alerta, BR: "#ffffff", CINZA: "#8a96ab", ESC: "#16223a", ESC2: "#2a3958", A1: "#f2b632", A2: "#4fb3c9", PAPEL: "#f4f1ea", TINTA: "#1b2436" };

  const rr = (x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
  function txt(s, x, y, tam, cor, { peso = 700, fonte = TM.fonte, al = "center", contorno = 0, sombra = false } = {}) {
    g.font = `${peso} ${tam}px ${fonte}`; g.textAlign = al; g.textBaseline = "middle";
    if (sombra) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(s, x + 4, y + 6); }
    if (contorno) { g.lineWidth = contorno; g.strokeStyle = "#000"; g.lineJoin = "round"; g.strokeText(s, x, y); }
    g.fillStyle = cor; g.fillText(s, x, y);
  }
  // texto que cabe na largura (diminui a fonte se precisar)
  function txtCabe(s, x, y, tam, cor, larg = 920, op = {}) { g.font = `${op.peso || 700} ${tam}px ${op.fonte || TM.fonte}`; const w = g.measureText(s).width; txt(s, x, y, w > larg ? Math.floor(tam * larg / w) : tam, cor, op); }
  function pilula(s, x, y, tam, fundo, cor = "#000", al = "center") {
    g.font = `700 ${tam}px ${TM.fonte}`; const w = g.measureText(s).width + tam * 1.1, h = tam * 1.55;
    const x0 = al === "center" ? x - w / 2 : x; rr(x0, y - h / 2, w, h, h / 2, fundo); txt(s, x0 + w / 2, y + 2, tam, cor); return w;
  }
  function pop(k, x, y, f) { if (k <= 0) return; g.save(); g.globalAlpha *= clamp(k * 1.6); g.translate(x, y); const s = back(k); g.scale(s, s); g.translate(-x, -y); f(); g.restore(); }
  function desliza(k, dx, dy, f) { if (k <= 0) return; g.save(); g.globalAlpha *= clamp(k * 1.4); g.translate(dx * (1 - ease(k)), dy * (1 - ease(k))); f(); g.restore(); }
  function carimbo(s, x, y, k, cor = C.VM, giro = -.12, tam = 92) {
    if (k <= 0) return; g.save(); g.translate(x, y); g.rotate(giro); const s2 = 1 + 1.4 * (1 - ease(k)); g.scale(s2, s2); g.globalAlpha *= clamp(k * 2);
    g.font = `700 ${tam}px ${TM.fonte}`; const w = g.measureText(s).width + 60, h = tam * 1.4;
    g.lineWidth = 10; g.strokeStyle = cor; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 18); g.stroke(); txt(s, 0, 4, tam, cor); g.restore();
  }
  // número contando até o valor
  const conta = (t, t0, alvo, d = 1.2) => Math.round(alvo * ease((t - t0) / d));

  // ---------- ícones ----------
  function relogio(x, y, r, horas, cor = C.AM) {
    circ(x, y, r + 18, "rgba(255,255,255,.08)"); circ(x, y, r, "#f4f1ea"); circ(x, y, r - 14, "#ffffff");
    g.strokeStyle = C.TINTA; for (let i = 0; i < 60; i++) { const a = i / 60 * 6.2832, l = i % 5 ? 14 : 34; g.lineWidth = i % 5 ? 3 : 8; g.beginPath(); g.moveTo(x + Math.sin(a) * (r - 22), y - Math.cos(a) * (r - 22)); g.lineTo(x + Math.sin(a) * (r - 22 - l), y - Math.cos(a) * (r - 22 - l)); g.stroke(); }
    const ah = (horas % 12) / 12 * 6.2832, am = (horas % 1) * 6.2832;
    g.lineCap = "round"; g.strokeStyle = C.TINTA; g.lineWidth = r * .07; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(ah) * r * .5, y - Math.cos(ah) * r * .5); g.stroke();
    g.lineWidth = r * .045; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(am) * r * .74, y - Math.cos(am) * r * .74); g.stroke();
    circ(x, y, r * .07, cor);
  }
  // relógio digital (variação)
  function digital(x, y, horas, cor = C.AM) {
    rr(x - 300, y - 120, 600, 240, 30, "#05080f"); rr(x - 286, y - 106, 572, 212, 22, "#0e1626");
    const h = Math.floor(horas), m = Math.floor((horas % 1) * 60);
    txt(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, x, y + 8, 170, cor, { fonte: "Oswald" });
  }
  function urna(x, y, s = 1, fechada = 0) {
    g.save(); g.translate(x, y); g.scale(s, s);
    rr(-120, -80, 240, 170, 22, fechada ? "#9aa1ad" : "#efe7d3"); rr(-120, 60, 240, 30, 12, "rgba(0,0,0,.12)");
    rr(-92, -58, 110, 74, 10, fechada ? "#3c4452" : "#2c6e8f");
    if (!fechada) { rr(-82, -48, 90, 14, 4, "rgba(255,255,255,.55)"); rr(-82, -26, 60, 10, 4, "rgba(255,255,255,.35)"); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) rr(36 + i * 22, -58 + j * 22, 16, 16, 4, fechada ? "#6b7280" : "#2b2b2b");
    rr(36, 32, 60, 18, 5, fechada ? "#6b7280" : "#2fa84f");
    if (fechada) { g.globalAlpha *= clamp(fechada); rr(-34, -10, 68, 56, 10, "#ffd23a"); g.lineWidth = 12; g.strokeStyle = "#ffd23a"; g.beginPath(); g.arc(0, -10, 22, Math.PI, 0); g.stroke(); circ(0, 16, 8, "#7a5a00"); }
    g.restore();
  }
  function onibus(x, y, cor = C.A1) {
    rr(x - 130, y - 70, 260, 130, 22, cor); rr(x - 112, y - 54, 70, 50, 8, "#bfe3f2"); rr(x - 30, y - 54, 70, 50, 8, "#bfe3f2"); rr(x + 52, y - 54, 60, 50, 8, "#bfe3f2");
    rr(x - 130, y + 14, 260, 10, 4, "rgba(0,0,0,.18)"); circ(x - 74, y + 62, 24, C.TINTA); circ(x + 74, y + 62, 24, C.TINTA); circ(x - 74, y + 62, 10, "#9aa1ad"); circ(x + 74, y + 62, 10, "#9aa1ad");
  }
  function nuvem(x, y, t) {
    for (let i = 0; i < 9; i++) { const dx = -90 + i * 22, ph = (t * 1.6 + i * .37) % 1; g.strokeStyle = "rgba(120,190,255,.9)"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(x + dx, y + 30 + ph * 90); g.lineTo(x + dx - 6, y + 52 + ph * 90); g.stroke(); }
    circ(x - 60, y, 50, "#cfd6e3"); circ(x, y - 24, 66, "#dfe5ee"); circ(x + 62, y + 2, 48, "#cfd6e3"); rr(x - 110, y, 220, 50, 25, "#d6dce8");
  }
  function balanca(x, y, s, incl, cor = "#e8c66a") {
    g.save(); g.translate(x, y); g.scale(s, s);
    rr(-10, -170, 20, 260, 8, cor); rr(-90, 80, 180, 26, 10, cor); circ(0, -176, 20, cor);
    g.rotate(incl); rr(-220, -180, 440, 14, 7, cor);
    for (const sx of [-1, 1]) { g.save(); g.translate(sx * 205, -173); g.rotate(-incl); g.strokeStyle = cor; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(-62, 120); g.moveTo(0, 0); g.lineTo(62, 120); g.stroke(); g.fillStyle = cor; g.beginPath(); g.ellipse(0, 122, 78, 20, 0, 0, Math.PI); g.fill(); g.restore(); }
    g.restore();
  }
  function martelo(x, y, s, giro) {
    g.save(); g.translate(x, y); g.scale(s, s); rr(-160, 110, 320, 46, 14, "#7a4b2a"); g.rotate(giro);
    rr(-20, -40, 40, 240, 14, "#a0663a"); g.save(); g.translate(0, -60); rr(-110, -50, 220, 100, 30, "#8a5530"); rr(-120, -36, 26, 72, 10, "#e8c66a"); rr(94, -36, 26, 72, 10, "#e8c66a"); g.restore(); g.restore();
  }
  function papel(x, y, w, h) {
    g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 30; rr(x, y, w, h, 14, "#f7f5ef"); g.restore();
    for (let i = 0; i < 9; i++) rr(x + 50, y + 170 + i * 52, (w - 100) * (i % 3 === 2 ? .6 : 1), 14, 7, "#d9d4c7");
  }
  function balao(x, y, w, h, cor) { rr(x, y, w, h, 30, cor); g.fillStyle = cor; g.beginPath(); g.moveTo(x + 70, y + h - 2); g.lineTo(x + 60, y + h + 46); g.lineTo(x + 130, y + h - 2); g.fill(); }
  // plenário em meia-lua: n cadeiras, as primeiras "pintadas" ficam com a cor (k = 0..1 do quanto já pintou)
  function plenario(x, y, raio, n, pintadas, cor, k = 1, base = "#33405a", linhas = 9) {
    const pos = []; for (let l = 0; l < linhas; l++) { const r = raio * (.42 + .58 * l / (linhas - 1)); const q = Math.round(n * r / (raio * linhas * .71)); for (let i = 0; i < q; i++) { const a = Math.PI * (i + .5) / q; pos.push({ x: x - Math.cos(a) * r, y: y - Math.sin(a) * r, a }); } }
    pos.sort((p, q) => p.a - q.a); const tot = pos.length, pint = Math.round(pintadas / n * tot * clamp(k)), rd = raio * .028;
    pos.forEach((p, i) => circ(p.x, p.y, rd, i < pint ? cor : base));
  }
  // barra de meta: valor / meta, com marca da meta
  function barraMeta(x, y, w, valor, meta, maximo, cor, k = 1) {
    rr(x, y, w, 70, 35, C.ESC); rr(x, y, Math.max(70, w * valor / maximo * clamp(k)), 70, 35, cor);
    const mx = x + w * meta / maximo; rr(mx - 4, y - 30, 8, 130, 4, "#ffffff"); txt(String(meta), mx, y - 58, 46, "#ffffff");
  }
  function congresso(x, y, s = 1, cor = "#e9edf3") {
    g.save(); g.translate(x, y); g.scale(s, s);
    rr(-420, 60, 840, 40, 6, cor); rr(-40, -260, 34, 320, 4, cor); rr(10, -260, 34, 320, 4, cor);
    g.fillStyle = cor; g.beginPath(); g.ellipse(-230, 60, 150, 80, 0, Math.PI, 0); g.fill(); // cúpula (Senado)
    g.beginPath(); g.moveTo(80, 60); g.quadraticCurveTo(230, -60, 380, 60); g.lineTo(360, 60); g.quadraticCurveTo(230, -30, 100, 60); g.fill(); // tigela (Câmara)
    g.restore();
  }
  function bandeiraEUA(x, y, w, h, t = 0) {
    g.save(); g.translate(x, y);
    for (let i = 0; i < 13; i++) { const yy = i * h / 13; g.fillStyle = i % 2 ? "#ffffff" : "#c8323a"; g.beginPath(); for (let xx = 0; xx <= w; xx += 20) { const o = Math.sin(xx / 70 - t * 3) * 8; xx ? g.lineTo(xx, yy + o) : g.moveTo(xx, yy + o); } for (let xx = w; xx >= 0; xx -= 20) g.lineTo(xx, yy + h / 13 + Math.sin(xx / 70 - t * 3) * 8 + 1); g.fill(); }
    rr(0, -2 + Math.sin(-t * 3) * 8, w * .42, h * 7 / 13, 2, "#2b3f7a");
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) circ(w * .05 + i * w * .08, h * .07 + j * h * .12 + Math.sin(-t * 3) * 8, 6, "#fff");
    g.restore();
  }
  function bandeiraBR(x, y, w, h) {
    rr(x, y, w, h, 6, "#1f9d55"); g.fillStyle = "#ffd23a"; g.beginPath(); g.moveTo(x + w / 2, y + h * .08); g.lineTo(x + w * .94, y + h / 2); g.lineTo(x + w / 2, y + h * .92); g.lineTo(x + w * .06, y + h / 2); g.fill();
    circ(x + w / 2, y + h / 2, h * .26, "#2b3f9a"); g.strokeStyle = "#fff"; g.lineWidth = h * .035; g.beginPath(); g.arc(x + w / 2 + h * .05, y + h * .78, h * .42, Math.PI * 1.2, Math.PI * 1.65); g.stroke();
  }
  function jato(x, y, s, giro = 0, cor = "#c9d1dc") {
    g.save(); g.translate(x, y); g.rotate(giro); g.scale(s, s); g.fillStyle = cor;
    g.beginPath(); g.moveTo(120, 0); g.lineTo(-80, -14); g.lineTo(-100, 0); g.lineTo(-80, 14); g.fill();
    g.beginPath(); g.moveTo(20, 0); g.lineTo(-40, -90); g.lineTo(-60, -90); g.lineTo(-30, 0); g.lineTo(-60, 90); g.lineTo(-40, 90); g.fill();
    g.beginPath(); g.moveTo(-70, 0); g.lineTo(-100, -40); g.lineTo(-110, -40); g.lineTo(-95, 0); g.lineTo(-110, 40); g.lineTo(-100, 40); g.fill(); g.restore();
  }
  function alvo(x, y, r, t) { for (let i = 3; i >= 1; i--) { g.strokeStyle = i % 2 ? C.VM : "#ffffff"; g.lineWidth = 10; g.beginPath(); g.arc(x, y, r * i / 3, 0, 6.2832); g.stroke(); } g.strokeStyle = C.VM; g.lineWidth = 6; g.beginPath(); g.moveTo(x - r * 1.25, y); g.lineTo(x + r * 1.25, y); g.moveTo(x, y - r * 1.25); g.lineTo(x, y + r * 1.25); g.stroke(); circ(x, y, 10 + Math.sin(t * 8) * 3, C.VM); }
  function predioBranco(x, y, s = 1) { // Casa Branca simplificada
    g.save(); g.translate(x, y); g.scale(s, s); rr(-300, -60, 600, 160, 4, "#eef1f5"); rr(-110, -150, 220, 250, 4, "#ffffff");
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(-130, -150); g.lineTo(0, -220); g.lineTo(130, -150); g.fill();
    for (let i = 0; i < 6; i++) rr(-95 + i * 36, -130, 16, 220, 6, "#d5dbe4"); for (let i = 0; i < 4; i++) { rr(-270 + i * 40, -30, 22, 40, 3, "#9fb0c6"); rr(170 + i * 30, -30, 22, 40, 3, "#9fb0c6"); }
    rr(-320, 100, 640, 16, 4, "#c9d1dc"); g.restore();
  }
  function cifrao(x, y, tam, cor) { txt("$", x, y, tam, cor, { contorno: 8 }); }
  function seta(x0, y0, x1, y1, cor, k = 1, larg = 14) {
    const xe = x0 + (x1 - x0) * clamp(k), ye = y0 + (y1 - y0) * clamp(k); g.strokeStyle = cor; g.lineWidth = larg; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(xe, ye); g.stroke();
    if (k > .05) { const a = Math.atan2(y1 - y0, x1 - x0); g.fillStyle = cor; g.beginPath(); g.moveTo(xe + Math.cos(a) * 30, ye + Math.sin(a) * 30); g.lineTo(xe + Math.cos(a + 2.4) * 34, ye + Math.sin(a + 2.4) * 34); g.lineTo(xe + Math.cos(a - 2.4) * 34, ye + Math.sin(a - 2.4) * 34); g.fill(); }
  }
  function grade(lista, t, kAbre, kDuvida, cor = "#32d26f") {
    for (const q of lista) {
      const k = q.aberta ? clamp((kAbre - q.d * .5) * 2) : 0;
      g.globalAlpha = 1; rr(q.x - q.w / 2, q.y - q.h / 2, q.w, q.h, 12, "#3a4458");
      if (k > 0) { g.globalAlpha = k; rr(q.x - q.w / 2, q.y - q.h / 2, q.w, q.h, 12, cor); g.globalAlpha = 1; }
      if (q.aberta && kDuvida > 0) { g.globalAlpha = clamp((kDuvida - q.d * .4) * 2); txt("?", q.x, q.y + 2, q.h * .8, C.AM, { contorno: 6 }); g.globalAlpha = 1; }
    }
  }
  function secoes(seed, linhas, cols, x0, y0, dx, dy, w, h, prob = .36) { let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const l = []; for (let i = 0; i < linhas; i++) for (let j = 0; j < cols; j++) l.push({ x: x0 + j * dx, y: y0 + i * dy, w, h, aberta: rnd() < prob, d: rnd() }); return l; }

  // ---------- moldura, fundo, legenda ----------
  const GRUPOS = []; for (const cn of CENAS) for (let i = 0; i < cn.palavras.length; i += TM.palavras) GRUPOS.push({ ws: cn.palavras.slice(i, i + TM.palavras), fim: (cn.palavras[i + TM.palavras] || { t: cn.fim + .15 }).t });
  function legenda(t) {
    const gr = GRUPOS.find((x) => t >= x.ws[0].t && t < x.fim); if (!gr) return;
    const ws = gr.ws.map((p) => p.w.toUpperCase().replace(/[.,!?;:]+$/, "")); let tam = 76; const f = (n) => `900 ${n}px ${TM.fonteLeg}`; g.font = f(tam);
    let lw = ws.map((w) => g.measureText(w).width), esp = 22; const larg = () => lw.reduce((a, b) => a + b, 0) + esp * (ws.length - 1);
    if (larg() > 920) { tam = Math.floor(tam * 920 / larg()); g.font = f(tam); lw = ws.map((w) => g.measureText(w).width); esp = 18; }
    const tot = larg(), k = ease((t - gr.ws[0].t) / .12), y = TM.legY + (1 - k) * 20; let x = W / 2 - tot / 2;
    if (TM.legenda === "caixa") { g.globalAlpha = k * .9; rr(x - 30, y - tam * .75, tot + 60, tam * 1.5, 18, "#000"); g.globalAlpha = 1; }
    ws.forEach((w, i) => { const ativa = t >= gr.ws[i].t && (i === ws.length - 1 || t < gr.ws[i + 1].t);
      g.textAlign = "left"; g.textBaseline = "middle"; g.globalAlpha = k;
      if (TM.legenda === "caixa" && ativa) { rr(x - 8, y - tam * .6, lw[i] + 16, tam * 1.2, 10, C.AM); g.fillStyle = "#000"; g.fillText(w, x, y + 2); }
      else { if (TM.legenda !== "caixa") { g.lineWidth = 12; g.lineJoin = "round"; g.strokeStyle = "#000"; g.strokeText(w, x, y); } g.fillStyle = ativa && TM.legenda !== "caixa" ? C.AM : "#fff"; g.fillText(w, x, y + 2); }
      g.globalAlpha = 1; x += lw[i] + esp; });
  }
  function fundo(t) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, TM.fundo); gr.addColorStop(1, TM.fundo2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.04)"; g.fillStyle = "rgba(255,255,255,.06)"; g.lineWidth = 2;
    if (TM.padrao === "grade") { const off = (t * 18) % 90; for (let x = -90 + off; x < W; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = -90 + off; y < H; y += 90) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (TM.padrao === "pontos") { const off = (t * 12) % 60; for (let x = 0; x < W + 60; x += 60) for (let y = -60 + off; y < H; y += 60) { g.beginPath(); g.arc(x, y, 3, 0, 6.2832); g.fill(); } }
    if (TM.padrao === "diagonal") { const off = (t * 30) % 120; g.lineWidth = 26; g.strokeStyle = "rgba(255,255,255,.025)"; for (let x = -H + off; x < W + H; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); } }
    if (TM.padrao === "radar") { for (let r = 200; r < 1400; r += 160) { g.beginPath(); g.arc(W / 2, H * .42, r + (t * 40) % 160, 0, 6.2832); g.stroke(); } }
    const v = g.createRadialGradient(W / 2, H * .45, H * .2, W / 2, H * .5, H * .8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function moldura(t) {
    const w = pilula(TM.rotulo, 90, 170, 44, TM.rotuloCor, "#fff", "left"); txt(TM.sub, 90 + w + 24, 172, 44, "#fff", { al: "left", peso: 500 });
    txt(TM.tag, 990, 172, 34, C.AM, { al: "right" });
    rr(90, 230, 900, 8, 4, "rgba(255,255,255,.12)"); rr(90, 230, 900 * clamp(t / T.total), 8, 4, C.AM);
    txt("@comofuncionatalcoisa", W / 2, 1800, 40, "rgba(255,255,255,.8)", { peso: 500 });
  }
  function rodar(CENA) {
    window.renderFrame = (t) => {
      fundo(t);
      let c = 1; for (let i = 0; i < CENAS.length; i++) if (t >= CENAS[i].ini - .1) c = i + 1;
      const k = c === 1 ? 1 : ease((t - (CENAS[c - 1].ini - .1)) / .3);
      g.save(); g.globalAlpha = k;
      if (TM.transicao === "zoom") { const s = .92 + .08 * k; g.translate(W / 2, H * .45); g.scale(s, s); g.translate(-W / 2, -H * .45); }
      else if (TM.transicao === "lado") g.translate((1 - k) * 80, 0); else g.translate(0, (1 - k) * 40);
      CENA[c](t); g.restore(); moldura(t); legenda(t);
    };
    return (async () => {
      for (const f of ["700 40px Oswald", "500 40px Oswald", `900 40px ${TM.fonteLeg}`, `400 40px ${TM.fonte}`]) await document.fonts.load(f).catch(() => {});
      await document.fonts.ready; window.renderFrame(0); window.pronto = true;
    })();
  }
  return { W, H, g, T, CENAS, P, ini, ap, ease, back, clamp, conta, C, TM, rr, circ, txt, txtCabe, pilula, pop, desliza, carimbo, relogio, digital, urna, onibus, nuvem, balanca, martelo, papel, balao, plenario, barraMeta, congresso, bandeiraEUA, bandeiraBR, jato, alvo, predioBranco, cifrao, seta, grade, secoes, rodar };
}
