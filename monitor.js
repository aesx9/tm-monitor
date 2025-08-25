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
      
      // 1. Buscar texto indicativo de agotado en todo el body
      const bodyText = await page.textContent('body');
      const agotadoTexto = bodyText && /agotado|sold out|no disponible/i.test(bodyText);

      // 2. Verificar atributo data-active en el SVG de la sección "PISTA GENERAL"
      // Cambia selector si quieres otra sección
      const pistaGeneral = await page.$('path[data-section-name="PISTA GENERAL"]');
      let dataActive = null;
      if (pistaGeneral) {
        dataActive = await pistaGeneral.getAttribute('data-active');
      }

      // 3. Verificar botón de compra activo y habilitado
      const buyButton = await page.$('button[data-qa="buy-tickets"], button:has-text("Comprar"), a:has-text("Comprar")');
      const isBuyButtonEnabled = buyButton ? await buyButton.isEnabled() : false;

      // Decidir estado final combinando resultados para evitar falsos positivos
      if (agotadoTexto || dataActive === "false" || !isBuyButtonEnabled) {
        console.log(`❌ Entradas agotadas o no disponibles: ${url}`);
      } else if (dataActive === "true" && isBuyButtonEnabled) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        // Caso indeterminado, no anunciar disponibilidad
        console.log(`⚠️ Estado indeterminado: ${url}. Revisar manualmente.`);
      }

    } catch (error) {
      console.error(`Error revisando ${url}:`, error.message);
    }
  }
  await browser.close();
}

checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});
