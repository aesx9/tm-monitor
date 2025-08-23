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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const text = await page.textContent('body');

      if (text && /agotado/i.test(text)) {
        console.log(`❌ Entradas agotadas: ${url}`);
      } else {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);

        const msg = encodeURIComponent(`🎟️ ¡Entradas disponibles! ${url}`);
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${msg}`);
      }
    } catch (err) {
      console.error(`Error revisando ${url}:`, err);
    }
  }

  await browser.close();
}

checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});
