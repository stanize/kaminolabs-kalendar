# Configurar Supabase para Kalendar

Notas para crear el proyecto de Supabase **dedicado a Kalendar** (cuenta separada,
como querías) y dejarlo listo para el flujo de onboarding.

## 1. Crear el proyecto

1. En tu cuenta nueva de Supabase → **New project**.
2. Elige una región cercana a España (p. ej. `eu-west-1` / `eu-central-1`) para
   menor latencia.
3. Guarda la contraseña de la base de datos en un sitio seguro (no se usa en el
   código, pero la pedirás si algún día conectas herramientas externas).

## 2. Ejecutar el esquema

1. En el proyecto → **SQL Editor** → **New query**.
2. Pega el contenido completo de [`schema.sql`](./schema.sql) y ejecútalo.
3. Verifica en **Table Editor** que aparecen: `profiles`, `businesses`,
   `services`, `business_hours`, `team_members`.

Esto crea las tablas, los índices, las políticas de RLS (cada negocio solo lo
puede editar su propietario; la lectura es pública para que la futura página
de reservas funcione) y el trigger que crea automáticamente una fila en
`profiles` cuando alguien se registra.

## 3. Variables de entorno

En **Project Settings → API**, copia:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Pégalas en `.env.local` (copia `.env.local.example`):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

En Vercel, añade las mismas dos variables en **Project Settings → Environment
Variables** para Production, Preview y Development.

## 4. Confirmación de email — desactívala (por ahora)

El flujo de Kalendar **crea la cuenta al final del wizard** (paso 6), no en el
paso 1, para no obligar a nadie a confirmar su correo a mitad de la
configuración. Para que `supabase.auth.signUp()` devuelva una sesión activa
inmediatamente:

1. **Authentication → Providers → Email**.
2. Desactiva **"Confirm email"**.

> Cuando tengáis tiempo de construir el flujo de verificación, podéis
> reactivarlo y añadir una pantalla intermedia de "revisa tu correo" antes del
> paso 6 — el resto del código no cambia.

## 5. Activar Google OAuth

1. En [Google Cloud Console](https://console.cloud.google.com/) crea (o
   reutiliza) un proyecto OAuth → **APIs & Services → Credentials → Create
   credentials → OAuth client ID** → tipo **Web application**.
2. En **Authorized redirect URIs** añade la URL de callback de Supabase
   (la encuentras en Supabase → **Authentication → Providers → Google**):
   ```
   https://xxxxxxxx.supabase.co/auth/v1/callback
   ```
3. Copia el **Client ID** y **Client Secret** generados por Google.
4. En Supabase → **Authentication → Providers → Google**: actívalo y pega
   ambos valores.

## 6. URLs de redirección de la app

En Supabase → **Authentication → URL Configuration**:

- **Site URL**: tu dominio de producción, p. ej. `https://kalendar.app`
- **Redirect URLs**: añade todas las que vayas a usar, una por línea:
  ```
  http://localhost:3000/auth/callback
  https://kalendar.app/auth/callback
  https://*.vercel.app/auth/callback
  ```
  (el comodín `*.vercel.app` cubre tus preview deployments de Vercel; si tu
  proyecto Supabase no admite comodines en tu plan, añade cada preview URL que
  necesites probar de forma explícita).

## 7. Comprobación rápida

Con `npm run dev` y `.env.local` configurado:

1. Abre `/onboarding`, completa el paso 1 con correo/contraseña y avanza hasta
   el final.
2. Al pulsar **"Crear mi página"** deberías ver en Supabase → **Table Editor**
   una fila nueva en `businesses` (y sus `services` / `business_hours` /
   `team_members` asociados) y un usuario nuevo en **Authentication → Users**.
3. Prueba también el botón **"Continuar con Google"** — te llevará a Google,
   volverá a `/onboarding` ya autenticado, y debería saltarse directamente al
   paso 2 con tu nombre y correo prerellenados.

## Qué falta fuera de este alcance

Este esquema cubre **solo onboarding**. Quedan fuera (a propósito, para
construir después): tabla de `bookings` (reservas reales de clientes),
excepciones de disponibilidad (vacaciones, festivos), notificaciones por email
/ WhatsApp, y pagos.
