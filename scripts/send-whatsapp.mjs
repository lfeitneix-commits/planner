// Envía una plantilla de WhatsApp (Cloud API de Meta) a una lista de números.
// Lo ejecuta el workflow .github/workflows/whatsapp-quincena.yml.
//
// Variables de entorno (se cargan como "Secrets" del repo en GitHub):
//   WA_TOKEN            Token de acceso permanente (usuario del sistema de Meta Business)
//   WA_PHONE_NUMBER_ID  ID del número emisor (panel de WhatsApp > API Setup)
//   WA_RECIPIENTS       Números separados por coma, formato internacional sin "+"
//                       ej: 5491112345678,5493511234567
//   WA_TEMPLATE_NAME    Nombre de la plantilla aprobada (ej: aviso_quincena)
//   WA_TEMPLATE_LANG    Código de idioma de la plantilla (por defecto: es_AR)
//   WA_SEND_PERIOD      "true" si la plantilla tiene una variable {{1}} para el período
//                       (se completa con, por ejemplo, "1ra quincena de noviembre")

const {
  WA_TOKEN,
  WA_PHONE_NUMBER_ID,
  WA_RECIPIENTS,
  WA_TEMPLATE_NAME,
  WA_TEMPLATE_LANG = 'es_AR',
  WA_SEND_PERIOD = 'false',
} = process.env;

const missing = ['WA_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_RECIPIENTS', 'WA_TEMPLATE_NAME']
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(', ')}`);
  process.exit(1);
}

const recipients = WA_RECIPIENTS.split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean);

function periodText(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  const day = Number(new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(date));
  return `${day <= 15 ? '1ra' : '2da'} quincena de ${fmt.format(date)}`;
}

const template = { name: WA_TEMPLATE_NAME, language: { code: WA_TEMPLATE_LANG } };
if (WA_SEND_PERIOD === 'true') {
  template.components = [{ type: 'body', parameters: [{ type: 'text', text: periodText() }] }];
}

const url = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`;
let failures = 0;

for (const to of recipients) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
  });
  const body = await res.json().catch(() => ({}));
  const masked = `...${to.slice(-4)}`;
  if (res.ok) {
    console.log(`OK    ${masked}  id=${body.messages?.[0]?.id ?? '?'}`);
  } else {
    failures++;
    console.error(`ERROR ${masked}  ${res.status} ${body.error?.message ?? JSON.stringify(body)}`);
  }
}

if (failures) {
  console.error(`${failures} de ${recipients.length} envíos fallaron.`);
  process.exit(1);
}
console.log(`Enviado a ${recipients.length} número(s).`);
