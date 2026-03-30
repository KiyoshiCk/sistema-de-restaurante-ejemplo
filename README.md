# 🍽️ Sistema de Gestión de Restaurante

Sistema completo para gestionar restaurantes con menú, mesas, pedidos y facturación. Funciona 100% local con **SQLite** (sin necesidad de servicios externos).

## 📁 Estructura del Proyecto

```
├── frontend/           # Interfaz de usuario
│   ├── css/           # Estilos
│   ├── js/            # JavaScript del cliente
│   ├── index.html     # Página principal
│   ├── admin.html     # Panel de administración
│   ├── cliente.html   # Vista del cliente
│   └── cocina.html    # Vista de cocina
├── backend/           # Servidor Node.js + Express
│   ├── server.js      # API REST + WebSocket
│   ├── package.json
│   └── restaurante.db # Base de datos SQLite (se crea automáticamente)
├── docs/              # Documentación
├── iniciar.ps1        # Script para iniciar todo
├── detener.ps1        # Script para detener todo
└── README.md
```

## 🚀 Características

- **Dashboard**: Estadísticas en tiempo real con actividad por usuario y rol
- **Gestión de Menú**: CRUD de platillos con fotos, categorías, iconos y disponibilidad
- **Gestión de Mesas**: Control de disponibilidad, ocupación, resumen visual y consumo activo
- **Sistema de Pedidos**: Flujo completo pendiente → preparación → listo → entregado, con filtros por estado
- **Cobro y División de Cuenta**: Cobrar mesas con método de pago, dividir cuenta entre personas
- **Facturación**: Historial de facturas con estadísticas por día, semana y mes
- **Reportes**: Ventas por período, platillos top, mesas activas, horas pico, ventas por categoría
- **Inventario**: Control de stock con 5 niveles de estado, alertas por severidad, historial de costos, ajuste personalizado con actualización de precios
- **Gestión de Usuarios**: CRUD de usuarios con roles (admin, mesero, cocinero) y contraseñas hasheadas
- **Ubicación**: Mapa interactivo con Leaflet para configurar dirección del restaurante
- **Logo Personalizable**: Subida de logo que se refleja en favicon, header y vista del cliente
- **Backup/Restore**: Exportar e importar todos los datos del sistema (menú, mesas, pedidos, facturas, inventario, usuarios)
- **Vista Cocina**: Panel dedicado con pedidos en tiempo real y notificaciones
- **Vista Cliente**: Menú digital público con hero parallax, SEO completo (Schema.org, Open Graph, sitemap)
- **WebSocket**: Actualizaciones en tiempo real entre admin, cocina y meseros
- **Acceso en Red Local**: Usa desde celular, tablet u otra PC en tu WiFi

## 👥 Roles de Usuario

> ⚠️ **Cambia estas contraseñas desde el panel Admin antes de usar el sistema en producción.**

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| mesero | mesero123 | Mesero |
| cocinero | cocinero123 | Cocinero |

## 🛠️ Inicio Rápido

### Opción 1: Script automático (Recomendado)
```powershell
cd "f:\sistema de restaurante"
powershell -ExecutionPolicy Bypass -File iniciar.ps1
```

### Opción 2: Manual
```powershell
# Terminal 1 - Backend
cd backend
npm install
node server.js

# Terminal 2 - Frontend
cd frontend
python -m http.server 5500 --bind 0.0.0.0
```

## 📱 Acceso

Una vez iniciado, accede desde cualquier dispositivo en tu red:

| Página | URL |
|--------|-----|
| Inicio | `http://TU_IP:5500/` |
| Admin | `http://TU_IP:5500/admin.html` |
| Cliente | `http://TU_IP:5500/cliente.html` |
| Cocina | `http://TU_IP:5500/cocina.html` |

## 🛑 Detener

```powershell
powershell -ExecutionPolicy Bypass -File detener.ps1
```

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express, Socket.IO
- **Base de datos**: SQLite (better-sqlite3) - local, gratis, sin servidor
- **Autenticación**: JWT + bcrypt

## 📱 Responsive

El sistema es completamente responsive y funciona en dispositivos móviles, tablets y desktop.
