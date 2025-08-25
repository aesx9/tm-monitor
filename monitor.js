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
      const hasSoldOutText = bodyText && /agotado|sold out|no disponible/i.test(bodyText);

      // --- 1. Venta directa ---
      const buyButton = await page.$('button[data-qa="buy-tickets"], button:has-text("Comprar"), a:has-text("Comprar")');
      const isBuyEnabled = buyButton ? await buyButton.isEnabled() : false;
      const hasPrice = bodyText && /€\s?\d+/.test(bodyText);
      const hasQuantityField = await page.$('select[name="quantity"], input[name="quantity"]');

      const directAvailable = isBuyEnabled && hasPrice && hasQuantityField;

      // --- 2. Fan-to-Fan ---
      const fanToFanBlock = await page.$('section:has-text("Las entradas que han puesto a la venta otr
