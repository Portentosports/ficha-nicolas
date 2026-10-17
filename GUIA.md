# Ficha de Nicolás: puesta en marcha

Resultado: una web en **nicolas.portentosports.com** con el diseño de la ficha, que cada mañana pide a Instagram seguidores, alcance, interacciones y demografía, y se actualiza sola. Coste: 0 €.

Piezas:

- **GitHub** guarda la web y cada día ejecuta la tarea que habla con Instagram.
- **Cloudflare Pages** publica la web con tu dominio. Es gratis y, a diferencia del plan gratis de Vercel, permite uso comercial.
- **Meta for Developers** da la llave (token) para leer las estadísticas de la cuenta de Nicolás.

Tiempo total: una tarde. El paso 2 es el más pesado.

---

## 1. Cuenta de Instagram de Nicolás (5 min, lo hace él)

1. Instagram → Configuración → Tipo de cuenta y herramientas → **Cambiar a cuenta profesional** → **Creador**.
2. La cuenta tiene que ser **pública**.

Si ya es de Creador o Empresa, salta este paso.

## 2. App de Meta y token (30–45 min)

1. Entra en **developers.facebook.com** con tu Facebook y regístrate como desarrollador (es gratis).
2. **Mis apps → Crear app**. Caso de uso: **Otro**. Tipo: **Empresa**. Nombre: `Portento Ficha`.
3. En el panel de la app, busca el producto **Instagram** → **Configurar**.
4. En el menú de la izquierda: **Instagram → Configuración de la API con inicio de sesión de Instagram** (en inglés: *API setup with Instagram login*). No elijas la opción "con inicio de sesión de Facebook".
5. Revisa que los permisos incluyan `instagram_business_basic` e `instagram_business_manage_insights`. El segundo es el que da acceso a alcance y demografía.
6. En **Generar tokens de acceso** → **Añadir cuenta** → Nicolás inicia sesión con su Instagram y pulsa **Permitir**. Puedes hacerlo con él en una videollamada o con su móvil.
7. Pulsa **Generar token** junto a su cuenta y **cópialo ya**: el panel no lo vuelve a mostrar. Guárdalo un momento en una nota.

El token dura 60 días, pero la tarea diaria lo renueva sola. No tienes que volver aquí salvo que algo falle.

No hace falta pasar la revisión de Meta: es la cuenta de Nicolás y solo la lee él (tú en su nombre). Los nombres de los menús pueden cambiar un poco según el idioma o el día.

## 3. GitHub (15 min)

1. Crea una cuenta en **github.com** si no tienes.
2. **New repository** → nombre `ficha-nicolas` → **Private** → Create.
3. En el repo vacío: **uploading an existing file** → arrastra **todo el contenido** de la carpeta del zip, incluida la carpeta `.github`. Si tu ordenador oculta las carpetas que empiezan por punto, en Mac pulsa `Cmd + Shift + .` en Finder para verlas. **Commit changes**.
4. Crea un segundo token, esta vez de GitHub. Sirve para que la tarea guarde el token renovado de Instagram:
   - Tu foto (arriba a la derecha) → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Nombre: `renovar-token-instagram`. Caducidad: **1 año** (apúntate en el calendario renovarlo).
   - **Repository access → Only select repositories →** `ficha-nicolas`.
   - **Permissions → Repository permissions → Secrets → Read and write**.
   - **Generate token** y cópialo.
5. En el repo: **Settings → Secrets and variables → Actions → New repository secret**, dos veces:
   - `IG_TOKEN` → el token de Instagram del paso 2.
   - `GH_PAT` → el token de GitHub que acabas de crear.
6. Prueba la tarea: pestaña **Actions** → *Actualizar datos de Instagram* → **Run workflow**. En un minuto debe salir en verde y aparecerá un cambio nuevo en `site/data/stats.json` con los datos reales.

Si sale en rojo, abre la ejecución: el mensaje dice qué falló (normalmente el token o un permiso que falta). Pásamelo y lo vemos.

## 4. Publicar la web con Cloudflare Pages (15 min)

1. Crea una cuenta gratis en **dash.cloudflare.com**.
2. **Workers & Pages → Create → Pages → Connect to Git** → autoriza GitHub → elige `ficha-nicolas`.
3. Configuración de compilación:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: **site**
4. **Save and Deploy**. En un minuto tendrás la web en `ficha-nicolas.pages.dev`. Ábrela y comprueba que sale todo.

Cada vez que la tarea diaria guarde datos nuevos, Cloudflare vuelve a publicar la web solo.

## 5. Tu dominio (10 min + espera)

**El orden importa: primero Cloudflare, luego el DNS.** Al revés, la web da error.

1. En Cloudflare: tu proyecto → **Custom domains → Set up a domain** → `nicolas.portentosports.com` → Continue.
2. En el sitio donde compraste portentosports.com (o donde gestionas el correo), añade un registro DNS:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | CNAME | `nicolas` | `ficha-nicolas.pages.dev` |

3. Espera entre unos minutos y unas horas a que se active. Cloudflare pone el candado (https) solo.

Si prefieres otra dirección, como `portentosports.com/nicolas`, se puede, pero depende de dónde tengas la web principal. Dímelo y lo adaptamos.

---

## Qué hace la tarea cada día

A las 7:17 (hora de España en verano; 6:17 en invierno):

1. Lee seguidores y número de publicaciones.
2. Lee alcance, interacciones y cuentas que interactúan de los últimos 30 días.
3. Calcula el engagement rate: media de interacciones de las últimas 12 publicaciones entre seguidores.
4. Lee la demografía de los seguidores: género, edad y top 5 de países.
5. Añade el dato del día al histórico y calcula el crecimiento.
6. Renueva el token de Instagram y lo guarda.

Si algo falla, el resto de datos se actualiza igual y se conserva el último valor bueno. Si falla lo principal (por ejemplo, el token ya no vale), la tarea sale en rojo y **GitHub te manda un email**.

## Cosas a saber

- **El gráfico de evolución empieza con un solo punto.** Instagram no da el histórico hacia atrás. Durante el primer mes verás los días; a partir del cuarto mes, un punto por mes. El porcentaje de crecimiento aparece al cumplir 4 semanas.
- **Los datos tienen hasta 48 horas de retraso**: es cómo los da Instagram.
- **Si cambias la contraseña de Instagram de Nicolás** o le quitas el permiso a la app, el token deja de valer. Repite el paso 2.7 y pega el nuevo en el secreto `IG_TOKEN`.
- **El token de GitHub (`GH_PAT`) caduca al año.** Si caduca, la tarea sigue leyendo datos durante 60 días, pero no puede guardar el token renovado. Antes de que pase, crea uno nuevo (paso 3.4) y sustituye el secreto.
- **Cambiar textos o fotos**: edita `site/index.html` o sustituye las fotos de `site/fotos/` desde la web de GitHub (icono del lápiz). Cloudflare publica el cambio solo.
- **Vista previa en WhatsApp/email**: la web ya trae título, descripción y foto. Si usas otro dominio, cambia la dirección de la línea `og:image` en `site/index.html`.

## Contenido del proyecto

```
site/index.html                         la ficha
site/fotos/                             las fotos
site/data/stats.json                    datos que muestra la web (los escribe la tarea)
site/data/history.json                  histórico de seguidores
scripts/update-instagram.mjs            la tarea que habla con Instagram
.github/workflows/actualizar-instagram.yml   cuándo se ejecuta
```
