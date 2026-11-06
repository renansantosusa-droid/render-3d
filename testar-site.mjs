// Abre o protótipo da loja de roupinhas e testa a aba "Monta kit" passo a passo.
import fs from "node:fs";
import { chromium } from "playwright";
const URL_ = "https://brasildaturma.online/loja-teste/?u=turma.teste", OUT = "fotos-site";
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => m.type() === "error" && erros.push(m.text()));
const foto = (n, full) => pg.screenshot({ path: `${OUT}/${n}.png`, fullPage: !!full });
await pg.goto(URL_ + "&v=" + Date.now()); await pg.waitForTimeout(3000);
await pg.tap("#girar"); await pg.tap('[data-a="kit"]'); await pg.waitForTimeout(500); await foto("1-kit-vazio", true);
await pg.tap('[data-uf="PE"]'); await pg.waitForTimeout(400); await foto("2-so-camisa");
await pg.tap('[data-ac="coroa"]'); await pg.tap('[data-ac="oculos"]'); await pg.waitForTimeout(400);
await pg.tap('[data-aura="fogo"]'); await pg.waitForTimeout(1500); await foto("3-montado", true);
console.log("total:", await pg.textContent(".total"), "| carrinho:", await pg.textContent("#resumo"), await pg.textContent("#preco"));
console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erro de JavaScript");
await nav.close();
