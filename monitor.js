import { chromium } from 'playwright';
import fetch from 'node-fetch';

const urls = [
  "https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/2082455188"
];

const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

if (!botToken || !chatId) {
  console.error("Faltan BOT_TOKEN o CHAT_ID");
  process.exit(1);
}

async function checkTickets() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  for (const url of urls) {
    try {
      console.log(`Revisando: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);

      // 1. Comprobación de texto en la página
      const text = await page.textContent('body');
      const agotado = text && /agotado|sold out|no disponible/i.test(text);

      // 2. Comprobación del atributo data-active en SVG para "PISTA GENERAL" o secciones relevantes
      // Si necesitas otra sección, cambia el [data-section-name]
      const pistaGeneral = await page.$('path[data-section-name="PISTA GENERAL"]');
      let pistaActive = null;
      if (pistaGeneral) {
        pistaActive = await pistaGeneral.getAttribute('data-active');
      }

      if (agotado || pistaActive === "false") {
        console.log(`❌ Entradas agotadas o sección no disponible: ${url}`);
      } else if (pistaActive === "true" || !agotado) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`⚠️ Estado indeterminado: ${url}`);
      }

    } catch (err) {
      console.error(`Error revisando ${url}:`, err.message);
    }
  }
  await browser.close();
}

checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});

