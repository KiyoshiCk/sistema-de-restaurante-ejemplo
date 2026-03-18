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

- **Dashboard**: Estadísticas en tiempo real
- **Gestión de Menú**: Agregar, editar y eliminar platillos por categorías
- **Gestión de Mesas**: Control de disponibilidad y ocupación
- **Sistema de Pedidos**: Flujo completo desde toma hasta entrega
- **Facturación**: Historial y reportes de ventas
- **WebSocket**: Actualizaciones en tiempo real entre admin, cocina y meseros
- **Acceso en Red Local**: Usa desde celular, tablet u otra PC en tu WiFi

## 👥 Roles de Usuario

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
