# Auth-Bio — Sistema de Autenticación y Verificación Biométrica

Sistema de gestión de identidad con verificación biométrica (dactilar, facial y ocular) para empresas, asesores y clientes. Incluye un **back-office** para administración (`client`), un **portal público** de verificación biométrica (`web`) y una **API REST** centralizada (`server`).

---

## Arquitectura

El proyecto es un monorepo con tres aplicaciones independientes:

```
auth-bio/
├── server/   # API REST (Express + TypeScript + Prisma + Lucia)
├── client/   # Back-office interno (React + Vite + Tailwind) — Admin / Asesor
└── web/      # Portal público de verificación biométrica (React + Vite)
```

- **`server`** — API REST consumida por ambas apps. Base URL por defecto: `http://localhost:3000/api`. Swagger UI disponible en `/api/docs`.
- **`client`** — Panel de administración para el staff interno (Admin y Asesor). Estilo dark "glassmorphism".
- **`web`** — Portal público donde los clientes confirman su identidad con los simuladores biométricos. Estilo claro y minimalista.

El flujo principal: el **admin** crea empresas y asesores → el **asesor** crea clientes con métodos biométricos asignados → el **cliente** recibe un enlace por correo → abre el **portal web**, valida sus datos de identidad y completa la verificación biométrica → el sistema marca su enrolamiento como completado.

> **Nota importante:** los simuladores biométricos (dactilar, facial y ocular) son de **demostración/UI**. Los tres usan `Math.random() < successRate` (0.85 por defecto) y las capturas de cámara **nunca** se procesan ni se envían al backend. No hay integración con hardware ni análisis de imágenes reales.

---

## Stack tecnológico

| Capa       | Tecnologías |
|------------|-------------|
| Backend    | Node.js, Express 4, TypeScript 5, Prisma 7, PostgreSQL 15, Lucia 3 (sesiones), Zod 4 (validación), Swagger/OpenAPI 3, Vitest (tests) |
| Frontend (client) | React 19, Vite 7, TypeScript, Tailwind CSS 4, TanStack Query 5, React Router 7, i18next (ES/EN/FR/PT), framer-motion, Headless UI, react-hot-toast, lucide-react |
| Frontend (web) | React 19, Vite 8, TypeScript, Tailwind CSS 4, React Router 7, axios, CSS Modules + design tokens |
| Seguridad  | Argon2 (hash de contraseñas), rate limiting, cookies httpOnly (`auth_session`), RBAC |
| Email      | Resend (servicio transaccional) |
| Otros      | Docker Compose (PostgreSQL local), multer/cookie-parser/cors |

---

## Estructura de carpetas

### `server/`

```
server/
├── docker-compose.yml            # PostgreSQL 15 local (puerto 5432)
├── prisma/
│   ├── schema.prisma             # Modelos de datos y enums
│   └── migrations/               # Migraciones SQL versionadas
├── src/
│   ├── index.ts                  # Punto de entrada (Express app + error handler)
│   ├── config/resend.ts          # Cliente de Resend
│   ├── lib/
│   │   ├── auth.ts               # Configuración de Lucia (sesiones)
│   │   ├── db.ts                 # Cliente Prisma (adapter pg)
│   │   └── openApi.ts            # Generación de especificación OpenAPI
│   ├── middlewares/
│   │   ├── authMiddleware.ts     # Autenticación por cookie de sesión
│   │   ├── roleMiddleware.ts     # RBAC: requireAdmin / requireAdminOrAdvisor / requireCanCreateUsers
│   │   ├── rateLimit.ts          # Límites de peticiones (global y de login)
│   │   └── validateRequest.ts    # Validación Zod de body/params/query
│   ├── schemas/                  # Esquemas Zod (auth, user)
│   ├── services/                 # Lógica de negocio (Auth, User, Company, AuditLog, Email)
│   ├── repositories/             # Acceso a datos (UserRepository, CompanyRepository)
│   ├── controllers/              # Controladores HTTP (auth, users, companies, stats, loginAs)
│   ├── routes/                   # Definición de rutas (auth, users, companies, stats)
│   ├── utils/                    # AppError, catchAsync, roles, imageStorage
│   ├── docs/                     # Registro de paths OpenAPI
│   └── scripts/createAdmin.ts    # Script de creación/actualización del admin
├── vitest.config.ts
├── prisma.config.ts
└── package.json
```

### `client/`

```
client/
├── src/
│   ├── main.tsx                  # Bootstrap (QueryClientProvider + i18n)
│   ├── App.tsx                   # Router + guardas de rutas por rol
│   ├── context/AuthContext.tsx   # Estado de autenticación global
│   ├── lib/
│   │   ├── api.ts                # Cliente axios (VITE_API_URL, withCredentials)
│   │   ├── roles.ts              # Helpers de permisos por rol
│   │   └── queryClient.ts        # Config de TanStack Query
│   ├── pages/
│   │   ├── Login.tsx             # Inicio de sesión (email + contraseña)
│   │   ├── Dashboard.tsx         # KPIs según rol (Admin / Asesor)
│   │   ├── Profile/              # Perfil personal + cambio de contraseña
│   │   ├── Companies/            # Gestión de empresas, asesores y clientes
│   │   └── Users/CreateUserPage.tsx # Alta de asesores (Admin) / clientes (Asesor)
│   ├── features/dashboard/       # Hook useStats (refetch cada 30 s)
│   ├── services/                 # statsService, userService (ticketService en desuso)
│   ├── components/               # Layout, UserAvatar, StatCard, Pagination, UI kit...
│   ├── i18n/                     # Traducciones es/en/fr/pt
│   └── types/                    # Tipos compartidos (User, Empresa, BiometricMethod...)
├── public/                       # Imágenes subidas (logos y fotos de perfil)
└── package.json
```

### `web/`

```
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # Rutas: / (Login) y /verification
│   ├── lib/api.ts                # Cliente axios (VITE_API_URL, withCredentials)
│   ├── pages/
│   │   ├── Login.tsx             # Verificación de identidad por documento
│   │   └── Verification.tsx      # Flujo completo de enrolamiento biométrico
│   ├── components/verification/
│   │   ├── Finger.tsx            # Simulador dactilar (10 dedos, sin cámara)
│   │   ├── Facial.tsx            # Simulador facial (cámara + cuadro de alineación)
│   │   └── Iris.tsx              # Simulador ocular (cámara + guías de ojos)
│   ├── shared/
│   │   ├── biometricMethods.ts   # Normalización/resolución de métodos
│   │   ├── biometricTypes.ts     # Tipos de fases y resultados biométricos
│   │   ├── hooks/useCamera.ts    # Ciclo de vida getUserMedia
│   │   └── ui/                   # CameraStage + design tokens (tokens.css)
│   └── index.css
└── package.json
```

---

## Modelo de datos

Base de datos **PostgreSQL** gestionada con **Prisma** (schema en `server/prisma/schema.prisma`). Modelos:

### `Empresa` (empresa/cliente corporativo)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| nombre | String | Único |
| nit | String | Único |
| logoUrl | String? | Ruta al logo persistido |
| description | String? | |
| createdAt / updatedAt | DateTime | |

### `User`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| email | String | Único |
| password | String? | Hash Argon2; `null` para clientes (acceso solo por portal externo) |
| name | String | |
| role | `Role` | `ADMIN \| ADVISOR \| CLIENT` (default `CLIENT`) |
| address, phone, birthDate, age | | Datos demográficos |
| profilePhotoUrl | String? | |
| documentType / documentNumber | `DocumentType`? / String? | `CC \| DNI \| PASSPORT \| OTHER` |
| biometricType | `BiometricType`? | Solo CLIENT |
| biometricMethods | `BiometricMethod[]` | `DACTILAR \| FACIAL \| OCULAR` |
| biometricEnrollmentRequired | Boolean | Indica si falta enrolamiento |
| biometricEnrollmentCompletedAt / RequestedAt | DateTime? | |
| empresaId / empresa | FK → Empresa | `onDelete: SetNull` |
| createdById / createdBy | FK → User | Relación jerárquica (Admin → Advisor → Client) |

### `Session`
Sesiones de Lucia: `id` (PK), `userId` (FK, `onDelete: Cascade`), `expiresAt`.

### `AuditLog`
Registro de auditoría: `action`, `entity`, `entityId`, `details` (JSON), `userId` (FK, `SetNull`), `createdAt`. Se registran acciones como `LOGIN`, `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`, `BIOMETRIC_ENROLLMENT_REQUESTED`, `BIOMETRIC_ENROLLMENT_COMPLETED`, `BIOMETRIC_ENROLLMENT_RESET`, `CLIENT_DATA_VERIFICATION_SUCCESS/FAILED`, `LOGIN_AS`, `CHANGE_PASSWORD`, `ASSIGN_ADVISOR`, `UNASSIGN_ADVISOR`, `CREATE` (empresa).

---

## Roles y permisos (RBAC)

Reglas definidas en `server/src/utils/roles.ts` y aplicadas por `roleMiddleware.ts`:

| Acción | ADMIN | ADVISOR | CLIENT |
|--------|:-----:|:-------:|:------:|
| Ver/listar usuarios | ✅ | ✅ (solo sus clientes) | ❌ |
| Crear usuarios | ✅ (solo ADVISOR) | ✅ (solo CLIENT) | ❌ |
| Actualizar/eliminar usuarios | ✅ | ✅ (solo sus clientes, campos limitados) | ❌ |
| Gestionar empresas | ✅ | ❌ | ❌ |
| Asignar/desasignar asesores | ✅ | ❌ | ❌ |
| Solicitar/resetear enrolamiento biométrico | ✅ | ✅ (solo sus clientes) | ❌ |
| Login-as (impersonar) | ✅ | ❌ | ❌ |
| Ver estadísticas | ✅ (globales) | ✅ (solo su empresa/clientes) | ❌ |

**Reglas adicionales en `createUser`:**
- Un ADMIN **no puede** crear clientes directamente; primero crea un asesor.
- Un ADVISOR debe pertenecer a una empresa para crear clientes.
- Todo cliente requiere al menos un método biométrico y **DACTILAR es obligatorio**.

---

## API REST

Base: `http://localhost:3000/api`. Autenticación por cookie `auth_session` (`withCredentials: true`). Documentación interactiva (OpenAPI/Swagger) en `/api/docs`.

### Autenticación — `/api/auth`
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/auth/login` | Inicio de sesión (email + contraseña). Rate limit: 5 intentos/hora | Público |
| POST | `/auth/client-verify` | Verifica identidad de un cliente por documento | Público |
| POST | `/auth/biometric-enrollment/complete` | Marca el enrolamiento como completado (`completedMethods`) | Autenticado |
| POST | `/auth/logout` | Cierra sesión | Autenticado |
| GET | `/auth/me` | Usuario actual (incluye empresa) | Autenticado |
| PATCH | `/auth/change-password` | Cambio de contraseña (invalida sesiones previas) | Autenticado |

### Usuarios — `/api/users` (todas requieren auth)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/users?role=` | Listar usuarios | Admin / Asesor |
| GET | `/users/:id` | Detalle de usuario | Admin / Asesor |
| POST | `/users` | Crear usuario (asesor o cliente) | Admin / Asesor |
| PATCH | `/users/:id` | Actualizar usuario | Admin / Asesor |
| DELETE | `/users/:id` | Eliminar usuario | Admin / Asesor |
| PATCH | `/users/:id/biometric-reset` | Re-enrolamiento biométrico | Admin / Asesor |
| POST | `/users/:id/biometric-request` | Solicitar enrolamiento y enviar email | Admin / Asesor |
| POST | `/users/:userId/login-as` | Impersonar usuario | Solo Admin |

### Empresas — `/api/companies` (todas requieren auth)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/companies` | Listar empresas | Solo Admin |
| GET | `/companies/available-advisors` | Asesores disponibles para asignar | Solo Admin |
| GET | `/companies/:id` | Detalle de empresa (asesores + clientes) | Admin / Asesor (solo su empresa) |
| GET | `/companies/:id/audit-logs` | Bitácora de auditoría de la empresa | Admin / Asesor (solo su empresa) |
| POST | `/companies` | Crear empresa (nombre, NIT, logo, descripción) | Solo Admin |
| PATCH | `/companies/:id/advisors/:advisorId` | Asignar asesor | Solo Admin |
| DELETE | `/companies/:id/advisors/:advisorId` | Desasignar asesor | Solo Admin |

### Estadísticas — `/api/stats` (todas requieren auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/stats/users` | Total de usuarios (según rol) |
| GET | `/stats/dashboard` | KPIs: Admin → totales globales + desglose por empresa; Asesor → sus clientes, tasa de completitud, actividad semanal |

---

## Seguridad

- **Contraseñas**: hash **Argon2** (`@node-rs/argon2`, parámetros: `memoryCost 19456`, `timeCost 2`, `outputLen 32`).
- **Sesiones**: **Lucia** con cookies httpOnly (`auth_session`), `secure` en producción. Cambiar contraseña invalida todas las sesiones previas del usuario.
- **Rate limiting** (`express-rate-limit`):
  - Global `/api`: 100 peticiones / 15 minutos.
  - Login `/api/auth/login`: 5 intentos / hora.
- **CORS**: orígenes permitidos desde la variable `ALLOWED_ORIGINS` (por defecto `http://localhost:5173`, `http://localhost:4321`, `https://admin.smartbiometrics.org`, `https://uscis.smartbiometrics.org`), con `credentials: true`.
- **Validación**: Zod en todas las rutas con datos (body/params/query).
- **Manejo de errores global**: `AppError` con código HTTP; mapeo de errores Prisma (`P2002` → 409, `P2025` → 404); límite de cuerpo configurable (`BODY_LIMIT`, default `8mb`) → 413; detalles de error solo en desarrollo.
- **Roles en la API**: se aplican autorizaciones de backend (no solo de UI), p. ej. un asesor solo ve/edita los clientes que él creó dentro de su empresa.
- **Registro de auditoría** en cada acción sensible.

---

## Configuración del entorno

### Variables del servidor (`server/.env`)
| Variable | Requerida | Descripción | Ejemplo |
|----------|:---------:|-------------|---------|
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL | `postgresql://postgres:password@localhost:5432/auth_bio` |
| `PORT` | ❌ | Puerto del servidor | `3000` |
| `RESEND_API_KEY` | ✅* | API key de Resend para emails | `re_...` |
| `NODE_ENV` | ❌ | `development` / `production` | `development` |
| `ALLOWED_ORIGINS` | ❌ | Orígenes CORS separados por coma | `http://localhost:5173,http://localhost:4321` |
| `BODY_LIMIT` | ❌ | Límite de tamaño del body | `8mb` |
| `CLIENT_URL` | ❌ | URL del portal público para enlaces de email | `https://uscis.smartbiometrics.org` |
| `CLIENT_PUBLIC_DIR` | ❌ | Carpeta pública donde se persisten imágenes | `../client/public` (default) |
| `R2_ACCOUNT_ID` | ❌* | ID de cuenta Cloudflare para el endpoint S3 de R2 | `0123456789abcdef...` |
| `R2_ACCESS_KEY_ID` | ❌* | Access key de un token API de R2 | `...` |
| `R2_SECRET_ACCESS_KEY` | ❌* | Secret key de un token API de R2 | `...` |
| `R2_BUCKET_NAME` | ❌* | Bucket donde se guardan logos y fotos | `smartbiometrics-images` |
| `R2_PUBLIC_URL` | ❌* | Dominio público del bucket, sin `/` final | `https://images.example.com` |

\* Necesaria para el envío de correos (onboarding de asesores y solicitudes biométricas).
Las variables marcadas con `❌*` deben configurarse todas juntas para activar R2. Si se omiten todas, el desarrollo usa `CLIENT_PUBLIC_DIR` como fallback local.

### Variables del frontend (`client/.env`, `web/.env`)
| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (default `http://localhost:3000/api`) |

---

## Puesta en marcha

Requisitos: **Node.js 20+**, **Docker** (para la base de datos) o una instancia de PostgreSQL 15.

### 1. Base de datos (PostgreSQL con Docker)

```bash
cd server
docker compose up -d
```

### 2. Servidor

```bash
cd server
npm install
cp .env.example .env          # o crea server/.env con DATABASE_URL, PORT, RESEND_API_KEY
npm run prisma:generate       # genera el cliente Prisma
npm run prisma:push           # o: npx prisma migrate deploy
npm run dev                   # arranca con tsx watch en http://localhost:3000
```

### 3. Back-office (client)

```bash
cd client
npm install
cp .env.example .env          # o crea client/.env con VITE_API_URL
npm run dev                   # http://localhost:5173
```

### 4. Portal público (web)

```bash
cd web
npm install
npm run dev                   # http://localhost:5174 (u otro puerto)
```

### 5. Crear el usuario administrador

```bash
cd server
npm run create-admin
```

El script (`src/scripts/createAdmin.ts`) crea un usuario `ADMIN` con credenciales por defecto definidas dentro del script y las muestra en consola. **Cámbialas tras el primer inicio de sesión.**

---

## Scripts disponibles

### Servidor (`server/package.json`)
| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo con recarga en caliente (`tsx watch`) |
| `npm run build` | Compilar TypeScript (`tsc`) |
| `npm start` | `prisma migrate deploy` + ejecutar `dist/index.js` |
| `npm test` / `npm run test:watch` | Ejecutar Vitest |
| `npm run prisma:generate` | Generar cliente Prisma |
| `npm run prisma:push` | Sincronizar schema a la DB (`prisma db push`) |
| `npm run create-admin` | Crear/actualizar el usuario admin |

### Frontends (`client/` y `web/`)
| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Typecheck + build de producción |
| `npm run lint` | ESLint |
| `npm run preview` | Previsualizar el build |

---

## Flujo de verificación biométrica (detalle)

1. **Admin** crea una empresa (nombre, NIT, logo, descripción) y asesores.
2. **Admin** asigna asesores a la empresa.
3. **Asesor** crea clientes con: documento (tipo + número), datos personales, foto de perfil y métodos biométricos (DACTILAR obligatorio; FACIAL/OCULAR opcionales).
4. El asesor solicita el enrolamiento (`POST /users/:id/biometric-request`); el sistema envía un email al cliente con un enlace a `/verification?clientId=...&methods=...`.
5. El cliente abre el **portal web** (`/`), ingresa tipo y número de documento (`POST /auth/client-verify`). El sistema valida, enmascara el documento, crea una sesión y registra auditoría.
6. El cliente confirma sus datos y pasa a `/verification`, donde completa cada método biométrico asignado en orden (dedos, rostro, iris). Al terminar, `POST /auth/biometric-enrollment/complete` valida que los métodos coincidan con los asignados y marca `biometricEnrollmentRequired = false`.
7. El dashboard refleja el progreso: tasa de completitud por empresa (Admin) y por cliente (Asesor).

**Resolución de métodos en el portal web** (prioridad): parámetro `?methods=` de la URL → estado del router → `localStorage.clientBiometricMethods` → fallback `['DACTILAR']`.

---

## Notas de desarrollo

- **Simuladores de demostración**: los tres componentes usan probabilidad aleatoria para el éxito y las imágenes de cámara no se analizan. La cámara se detiene al salir del simulador (`useCamera` limpia los tracks en unmount).
- **Persistencia de imágenes**: con R2 configurado, los logos y fotos de perfil enviados como data-URL se suben al bucket en `<empresa-sanitizada>/<tipo>-<timestamp>-<id>.<extensión>` y se devuelve su URL pública. Sin configuración R2, el desarrollo usa `client/public/<empresa-sanitizada>/` como fallback local (`utils/imageStorage.ts`).
- **Código muerto existente**: en `client`, `ticketService.ts` y `statsService.getUserStats` no se usan; el árbol de traducciones i18n contiene llaves heredadas de un módulo de tickets/coordinador. En `server/dist` quedan artefactos de builds antiguos (email/SMTP, PayPal, Cloudflare R2, pricing, workflow) sin equivalente en `src`.
- **Tests**: Vitest configurado (`server/vitest.config.ts`, patrón `src/**/*.test.ts`). Actualmente no hay archivos de test en el repositorio.
- **Repositorio**: `https://github.com/ldmora13/auth-bio.git` (rama `main`).

---

## Licencia

El proyecto no declara licencia explícita (licencia `ISC` en `server/package.json`).
