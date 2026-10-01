> **BORRADOR — ELIMINAR ESTE AVISO ANTES DE PUBLICAR.** Este texto es un borrador de trabajo, **no es asesoramiento jurídico**, y será revisado por un abogado español antes de su publicación. Los marcadores `[RELLENAR]`, `[VERIFICAR]`, `[DECIDIR]` y `[ABOGADO]` indican datos o decisiones pendientes. La versión en español es la versión auténtica; la versión en inglés es solo una traducción de cortesía.

# Política de Privacidad

**Última actualización:** [RELLENAR fecha] · **Versión:** 0.1 (borrador)

Esta política explica qué datos personales trata Kalendar by KaminoLabs, para qué, durante cuánto tiempo y qué derechos tienes. Está escrita para tres tipos de personas: **clínicas y profesionales** que usan Kalendar, **pacientes y clientes** que reservan una cita, y **visitantes** de la web.

## 0. Resumen (información básica por capas, art. 11 LOPDGDD)

| | |
|---|---|
| **Responsable** | Depende de quién seas (ver apartado 2). Para las cuentas de clínica y de portal del paciente: [RELLENAR razón social], NIF [RELLENAR]. Para los datos de tus citas: la clínica con la que reservas. |
| **Finalidad** | Gestionar cuentas, reservas, recordatorios, suscripción y soporte. |
| **Base jurídica** | Ejecución de un contrato o medidas precontractuales (art. 6.1.b RGPD), obligación legal (6.1.c), interés legítimo en la seguridad del servicio (6.1.f) y, en datos de salud, las bases del art. 9.2 RGPD que corresponden a la clínica. |
| **Destinatarios** | Proveedores técnicos (alojamiento, base de datos, correo, pagos, WhatsApp) y la clínica con la que reservas. Algunos están en EE. UU. con garantías (apartado 7). |
| **Derechos** | Acceso, rectificación, supresión, oposición, limitación, portabilidad y a no ser objeto de decisiones automatizadas, escribiendo a [RELLENAR correo]. Puedes reclamar ante la AEPD. |
| **Más información** | En esta misma política. |

## 1. Quiénes somos

- **Denominación:** [RELLENAR razón social] («KaminoLabs», «nosotros»), titular del servicio **Kalendar by KaminoLabs** («Kalendar»).
- **NIF/CIF:** [RELLENAR] · **Domicilio:** [RELLENAR] · **Datos registrales:** [RELLENAR si procede] (art. 10 LSSI-CE).
- **Correo de contacto y de privacidad:** [RELLENAR]
- **Delegado de Protección de Datos (DPD):** [DECIDIR] No hemos designado DPD. Hemos valorado si existe obligación (art. 37 RGPD y art. 34 LOPDGDD) y, con el volumen y la naturaleza actuales, consideramos que no [ABOGADO: confirmar y documentar la valoración]. Cualquier consulta de privacidad se atiende en el correo anterior.

## 2. Nuestro papel: ¿responsable o encargado?

Kalendar es una plataforma de reservas para profesionales. Según el dato, nuestro papel cambia:

| Datos | Quién decide para qué se usan | Nuestro papel |
|---|---|---|
| **Cuenta de la clínica**: nombre y correo de la persona titular, acceso (contraseña o Google), datos de facturación y de suscripción, tickets de soporte | KaminoLabs | **Responsable** del tratamiento |
| **Cuenta de paciente (portal)**: correo, nombre, teléfono opcional, acceso, y la vista unificada de tus reservas en distintas clínicas | KaminoLabs | **Responsable** del tratamiento [ABOGADO: valorar corresponsabilidad, art. 26 RGPD, para los datos de reservas que se muestran en el portal] |
| **Datos de pacientes y clientes de una clínica**: nombre, correo, teléfono, reservas, servicios, comentarios, notas privadas de la clínica, uso de bonos, datos de la conversación de WhatsApp | La clínica | La **clínica** es responsable; KaminoLabs es **encargado** del tratamiento y solo actúa siguiendo sus instrucciones (art. 28 RGPD), según el contrato de encargado que firma cada clínica |
| **Visitantes de la web y registros técnicos de seguridad** | KaminoLabs | **Responsable** |

Si eres paciente o cliente y quieres ejercer derechos sobre tus citas, el interlocutor principal es **la clínica**; nosotros te ayudaremos y trasladaremos tu solicitud a la clínica sin demora (apartado 9).

## 3. Qué datos tratamos y de dónde proceden

**3.1 Clínicas y profesionales (los facilitan ellos)**
- Identidad y acceso: nombre, correo electrónico, contraseña (almacenada de forma cifrada/hash) o identificador de Google, estado de verificación del correo.
- Datos del negocio: nombre, tipo de actividad, dirección, teléfono y correo de contacto, logotipo, servicios, equipo, horarios, festivos y vacaciones, plazo de cancelación.
- Suscripción y facturación: identificadores de cliente y suscripción de Stripe y estado de la suscripción. **No almacenamos números de tarjeta**; los gestiona Stripe.
- Configuración de WhatsApp (opcional): SID de cuenta, número de WhatsApp y *Auth Token* de Twilio de la propia clínica, este último cifrado.
- Soporte: asunto, descripción, categoría y archivos adjuntos que envíes.

**3.2 Pacientes y clientes (los facilitan ellos o la clínica)**
- Nombre, correo y teléfono; servicio, profesional, fecha y hora de la cita; comentario opcional al reservar; estado de la reserva y de su cancelación; uso de bonos y marcas de pago (efectivo/tarjeta/bono) que anota la clínica; notas privadas que escribe la clínica sobre la persona; idioma de la reserva.
- Por WhatsApp: tu número de teléfono, el nombre de perfil de WhatsApp si lo recibimos y el estado de la conversación de reserva (servicio, fecha y hora elegidos). [VERIFICAR: que no se guarda el texto de los mensajes; Twilio puede conservar sus propios registros en la cuenta de la clínica.]
- Cuenta de portal (opcional): correo, nombre, teléfono, acceso. Si creas cuenta con un correo verificado, vinculamos a tu cuenta las reservas previas hechas con ese mismo correo en cualquier clínica de Kalendar, para que veas tu historial completo.

**3.3 Datos de salud — leer con atención**
Kalendar **no es un sistema de historia clínica** y no está diseñado para guardar diagnósticos ni tratamientos. Aun así, el mero hecho de que reserves una cita con un fisioterapeuta, psicólogo o nutricionista puede revelar información sobre tu salud, y por eso lo tratamos con medidas reforzadas, como si fuera una categoría especial de datos (art. 9 RGPD).
- **No escribas datos clínicos** (síntomas, diagnósticos, medicación, motivo de consulta detallado) en el comentario de la reserva. Si necesitas contar algo a tu profesional, hazlo en la consulta.
- Prohibimos a las clínicas usar Kalendar para almacenar historias clínicas o diagnósticos (ver Términos de Uso). [DECIDIR D1]

**3.4 Visitantes y datos técnicos**
- Dirección IP, fecha y hora, URL solicitada, tipo de navegador y errores técnicos, en registros de seguridad y funcionamiento y en el límite de reservas por IP contra abusos.
- Cookies y almacenamiento del navegador: ver el Anexo (cookies).

No tratamos datos de analítica ni de publicidad. No vendemos datos. No tomamos decisiones automatizadas con efectos jurídicos sobre ti.

## 4. Para qué usamos los datos y con qué base jurídica

| Finalidad | Base jurídica |
|---|---|
| Crear y mantener la cuenta de la clínica y prestar el servicio | Contrato (art. 6.1.b RGPD) |
| Cobrar y gestionar la suscripción; facturación y obligaciones fiscales y mercantiles | Contrato (6.1.b) y obligación legal (6.1.c; Código de Comercio art. 30; normativa tributaria) |
| Crear y mantener la cuenta de paciente y mostrar tu historial | Contrato (6.1.b) |
| Gestionar reservas, confirmaciones, cancelaciones y recordatorios a 24 h y 1 h antes de la cita, por correo y, si la clínica lo activa, por WhatsApp | Para la clínica: ejecución del servicio que pides (6.1.b). Nosotros actuamos por cuenta suya como encargados |
| Tratamiento de datos de salud que pudieran inferirse de las reservas | Lo decide la clínica: normalmente art. 9.2.h RGPD (asistencia sanitaria, con secreto profesional, art. 9.3) y, si lo estima, consentimiento explícito 9.2.a. [DECIDIR D2; ABOGADO] |
| Soporte y atención a consultas | Contrato (6.1.b) / interés legítimo (6.1.f) |
| Seguridad, prevención de abusos y diagnóstico de errores (registros, límite por IP) | Interés legítimo (6.1.f) en mantener la plataforma segura y fiable |
| Verificar el correo y recuperar contraseñas | Contrato (6.1.b) y seguridad (6.1.f) |
| Comunicaciones de servicio (avisos de cambios, de seguridad, de facturación) | Contrato (6.1.b) y obligación legal |
| Responder a reclamaciones y defender derechos | Interés legítimo (6.1.f) |

No enviamos comunicaciones comerciales sin tu consentimiento previo (art. 21 LSSI-CE). [DECIDIR D15]

## 5. Correos y mensajes que enviamos

- Confirmación, cancelación y recordatorios de cita (24 h y 1 h antes), y avisos a la clínica de nuevas reservas.
- Verificación de correo y recuperación de contraseña.
- Aviso al titular si cambia la dirección de su página de reservas.
- Los correos dirigidos a pacientes y clientes **se envían actualmente solo en español**, con independencia del idioma que hayas usado al reservar.

## 6. Quién recibe tus datos

**La clínica** con la que reservas ve los datos de tus citas. **Nuestros proveedores** tratan datos por encargo nuestro (o de la clínica) bajo contrato (art. 28 RGPD):

| Proveedor | Finalidad | Datos | Ubicación / transferencia |
|---|---|---|---|
| **Supabase** (base de datos y archivos) | Almacenar todos los datos de Kalendar | Todos los descritos en el apartado 3 | Región UE Central (Fráncfort) [VERIFICAR]. Supabase Inc. es de EE. UU.: [VERIFICAR mecanismo] |
| **Vercel** (alojamiento y ejecución) | Servir la web y ejecutar la aplicación | Todos, en tránsito y en registros técnicos | Región de ejecución [VERIFICAR; hoy puede ser EE. UU.]. EE. UU.: Marco de Privacidad de Datos UE-EE. UU. (DPF) o cláusulas contractuales tipo (CCT) [VERIFICAR] |
| **Resend** (correo transaccional) | Enviar confirmaciones, recordatorios y verificaciones | Correo, nombre, datos de la cita | [VERIFICAR región]; EE. UU.: DPF/CCT [VERIFICAR] |
| **Stripe** (pagos de la suscripción de la clínica) | Cobrar la suscripción | Datos de facturación del titular. Nunca datos de pacientes | Stripe Payments Europe Ltd. (Irlanda) [VERIFICAR]; transferencias a EE. UU.: DPF/CCT [VERIFICAR]. Stripe también es responsable propio para fraude y obligaciones legales |
| **Twilio** y **Meta (WhatsApp Business)** | Reservas y mensajes por WhatsApp si la clínica lo activa. La clínica contrata Twilio con sus propias credenciales | Teléfono, nombre de perfil, estado de la conversación | EE. UU.: DPF/CCT [VERIFICAR]. Meta puede tratar metadatos como responsable propio [VERIFICAR] |
| **Google** (inicio de sesión) | Autenticación opcional con Google | Nombre, correo y foto de perfil de la cuenta Google | Google Ireland / Google LLC: DPF/CCT [VERIFICAR] |

Para el inicio de sesión usamos la librería de código abierto *Better Auth*, que funciona dentro de nuestra propia aplicación; no es un tercero que reciba tus datos.

Podemos comunicar datos a autoridades, jueces o tribunales cuando exista obligación legal. No vendemos ni cedemos datos para publicidad.

## 7. Transferencias internacionales

Nuestra base de datos está en la UE. Algunos proveedores son empresas de EE. UU. o pueden tratar datos allí. Cuando ocurre, nos apoyamos en la **decisión de adecuación del Marco de Privacidad de Datos UE-EE. UU.** (art. 45 RGPD) si el proveedor está certificado, y en las **cláusulas contractuales tipo** de la Comisión Europea con medidas complementarias en caso contrario (art. 46 RGPD). Puedes pedirnos una copia de las garantías en [RELLENAR correo]. [VERIFICAR para cada proveedor]

## 8. Cuánto tiempo conservamos los datos

| Datos | Plazo |
|---|---|
| Cuenta de la clínica | Mientras la cuenta esté activa; después, bloqueados hasta [5] años para posibles reclamaciones y borrados (art. 32 LOPDGDD) [ABOGADO] |
| Facturación y suscripción | 6 años (art. 30 Código de Comercio y normativa tributaria) |
| Datos de pacientes y clientes (que tratamos por encargo) | Los decide la clínica. Si la clínica cierra su cuenta, tiene 30 días para exportarlos y después se eliminan; las copias de seguridad se sobrescriben en un máximo de [35] días [DECIDIR D6/D7; VERIFICAR] |
| Cuenta de portal de paciente | Mientras exista. Puedes borrarla cuando quieras. Cuentas inactivas más de [36] meses: aviso previo y baja [DECIDIR] |
| Sesiones de conversación de WhatsApp | [30] días tras el último mensaje [DECIDIR; requiere tarea técnica] |
| Registro de errores y eventos técnicos (pueden incluir identificador de negocio, URL e IP) | Depuración/información 30 días; avisos y errores 90 días; incidencias críticas 12 meses [DECIDIR D9] |
| Contador antiabuso por IP | 30 días [DECIDIR] |
| Tickets de soporte y adjuntos | 24 meses desde su resolución |

Si una clínica elimina su cuenta, **se eliminan también los datos de sus pacientes y clientes almacenados en Kalendar**, incluido su rastro en el historial del portal. La clínica es responsable de conservar sus propias historias clínicas y registros conforme a la ley (por ejemplo, art. 17 de la Ley 41/2002), fuera de Kalendar.

## 9. Tus derechos y cómo ejercerlos

Tienes derecho a **acceder** a tus datos, **rectificarlos**, **suprimirlos**, **oponerte**, pedir la **limitación**, la **portabilidad** y a retirar el consentimiento cuando sea la base (arts. 15–22 RGPD; arts. 12–18 LOPDGDD).

- **Datos de la cuenta de clínica o de portal:** escribe a [RELLENAR correo] desde el correo de tu cuenta. Respondemos en un mes como máximo (art. 12.3 RGPD). Puedes borrar tu cuenta de portal desde el propio portal [VERIFICAR que existe esta función].
- **Datos de tus citas en una clínica:** dirígete a la clínica. Si nos escribes a nosotros, trasladaremos tu solicitud a la clínica en un máximo de [5] días laborables y la asistiremos para que la atienda.
- Podemos pedirte que acredites tu identidad.

**Reclamaciones:** si crees que tus derechos no se han respetado, puedes reclamar ante la **Agencia Española de Protección de Datos** (www.aepd.es; C/ Jorge Juan, 6, 28001 Madrid), sin perjuicio de acudir antes a nosotros.

## 10. Medidas de seguridad (art. 32 RGPD)

Aplicamos, entre otras: conexiones cifradas (HTTPS); control de acceso en el servidor para cada operación, de modo que cada clínica solo accede a sus datos; verificación del correo electrónico; cifrado a nivel de aplicación de las credenciales de Twilio; límite de reservas por IP contra abusos; separación entre claves de servidor y navegador; y registro de errores. No almacenamos datos de tarjetas. [VERIFICAR el resto: copias de seguridad, cifrado en reposo, doble factor para administración, registro de accesos del personal.] Ningún sistema es infalible. Si hay una violación de seguridad que te afecte, la comunicaremos a la clínica sin dilación (y a ti cuando lo exija el art. 34 RGPD).

## 11. Menores

Kalendar no se dirige a menores. Las cuentas de portal son solo para personas de [18] años o más [DECIDIR D10]. Si reservas para un menor (por ejemplo, una sesión de fisioterapia infantil o apoyo escolar), debes ser su madre, padre o tutor legal y la clínica trata los datos del menor bajo su responsabilidad. En España el consentimiento propio para el tratamiento de datos es válido desde los 14 años (art. 7 LOPDGDD), y en decisiones sanitarias se aplican las edades de la Ley 41/2002. Si detectamos datos de un menor sin autorización, los eliminaremos.

## 12. Cambios en esta política

Podemos actualizarla. Si el cambio es relevante, avisaremos a las clínicas por correo con al menos [15] días de antelación y publicaremos la nueva fecha y versión aquí. Conservamos las versiones anteriores.

---

## Anexo — Aviso de cookies y almacenamiento local

Usamos solo elementos **técnicos y necesarios**, por lo que no te pedimos consentimiento (art. 22.2 LSSI-CE) y no mostramos banner. No usamos cookies de analítica, publicidad ni seguimiento.

| Nombre | Finalidad | Duración | Tipo |
|---|---|---|---|
| Cookie de sesión de Better Auth [VERIFICAR nombre] | Mantener tu sesión iniciada | [VERIFICAR; sesión/días] | Propia, técnica |
| `kalendar_locale` | Recordar el idioma elegido (es/en) | [VERIFICAR; ≤ 1 año] | Propia, de personalización elegida por ti |
| `sessionStorage` del navegador | Conservar tu progreso durante el inicio de sesión (incluida la redirección con Google). Se borra al cerrar la pestaña | Pestaña | Propio, técnico |

Si, al pagar o iniciar sesión, te redirigimos a Stripe o Google, esos servicios pueden usar sus propias cookies bajo su política. Puedes borrar o bloquear cookies en tu navegador; el inicio de sesión dejará de funcionar. Avisaremos y pediremos consentimiento antes de usar cookies no necesarias.
