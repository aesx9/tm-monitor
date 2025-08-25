import { chromium } from 'playwright';
import fetch from 'node-fetch';

const urls = [
  "https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/2082455188"
];

const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

if (!botToken || !chatId) {
  console.error("❌ Faltan BOT_TOKEN o CHAT_ID");
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
      console.log(`🔍 Revisando: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);

      const bodyText = await page.textContent('body');

      // --- 1. Comprobar si está "Entradas agotadas" ---
      const hasSoldOut = /entradas agotadas/i.test(bodyText);

      // --- 2. Fan-to-Fan ---
      let fanToFanAvailable = false;
      const fanToFanSection = await page.locator('section:has-text("Las entradas que han puesto a la venta otros fans")');
      if (await fanToFanSection.count() > 0) {
        const listings = await fanToFanSection.locator('li, div[role="listitem"]').count();
        fanToFanAvailable = listings > 0;
      }

      // --- 3. Venta directa ---
      const buyButton = await page.$('button:has-text("Comprar")');
      const isBuyEnabled = buyButton ? await buyButton.isEnabled() : false;
      const hasPrice = bodyText && /€\s?\d+/.test(bodyText);
      const directAvailable = isBuyEnabled && hasPrice;

      // --- Evaluación final ---
      if (hasSoldOut && !fanToFanAvailable && !directAvailable) {
        console.log(`❌ Entradas agotadas: ${url}`);
      } else if (fanToFanAvailable || directAvailable) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`ℹ️ No se detectan entradas en este momento: ${url}`);
      }

    } catch (error) {
      console.error(`⚠️ Error revisando ${url}:`, error.message);
    }
  }

  await browser.close();
}

checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});
