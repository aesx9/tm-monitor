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

// Selectores específicos para TicketMaster basados en tu descubrimiento
const SELECTORS = {
  SOLD_OUT: [
    // Selector específico que encontraste
    '#list-view > div > div > div:nth-child(1) > div > span.sc-8d81336a-2.ehCrGE',
    // Selectores alternativos comunes en TicketMaster
    '[data-testid="sold-out-badge"]',
    '.icon-not-available',
    '.button-disabled',
    '.sold-out-text',
    'div[class*="soldout"]',
    'div[class*="unavailable"]',
    // Selectores por texto (XPath)
    '//span[contains(text(), "Agotado")]',
    '//span[contains(text(), "Sold Out")]',
    '//span[contains(text(), "No hay suficientes entradas")]',
    '//span[contains(text(), "No disponible")]'
  ],
  AVAILABLE: [
    // Selectores para botones de compra activos
    '[data-testid="buy-button"]:not([disabled])',
    '.button-buy:not([disabled])',
    '.purchase-button:not([disabled])',
    'button[class*="buy"]:not([disabled])',
    'a[class*="buy"]:not([disabled])',
    // Selectores por texto (XPath)
    '//button[contains(text(), "Comprar")]',
    '//button[contains(text(), "Buy")]',
    '//a[contains(text(), "Comprar")]',
    '//a[contains(text(), "Buy")]',
    '//span[contains(text(), "Seleccionar")]'
  ]
};

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

      // -------- Comprobación AGOTADO --------
      let isSoldOut = false;
      for (const selector of SELECTORS.SOLD_OUT) {
        try {
          const element = selector.startsWith('//')
            ? await page.$(`xpath=${selector}`)
            : await page.$(selector);
          if (element) {
            const text = await element.textContent();
            console.log(`Encontrado selector de agotado: ${selector} - Texto: "${text ? text.trim() : ''}"`);
            isSoldOut = true;
            break;
          }
        } catch (err) {
          // Ignorar errores
        }
      }

      // -------- Comprobación DISPONIBLE --------
      let isAvailable = false;
      if (!isSoldOut) {
        for (const selector of SELECTORS.AVAILABLE) {
          try {
            const element = selector.startsWith('//')
              ? await page.$(`xpath=${selector}`)
              : await page.$(selector);
            if (element) {
              const isVisible = await element.isVisible();
              const isDisabled = await element.getAttribute('disabled');
              const ariaDisabled = await element.getAttribute('aria-disabled');
              const text = await element.textContent();

              // Reglas para evitar falsos positivos: visible, no deshabilitado, texto correcto
              if (
                isVisible &&
                !isDisabled &&
                (!ariaDisabled || ariaDisabled === "false") &&
                text &&
                !text.toLowerCase().includes("no disponible") &&
                !text.toLowerCase().includes("agotado")
              ) {
                console.log(`Encontrado selector disponible: ${selector} - Texto: "${text.trim()}"`);
                isAvailable = true;
                break;
              }
            }
          } catch (err) {
            // Ignorar errores
          }
        }
      }

      // ------ Decisión final -------
      if (isSoldOut) {
        console.log(`❌ Entradas agotadas: ${url}`);
      } else if (isAvailable) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`⚠️ Estado indeterminado: ${url}. Revisar selectores.`);
        // Para debugging, podrías guardar el HTML si lo necesitas
        // const htmlContent = await page.content();
        // require('fs').writeFileSync('debug.html', htmlContent);
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
