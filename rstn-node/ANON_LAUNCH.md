# RSTN -- Manual de Lanzamiento Anonimo (Satoshi-style)

> Guia interna para el equipo. No publicar este documento. Su proposito es
> permitir que el protocolo se exponga al publico sin vincularlo a una
> persona fisica identificable.

---

## Filosofia

Satoshi Nakamoto oculto su **identidad**, no su **metodologia**. Publico el
whitepaper, abrio el codigo, respondio en foros publicos. Lo que oculto fue
*quien era*.

Resistance sigue la misma logica: el protocolo es publico, transparente y auditable.
La persona que lo coordina no necesita serlo.

> Importante: anonimato de identidad NO significa opacidad de metodologia.
> Hacer claims falsos sobre como se construyo el protocolo es un riesgo legal
> y reputacional mayor que la transparencia honesta.

---

## Principios no negociables

1. **No reclamar autoria individual.** El protocolo lo firma "RSTN",
   no una persona.
2. **No mentir sobre la metodologia.** No decir "lo construi todo a mano".
   Decir la verdad: "construido con herramientas modernas de desarrollo".
3. **Transparencia tecnica total.** Codigo abierto, tests publicos,
   whitepaper publico, roadmap publico.
4. **Ningun dato personal en el repositorio.** Ni en commits, ni en issues,
   ni en docs, ni en metadatos.

---

## Checklist pre-publicacion (ya cumplido en el codigo)

- [x] README sin autor personal
- [x] WHITEPAPER sin autor personal
- [x] package.json sin campo `author`/`homepage`/`repository`
- [x] index.html con metadata neutra ("RSTN", no una persona)
- [x] Docs internos sin "Director del Proyecto" ni fechas firmadas
- [x] LICENSE Apache 2.0 (neutro, sin nombre)
- [x] Sin emails personales en el codigo

---

## Infraestructura que no te senala

### Identidad del commit (configuracion local en tu Mac)

Antes de cualquier push publico, configura git para que los commits no
llevan tu nombre/email real:

```bash
cd ~/Desktop/RESISTANCE
git config user.name "RSTN"
git config user.email "noreply@rstn.network"
```

Esto hace que cada commit en el historial diga "RSTN" en vez de tu
nombre real. Es la unica configuracion que necesitas para anonimizar el
historial de git.

> Nota: los commits anteriores (si ya tienen tu nombre) conservan tu nombre.
> Para un lanzamiento limpio, se puede reescribir el historial con
> `git filter-repo` antes de hacerlo publico. Es opcional pero recomendado.

### Hosting del dominio

- **Dominio**: registrar `rstn.network` (o similar) bajo un registrador que
  acepte WHOIS privacy (Namecheap, Cloudflare, Porkbun). El WHOIS no muestra
  tu nombre real.
- **DNS**: Cloudflare (gratis, oculta el IP del servidor).
- **Hosting del frontend**: Vercel/Netlify/Cloudflare Pages, deployado con un
  token de la cuenta "RSTN" (no tu cuenta personal de GitHub).

### Hosting de la testnet publica

- **VPS**: Hetzner o OVH (aceitan pago en cripto, no exigen KYC del operador
  para VPS pequenos).
- **Pagos**: pagar el VPS con cripto (BTC/ETH/XMR) via un proveedor que no
  exige KYC (Lunanode, CoinGate, o Monero directo).
- **No usar** un VPS que requiera tarjeta de credito a tu nombre.

---

## Canales de comunicacion anonimos

### Discord / Telegram

1. Crear cuenta con email burner (ProtonMail o SimpleLogin).
2. Nombre de la cuenta: "RSTN" (no tu nombre).
3. No usar la misma cuenta que para otros proyectos (correlacion de IP).
4. No usar foto de perfil que te identifique.
5. Considerar VPN/Tor para acceder (al menos al principio).

### GitHub

1. Cuenta nueva: `rstn-network` (no tu cuenta personal).
2. Email de la cuenta: `noreply@rstn.network` (via Cloudflare email routing).
3. 2FA con app authenticator (no SMS -- SMS revela tu numero).
4. Si pagas GitHub Pro: pagar con cripto via un proveedor que acepte XMR.

### Twitter/X

- Cuenta "ResistanceNetwork" con email burner.
- No usar la misma IP que tu cuenta personal.
- No vincular a LinkedIn, GitHub personal, o cualquier perfil que te
  identifique.

---

## Lo que NO se hace

1. **No** digas "lo construi todo yo solo" -- es falso y detectable.
2. **No** pongas tu foto o nombre real en ningun canal.
3. **No** uses el mismo dispositivo/network para acceder a canales Resistance y a
   tus cuentas personales (correlacion de IP/browser fingerprint).
4. **No** hables del proyecto en foros donde ya te conocen por tu nombre real.
5. **No** recibas pagos del proyecto en una wallet a tu nombre.
6. **No** uses un dominio que registraste a tu nombre (usa WHOIS privacy).

---

## Limitaciones honestas (lo que NO se puede garantizar)

- **Patron de desarrollo del git log**: cientos de commits en dias, estilo
  uniforme. Un analisis forense del historial puede inferir que hubo un unico
  desarrollador asistido por herramientas. No se puede eliminar sin reescribir
  todo el historial, y reescribirlo deja su propio patron.
- **Estilo de codigo consistente**: es analizable pero no revela identidad,
  solo metodologia. No es un problema legal.
- **Huella del browser**: si accedes a canales publicos desde tu Mac sin VPN,
  tu IP es visible para los administradores de esos canales.

Estas limitaciones no son vulnerabilidades legales. Son el costo realista del
anonimato en 2026. Prometer lo contrario seria enganar.

---

## Plan de exposicion publica (fases)

### Fase 1 -- Testnet publica (tokens sin valor)

- Publicar el binario del nodo en GitHub (cuenta rstn-network).
- Publicar el README + WHITEPAPER (ya neutros).
- Levantar 4-8 validadores en VPS pagados con cripto.
- Abrir Discord/Telegram con cuenta burner.
- Faucet activo (tokens sin valor, no requiere KYC).
- Block explorer en `explorer.rstn.network`.

> En esta fase el riesgo legal es minimo porque no hay valor real.
> Es el momento de ganar comunidad y validadores antes de mainnet.

### Fase 2 -- Auditoria externa

- Contratar Trail of Bits / Quantstamp / Halborn.
- Ellos trabajan con la entidad "RSTN", no con una persona.
- La auditoria se publica en GitHub. Esto genera credibilidad.
- Presupuesto: $40K-$150K (pagar via tesoreria de la Fundacion, no personal).

### Fase 3 -- Entidad legal (Fundacion)

- Registrar Fundacion en Suiza/Singapur/Panama.
- El abogado conoce tu identidad (KYC legal), pero el publico no.
- El token pasa a ser emitido por la Fundacion, no por "ti".
- Esto es lo que diferencia un lanzamiento anonimo en 2026 de uno en 2009:
  las reglas exigen una entidad legal para el bridge y el token.

### Fase 4 -- Mainnet

- Solo despues de: auditoria limpia + Fundacion registrada + 16+ validadores
  independientes + bug bounty ejecutado 30+ dias.
- Genesis block con distribucion fair launch (sin asignacion a fundadores).
- Bridge activado con limits de capacidad iniciales.

---

## Resumen

| Item | Accion | Quien lo hace |
|------|--------|---------------|
| Commits | `git config user.name "RSTN"` | Tu, en tu Mac |
| Dominio | WHOIS privacy | Tu, via registrador |
| VPS | Pagar con cripto, no KYC | Tu, via proveedor |
| GitHub | Cuenta nueva rstn-network | Tu |
| Discord | Cuenta burner | Tu |
| Auditoria | Contratar firma | Fundacion (Fase 3) |
| Token | Emitir via Fundacion | Fundacion (Fase 3) |

**La regla de oro**: la identidad del protocolo es "RSTN". La tuya
no aparece en ninguna superficie publica. La metodologia es transparente
(codigo abierto, tests, whitepaper). Eso es lo que Satoshi hizo. Eso es lo
que replicamos.

---

**Version:** 1.0 · Estado: guia interna -- confidencial, no publicar.
