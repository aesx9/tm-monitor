import { chromium } from 'playwright';
import fetch from 'node-fetch';

const urls = [
  "https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/2082455188",
  "https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/377280266"
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

  let index = 1;
  for (const url of urls) {
    try {
      console.log(`\n🔍 [${index}/${urls.length}] Revisando: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);

      // --- 1. Agotado ---
      const soldOut = await page.locator('text="Entradas agotadas"').count() > 0;

      // --- 2. Fan-to-Fan ---
      let fanToFanAvailable = false;
      const fanToFanSection = page.locator('section:has-text("Las entradas que han puesto a la venta otros fans")');
      if (await fanToFanSection.count() > 0) {
        const listings = await fanToFanSection.locator('li, div[role="listitem"]').count();
        fanToFanAvailable = listings > 0;
      }

      // --- 3. Venta directa ---
      let directAvailable = false;
      const buyButton = page.locator('button:has-text("Comprar")');
      if (await buyButton.count() > 0) {
        const enabled = await buyButton.first().isEnabled();
        const hasPrice = await page.locator('span:has-text("€")').count() > 0;
        directAvailable = enabled && hasPrice;
      }

      // --- Evaluación final ---
      if (soldOut && !fanToFanAvailable && !directAvailable) {
        console.log(`❌ [${index}] Entradas agotadas: ${url}`);
      } else if (fanToFanAvailable || directAvailable) {
        console.log(`🎟️ [${index}] ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`ℹ️ [${index}] No se detectan entradas en este momento: ${url}`);
      }

    } catch (error) {
      console.error(`⚠️ [${index}] Error revisando ${url}:`, error.message);
    }
    index++;
  }

  await browser.close();
}

checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});
