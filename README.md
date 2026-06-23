# Kalendar

Software de reservas online para profesionales (psicólogos, nutricionistas,
fisioterapeutas, centros de estética, entrenadores, coaches, academias…) en
el mercado español. Todo el producto está en español.

> Este repo contiene **solo el alcance de onboarding**: la landing page y el
> asistente de 6 pasos para crear una cuenta y dar de alta un negocio. El
> panel de control y la página pública de reservas son features futuras
> (quedan stubs mínimos para que los enlaces del flujo no rompan).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (tokens de diseño vía `@theme` en `app/globals.css`)
- **Supabase** (`@supabase/ssr`) — Auth (email/contraseña + Google OAuth) y Postgres
- **Zustand** (con persistencia en `sessionStorage`) para el estado del wizard
- **lucide-react** para iconos
- Fuentes: **Bricolage Grotesque** (títulos) + **Plus Jakarta Sans** (UI), vía `next/font/google`

## Empezar

```bash
npm install
cp .env.local.example .env.local   # rellena con tus claves de Supabase — ver supabase/SETUP.md
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

**Antes de poder completar el onboarding de verdad necesitas un proyecto de
Supabase configurado** — sigue [`supabase/SETUP.md`](./supabase/SETUP.md)
paso a paso (crear el proyecto, ejecutar `supabase/schema.sql`, activar Google
OAuth, configurar las URLs de redirección).

## Estructura

```
app/
  page.tsx                  Landing page ("Empezar gratis" → /onboarding)
  onboarding/page.tsx       Punto de entrada del wizard
  auth/callback/route.ts    Callback de OAuth (intercambia el code por sesión)
  panel/page.tsx            Stub del panel (fuera de alcance)
  [slug]/page.tsx           Stub de la página pública de reservas (fuera de alcance)

components/
  ui/                       Primitivas: Icon, Logo, Avatar, Btn, Field
  landing/                  Navbar de la landing
  onboarding/               Los 6 pasos, el shell "dividido", la vista previa en vivo

lib/
  onboarding/               Tipos, datos de referencia, slug, store (Zustand), validación
  supabase/                 Clientes de Supabase (browser / server / middleware)
  actions/onboarding.ts     Server Action que persiste todo al terminar el wizard

supabase/
  schema.sql                Esquema completo (tablas + RLS + trigger)
  SETUP.md                  Guía de configuración del proyecto Supabase
```

## Cómo funciona el flujo de onboarding

Sigue el handoff de diseño (`Onboarding.html` + `.jsx` del bundle original):
un wizard lineal de 6 pasos con el shell **"dividido"** (split-screen) como
único layout implementado — panel de marca + vista previa en vivo a la
izquierda, formulario a la derecha. Los otros dos shells del handoff
(asistente centrado, conversacional a pantalla completa) **no se han
construido**: el contenido de cada paso vive en componentes separados
(`components/onboarding/step-*.tsx`) precisamente para poder añadir esos
shells más adelante sin reescribir nada.

**Cuenta diferida al final.** Para no obligar a nadie a verificar su email a
mitad del wizard, la cuenta (email/contraseña) **no se crea en el paso 1**:
solo se valida localmente. La cuenta real se crea — junto con el negocio, los
servicios, el horario y el equipo — en la Server Action `finishOnboarding`,
de un tirón, al pulsar "Crear mi página" en el último paso.

**Excepción: Google.** Si la persona pulsa "Continuar con Google", sí hay una
redirección real a Google en ese momento (es inevitable con OAuth). Para que
no se pierdan los datos ya introducidos en pasos posteriores durante ese
salto de página, el estado del wizard se persiste en `sessionStorage` con el
middleware `persist` de Zustand. Al volver de Google, el controlador
(`onboarding-flow.tsx`) detecta la sesión activa, rellena nombre/correo y
salta directamente al paso 2.

**Slug único.** El nombre del negocio se convierte en slug (`lib/onboarding/slug.ts`)
y se reclama en `finishOnboarding`: si ya existe, se reintenta añadiendo
`-2`, `-3`… hasta encontrar uno libre.

## Lo que NO está construido (a propósito)

- Panel de control real (solo un stub que confirma que la cuenta existe)
- Página pública de reservas con calendario real (solo un stub de "próximamente")
- Recuperación de contraseña / reenvío de verificación de email
- Pagos, recordatorios, gestión de reservas de clientes

## Notas de diseño

Un solo tema ("Clínico", claro) y un solo color de marca (`#0d9488`, teal) —
los tokens están en `app/globals.css`. El bundle de diseño original incluía
un selector de tema/marca/estilo (`tweaks-panel.jsx`); según su propio
README era **solo una herramienta del prototipo**, no parte del producto, así
que no se ha incluido aquí. Si más adelante queréis white-labeling por
negocio, los tokens ya están aislados en un único sitio para facilitarlo.
