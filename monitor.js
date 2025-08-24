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
  // Interceptar solicitudes de red para detectar respuestas de API
  await context.route('**/*', (route, request) => {
    const url = request.url();
    if (url.includes('availability') || url.includes('inventory')) {
      console.log('Interceptando solicitud de disponibilidad:', url);
    }
    route.continue();
  });
  
  const page = await context.newPage();

  for (const url of urls) {
    try {
      console.log(`Revisando: ${url}`);
      
      // Navegar a la página
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Esperar a que los elementos dinámicos se carguen
      await page.waitForTimeout(10000);
      
      // 1. Obtener todo el texto de la página
      const pageText = await page.evaluate(() => document.body.innerText);
      const lowerPageText = pageText.toLowerCase();
      
      // 2. Patrones que indican NO disponibilidad
      const notAvailablePatterns = [
        'no hay suficientes entradas',
        'agotado',
        'sold out',
        'no disponible',
        'no tickets available',
        'currently not available',
        'no results found',
        'no events found',
        'no se encontraron resultados'
      ];
      
      // 3. Patrones que indican disponibilidad
      const availablePatterns = [
        'comprar entradas',
        'buy tickets',
        'seleccionar entradas',
        'select tickets',
        'available tickets',
        'entradas disponibles'
      ];
      
      // 4. Buscar patrones de no disponibilidad
      let isNotAvailable = false;
      for (const pattern of notAvailablePatterns) {
        if (lowerPageText.includes(pattern)) {
          console.log(`Encontrado patrón de no disponibilidad: "${pattern}"`);
          isNotAvailable = true;
          break;
        }
      }
      
      // 5. Buscar patrones de disponibilidad
      let isAvailable = false;
      for (const pattern of availablePatterns) {
        if (lowerPageText.includes(pattern)) {
          console.log(`Encontrado patrón de disponibilidad: "${pattern}"`);
          isAvailable = true;
          break;
        }
      }
      
      // 6. Análisis de botones interactivos
      const buttons = await page.$$('button, a');
      let hasActiveBuyButton = false;
      
      for (const button of buttons) {
        try {
          const text = await button.textContent();
          const isVisible = await button.isVisible();
          const isDisabled = await button.evaluate(el => el.disabled);
          
          if (text && isVisible && !isDisabled) {
            const buttonText = text.toLowerCase().trim();
            if (buttonText.includes('comprar') || buttonText.includes('buy')) {
              console.log(`Botón activo encontrado: "${text.trim()}"`);
              hasActiveBuyButton = true;
              break;
            }
          }
        } catch (e) {
          // Ignorar errores en elementos individuales
        }
      }
      
      // 7. Tomar decisión basada en múltiples factores
      if (isNotAvailable) {
        console.log(`❌ Entradas agotadas: ${url}`);
      } else if ((isAvailable || hasActiveBuyButton) && !isNotAvailable) {
        console.log(`🎟️ ¡Entradas disponibles! ${url}`);
        const msg = `🎟️ ¡Entradas disponibles! ${url}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
      } else {
        console.log(`⚠️ Estado indeterminado: ${url}`);
        // Para debugging avanzado
        await page.screenshot({ path: 'debug.png', fullPage: true });
        console.log('Captura de pantalla guardada como debug.png');
        
        // También guardar el HTML para análisis
        const html = await page.content();
        // require('fs').writeFileSync('debug.html', html); // Descomentar si necesitas analizar el HTML
      }
      
    } catch (err) {
      console.error(`Error revisando ${url}:`, err.message);
    }
  }

  await browser.close();
}

// Función para análisis manual
async function manualAnalysis() {
  const browser = await chromium.launch({ headless: false }); // Abrir navegador visible
  const page = await browser.newPage();
  
  await page.goto("https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/2082455188", { 
    waitUntil: 'networkidle', 
    timeout: 60000 
  });
  
  await page.waitForTimeout(10000);
  
  // Tomar capturas para análisis
  await page.screenshot({ path: 'manual-analysis.png', fullPage: true });
  
  // Obtener todo el texto visible
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("Texto completo de la página:");
  console.log(pageText);
  
  await browser.close();
}

// Ejecutar la verificación principal
checkTickets().catch(err => {
  console.error("Error general:", err);
  process.exit(1);
});

// Para análisis manual, descomenta la siguiente línea:
// manualAnalysis();
