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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();

  for (const url of urls) {
    try {
      console.log(`Revisando: ${url}`);
      
      // Navegar a la página
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Esperar a que los elementos dinámicos se carguen
      await page.waitForTimeout(8000);
      
      // 1. Verificar si hay mensajes de error claros
      const errorMessages = [
        "No hay suficientes entradas",
        "Agotado",
        "Sold Out",
        "No disponible",
        "no tickets available",
        "no hay entradas"
      ];
      
      let hasError = false;
      const pageContent = await page.content();
      
      for (const msg of errorMessages) {
        if (pageContent.toLowerCase().includes(msg.toLowerCase())) {
          console.log(`Encontrado mensaje de error: ${msg}`);
          hasError = true;
          break;
        }
      }
      
      // 2. Intentar encontrar y hacer clic en un botón de compra
      let canPurchase = false;
      if (!hasError) {
        try {
          // Buscar botones de compra de diferentes formas
          const buySelectors = [
            'button[data-testid="buy-button"]',
            'a[data-testid="buy-button"]',
            'button:has-text("Comprar")',
            'a:has-text("Comprar")',
            'button:has-text("Buy")',
            'a:has-text("Buy")',
            'button:has-text("Ver entradas")',
            'a:has-text("Ver entradas")'
          ];
          
          for (const selector of buySelectors) {
            const buyButton = await page.$(selector);
            if (buyButton && await buyButton.isVisible()) {
              console.log(`Encontrado botón: ${selector}`);
              
              // Verificar si el botón está deshabilitado
              const isDisabled = await buyButton.getAttribute('disabled');
              if (!isDisabled) {
                // Hacer clic en el botón
                await buyButton.click();
                await page.waitForTimeout(3000);
                
                // Verificar si apareció un mensaje de error después del clic
                const newContent = await page.content();
                let errorAfterClick = false;
                
                for (const msg of errorMessages) {
                  if (newContent.toLowerCase().includes(msg.toLowerCase())) {
                    console.log(`Error después del clic: ${msg}`);
                    errorAfterClick = true;
                    break;
                  }
                }
                
                if (!errorAfterClick) {
                  canPurchase = true;
                  console.log("Parece que se puede comprar");
                }
                
                break;
              }
            }
          }
        } catch (clickError) {
          console.log("Error al intentar hacer clic:", clickError.message);
        }
      }
      
      // 3. Verificar el estado final
      if (hasError) {
        console.log(`❌ Entradas agotadas: ${url}`);
      } else if (canPurchase) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`⚠️ Estado indeterminado: ${url}. Revisando manualmente...`);
        
        // Guardar captura de pantalla para debugging
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        console.log("Captura de pantalla guardada como debug-screenshot.png");
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
