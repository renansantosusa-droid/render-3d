// Kit comum das cenas 3D (a partir de 18/10): tempo das palavras, câmera, luz, texturas, partículas e visor.
//   const K = await iniciar("<video>", { fundo: 0x9cc8ea });  ...  K.pronto(quadro)
import * as THREE from "three";
import { montarLegenda } from "/legenda.js";
export { THREE };

export async function iniciar(video, { fundo = 0x9cc8ea, seed = 7, fov = 36 } = {}) {
  const TEMPOS = await (await fetch(`/${video}/tempos.json`)).json();
  const W = 1080, H = 1920;
  const rnd = (() => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const prog = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
  const lin = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const pulse = (t, a, d = .35) => { const k = (t - a) / d; return k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI); };
  const entre = (t, a, b) => t >= a && t < b;
  const frac = (x) => x - Math.floor(x);
  const CENA = (n) => TEMPOS.cenas[n - 1];
  const C = (n) => CENA(n).ini, F = (n) => CENA(n).fim;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  function P(n, palavra, ocorr = 1) { let k = 0; for (const p of CENA(n).palavras) if (norm(p.w) === norm(palavra) && ++k === ocorr) return p.t; console.error("palavra nao achada", n, palavra); return CENA(n).ini; }

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(fundo);
  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.02, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6a5a, 1.3));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(4, 10, 8); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 50 }); scene.add(sol);

  function tex(size, draw, r = 1) { const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(r, r); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const texMancha = tex(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const grade = (fundo, linha, passo, r) => tex(256, (g, s) => { g.fillStyle = fundo; g.fillRect(0, 0, s, s); g.strokeStyle = linha; g.lineWidth = 3; for (let i = 0; i <= s; i += passo) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }, r);
  const texMadeira = (cor = "#a8763e", r = 1) => tex(256, (g, s) => { g.fillStyle = cor; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(60,30,10,${.08 + rnd() * .15})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); const y = rnd() * s; g.moveTo(0, y); g.bezierCurveTo(s * .3, y + rnd() * 10 - 5, s * .6, y + rnd() * 10 - 5, s, y); g.stroke(); } }, r);
  const texRuido = (cor, var_ = 30, r = 1) => tex(256, (g, s) => { g.fillStyle = cor; g.fillRect(0, 0, s, s); for (let i = 0; i < 2500; i++) { const v = (rnd() - .5) * var_; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 2 + rnd() * 3); } }, r);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o });
  const vidro = (op = .2, c = 0xffffff) => new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: op, roughness: .05, side: THREE.DoubleSide, depthWrite: false });
  const brilho = (c) => new THREE.MeshBasicMaterial({ color: c });
  function add(geo, m, x = 0, y = 0, z = 0, pai = scene) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; pai.add(me); return me; }
  const grupo = (x = 0, y = 0, z = 0, pai = scene) => { const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g); return g; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sprite = (cor, pai = scene) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMancha, color: cor, transparent: true, opacity: 0, depthWrite: false })); pai.add(s); return s; };
  // texto solto no mundo (placa, etiqueta, ?)
  function rotulo(txt, cor = "#fff", { fundo = null, w = 512, h = 256, tam = 150 } = {}) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); if (fundo) { g.fillStyle = fundo; g.fillRect(0, 0, w, h); } g.fillStyle = cor; g.font = `900 ${tam}px Nunito, Arial`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, w / 2, h / 2 + 6); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  // partículas correndo por uma curva: f.atualiza(t, ligado, velocidade, tamanho)
  function fluxo(curva, n, cor, pai = scene) { const ps = Array.from({ length: n }, () => ({ s: sprite(cor, pai), f: rnd() })); return { ps, atualiza(t, on, vel = .5, tam = .05, op = 1) { for (const p of ps) { const k = frac(t * vel + p.f); p.s.position.copy(curva.getPoint(k)); p.s.scale.setScalar(tam); p.s.material.opacity = on ? op * Math.min(1, Math.sin(k * Math.PI) * 4) : 0; } } }; }
  // visor de texto na tela (canto de cima)
  function visor() { const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d"); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 10; scene.add(s); s.visible = false; let ult = ""; s.set = (txt, cor = "#fff") => { if (txt + cor === ult) return; ult = txt + cor; g.clearRect(0, 0, 512, 256); g.fillStyle = "rgba(15,20,28,.88)"; g.beginPath(); g.roundRect(8, 8, 496, 240, 40); g.fill(); g.fillStyle = cor; let tam = 120; do { g.font = `900 ${tam}px Nunito, Arial, sans-serif`; tam -= 4; } while (g.measureText(txt).width > 440); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 132); t.needsUpdate = true; }; return s; }
  const visorT = visor();
  const fw = new THREE.Vector3(), upv = new THREE.Vector3();
  function naTela(v, fracY = .62, fracW = .5) { camera.getWorldDirection(fw); upv.copy(camera.up).applyQuaternion(camera.quaternion); const d = .3, hh = d * Math.tan(fov / 2 * Math.PI / 180); v.position.copy(camera.position).addScaledVector(fw, d).addScaledVector(upv, hh * fracY); const w = fracW * 2 * hh * (W / H); v.scale.set(w, w / 2, 1); }
  // cartões: [[ini, fim, "TEXTO", "#cor"], ...]
  function cartoes(t, lista) { let a = null; for (const c of lista) if (entre(t, c[0], c[1])) a = c; visorT.visible = !!a; if (a) { visorT.set(a[2], a[3] || "#fff"); naTela(visorT); } }

  // câmera: VISTAS {nome: [pos, alvo]}; KEYS [[t, nome], ...] (corte seco = duas chaves coladas)
  let VISTAS = {}, KEYS = [];
  const camera_ = (vistas, keys) => { VISTAS = vistas; KEYS = keys; };
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();
  function moverCamera(t) { let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++; const [ta, va] = KEYS[i], [tb, vb] = KEYS[i + 1]; const k = tb > ta ? ease(clamp((t - ta) / (tb - ta), 0, 1)) : 1; tmpP.lerpVectors(VISTAS[va][0], VISTAS[vb][0], k); tmpT.lerpVectors(VISTAS[va][1], VISTAS[vb][1], k); tmpP.x += Math.sin(t * .4) * .01; tmpP.y += Math.sin(t * .31) * .006; camera.position.copy(tmpP); camera.lookAt(tmpT); camera.updateMatrixWorld(); }

  const legenda = montarLegenda(TEMPOS.cenas.flatMap((c) => c.palavras.map((p) => [(p.w.charAt(0).toUpperCase() + p.w.slice(1)).replace(/[.,!?;:"]+$/, ""), p.t])));
  async function pronto(quadro) {
    window.renderFrame = (t) => { moverCamera(t); quadro(t); legenda(t); renderer.render(scene, camera); };
    await document.fonts.load("900 40px Nunito"); await document.fonts.ready;
    window.renderFrame(0); window.pronto = true;
  }
  return { THREE, TEMPOS, scene, camera, renderer, sol, rnd, clamp, ease, prog, lin, pulse, entre, frac, C, F, P, T: TEMPOS.total,
    tex, texMancha, grade, texMadeira, texRuido, mat, vidro, brilho, add, grupo, V, sprite, rotulo, fluxo, visor, naTela, cartoes, camera_, pronto };
}
