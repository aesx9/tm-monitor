import { chromium } from "playwright";

// ⚙️ Configuración fija
const url = "https://www.ticketmaster.es/event/lady-gaga-the-mayhem-ball-entradas/2082455188";
const botToken = "8232210734:AAG3gBMvqhcGcyiqg_qCfVyw3KEL71OjHSI";
const chatId = "5971998907";

// Función para mandar mensajes a Telegram
async function sendTelegramMessage(message) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    const data = await resp.json();
    if (!data.ok) {
      console.error("❌ Error al enviar mensaje a Telegram:", data);
    }
  } catch (err) {
    console.error("❌ Fallo en la conexión con Telegram:", err);
  }
}

// Función principal
async function checkTickets() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("🌐 Revisando:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Extraemos todo el texto del body
  const content = await page.textContent("body");

  if (content && !content.includes("Agotado")) {
    console.log("🎟️ ¡Entradas disponibles!");
    await sendTelegramMessage("🎟️ ¡Entradas disponibles en Ticketmaster!\n" + url);
  } else {
    console.log("❌ Sin entradas.");
  }

  await browser.close();
}

// 🕒 Ejecutar cada 5 minutos
setInterval(checkTickets, 5 * 60 * 1000);

// 👉 Llamada inicial inmediata
checkTickets();
