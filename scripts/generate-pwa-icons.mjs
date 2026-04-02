/**
 * Gera os ícones PWA (192×192 e 512×512) a partir do calc-icon.svg
 * usando Puppeteer para renderização precisa.
 *
 * Uso: node scripts/generate-pwa-icons.mjs
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.resolve(__dirname, '../public/calc-icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Tamanhos a gerar
const SIZES = [192, 512];

async function generateIcons() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    for (const size of SIZES) {
        // Monta HTML mínimo com o SVG centralizado sem padding
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
    svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>${svgContent}</body>
</html>`;

        await page.setContent(html, { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 500)); // aguarda renderização
        await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });

        const outputPath = path.resolve(__dirname, `../public/pwa-${size}.png`);
        await page.screenshot({
            path: outputPath,
            clip: { x: 0, y: 0, width: size, height: size },
            omitBackground: false,
        });

        console.log(`✅ Gerado: pwa-${size}.png (${size}×${size}px)`);
    }

    await browser.close();
    console.log('\n🎉 Ícones PWA gerados com sucesso!');
}

generateIcons().catch(err => {
    console.error('❌ Erro ao gerar ícones:', err);
    process.exit(1);
});
