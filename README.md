# 🍽️ Sistema de Gestión de Restaurante

Sistema completo de gestión para restaurantes con pedidos en tiempo real, administración de mesas, menú, inventario y facturación.

---

## ✨ Características

- **Tiempo real** — pedidos y cambios de estado sincronizados al instante (Socket.IO)
- **3 roles** — Administrador, Mesero y Cocinero con vistas independientes
- **Gestión de mesas** — alta, baja, modificación y estado visual
- **Menú configurable** — categorías, precios, disponibilidad desde el panel admin
- **Inventario** — control de stock con alertas de nivel bajo
- **Facturación** — cálculo automático, método de pago, historial completo
- **Historial de pedidos** — todos los pedidos cobrados/cancelados se conservan
- **Acceso en red local** — múltiples dispositivos en la misma red (celulares, tablets, PC)

---

## 🖥️ Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [Python](https://www.python.org/) 3.x (para el servidor del frontend)
- Windows 10/11 (los scripts `.ps1` son para PowerShell)

---

## 🚀 Instalación

### 1. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 2. Iniciar el sistema

**Opción A — Script automático (recomendado):**

Doble clic en `iniciar.ps1`
*(o clic derecho → Ejecutar con PowerShell)*

**Opción B — Manual:**

```bash
# Terminal 1 — Backend
cd backend
node server.js

# Terminal 2 — Frontend
cd frontend
python -m http.server 5500
```

### 3. Abrir en el navegador

| Panel | URL |
|-------|-----|
| Acceso principal | http://localhost:5500 |
| Administrador | http://localhost:5500/admin.html |
| Mesero / Cliente | http://localhost:5500/cliente.html |
| Cocina | http://localhost:5500/cocina.html |

---

## 🔑 Credenciales iniciales

> ⚠️ **Importante:** Cambia estas contraseñas desde el panel de administración antes de poner el sistema en producción.

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |
| `mesero` | `mesero123` | Mesero |
| `cocinero` | `cocinero123` | Cocinero |

---

## ⚙️ Configuración inicial (primera vez)

Al iniciar por primera vez el sistema estará **vacío** — sin menú, sin mesas ni inventario. El administrador debe configurar el restaurante desde el panel admin:

1. **Iniciar sesión** como `admin`
2. Ir a la sección **Mesas** → agregar las mesas del local
3. Ir a la sección **Menú** → crear categorías y platos con sus precios
4. *(Opcional)* Ir a **Inventario** → registrar los insumos del restaurante

---

## 🌐 Acceso desde otros dispositivos (red local)

Para usar el sistema desde celulares, tablets u otras computadoras en la misma red:

1. Conocer la IP local de la PC servidor (ej. `192.168.1.100`)
2. En `frontend/js/config.js`, actualizar la IP:
   ```js
   const SERVER_IP = '192.168.1.100';
   ```
3. Desde cualquier dispositivo en la misma red, abrir:
   ```
   http://192.168.1.100:5500
   ```

Ver guía completa en [docs/EJECUTAR_RED_LOCAL.md](docs/EJECUTAR_RED_LOCAL.md)

---

## 🛑 Detener el sistema

Doble clic en `detener.ps1`
*(o clic derecho → Ejecutar con PowerShell)*

---

## 📁 Estructura del proyecto

```
├── backend/
│   ├── server.js          # Servidor principal (API REST + Socket.IO)
│   └── package.json
├── frontend/
│   ├── index.html         # Página de inicio / login
│   ├── admin.html         # Panel de administración
│   ├── cliente.html       # Vista del mesero
│   ├── cocina.html        # Vista de cocina
│   ├── css/
│   └── js/
├── docs/
│   └── EJECUTAR_RED_LOCAL.md
├── iniciar.ps1            # Script para iniciar el sistema
└── detener.ps1            # Script para detener el sistema
```

---

## 🗄️ Base de datos

Se usa **SQLite** — no requiere instalación adicional. La base de datos se crea automáticamente en `backend/restaurante.db` al iniciar el sistema por primera vez.

Para hacer una copia de seguridad, simplemente copia el archivo `restaurante.db`.

---

## 🛠️ Tecnologías

| Componente | Tecnología |
|-----------|-----------|
| Backend | Node.js + Express |
| Base de datos | SQLite (better-sqlite3) |
| Tiempo real | Socket.IO |
| Autenticación | JWT + bcrypt |
| Frontend | HTML + CSS + JavaScript (Vanilla) |
| Mapas (delivery) | Leaflet.js |