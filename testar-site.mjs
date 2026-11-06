// Abre o protótipo da loja de roupinhas (brasildaturma.online/loja-teste/) num celular simulado e tira prints vestindo o boneco.
import fs from "node:fs";
import { chromium } from "playwright";
const URL_ = "https://brasildaturma.online/loja-teste/?u=turma.teste", OUT = "fotos-site";
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => m.type() === "error" && erros.push(m.text()));
await pg.goto(URL_); await pg.waitForTimeout(3000);
await pg.tap("#girar"); // para de girar (de frente)
await pg.screenshot({ path: `${OUT}/1-inicio.png` });
await pg.tap('[data-uf="SC"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `${OUT}/2-camisa-sc.png` });
await pg.tap('[data-a="acess"]'); await pg.tap('[data-ac="coroa"]'); await pg.tap('[data-ac="oculos"]'); await pg.tap('[data-ac="colar"]'); await pg.waitForTimeout(800);
await pg.screenshot({ path: `${OUT}/3-acessorios.png` });
await pg.tap('[data-ac="asas"]'); await pg.tap("#girar"); await pg.waitForTimeout(2600); await pg.screenshot({ path: `${OUT}/4-costas-asas.png` });
await pg.tap('[data-a="kit"]'); await pg.tap('[data-kit="PE,festa"]'); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${OUT}/5-kit.png` });
await pg.tap('[data-kit="RS,capa"]'); await pg.waitForTimeout(2000); await pg.screenshot({ path: `${OUT}/6-capa.png` });
await pg.tap("#comprar"); await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/7-pix.png` });
console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erro de JavaScript");
await nav.close();
