// Abre o protótipo da loja de roupinhas (brasildaturma.online/loja-teste/) num celular simulado e tira prints vestindo o boneco.
import fs from "node:fs";
import { chromium } from "playwright";
const URL_ = "https://brasildaturma.online/loja-teste/?u=turma.teste", OUT = "fotos-site";
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => m.type() === "error" && erros.push(m.text()));
const foto = (n) => pg.screenshot({ path: `${OUT}/${n}.png` });
await pg.goto(URL_ + "&v=" + Date.now()); await pg.waitForTimeout(3000);
await pg.tap("#girar");
await pg.tap('[data-a="aura"]'); await pg.tap('[data-aura="ouro"]'); await pg.waitForTimeout(1200); await foto("1-aura-ouro");
await pg.tap('[data-aura="fogo"]'); await pg.waitForTimeout(1700); await foto("2-aura-fogo");
await pg.tap('[data-a="kit"]'); await pg.tap('[data-kit="BA,asas,arco"]'); await pg.waitForTimeout(1300); await foto("3-kit-arco");
await pg.tap('[data-kit="RS,capa,"]'); await pg.tap("#girar"); await pg.waitForTimeout(2600); await foto("4-capa");
console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erro de JavaScript");
await nav.close();
