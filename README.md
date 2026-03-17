# 🍽️ Sistema de Gestión de Restaurante

Sistema completo para gestionar restaurantes con menú, mesas, pedidos y facturación.

## � Estructura del Proyecto

```
├── frontend/           # Interfaz de usuario
│   ├── css/           # Estilos
│   ├── js/            # JavaScript del cliente
│   ├── index.html     # Página principal
│   ├── admin.html     # Panel de administración
│   ├── cliente.html   # Vista del cliente
│   └── cocina.html    # Vista de cocina
├── backend/           # Servidor Node.js + Express
│   ├── server.js      # API REST
│   └── package.json
├── netlify/           # Funciones serverless para Netlify
│   └── functions/
├── docs/              # Documentación adicional
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## 🚀 Características

- **Dashboard**: Estadísticas en tiempo real
- **Gestión de Menú**: Agregar, editar y eliminar platillos por categorías
- **Gestión de Mesas**: Control de disponibilidad y ocupación
- **Sistema de Pedidos**: Flujo completo desde toma hasta entrega
- **Facturación**: Historial y reportes de ventas

## 👥 Roles de Usuario

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| mesero | mesero123 | Mesero |
| cocinero | cocinero123 | Cocinero |

## 🛠️ Desarrollo Local

### Backend
```bash
cd backend
npm install
$env:MONGODB_URI="mongodb+srv://admin:admin123@cluster0.yqpcckd.mongodb.net/restaurante"
node server.js
```

### Frontend
Abrir `frontend/index.html` con Live Server en el puerto 5500.

## 📦 Instalación con Docker

### Opción 1: Con Docker Compose (Recomendado)

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Opción 2: Con Docker

```bash
# Construir imagen
docker build -t sistema-restaurante .

# Ejecutar contenedor
docker run -d -p 8080:80 --name sistema-restaurante sistema-restaurante

# Ver logs
docker logs -f sistema-restaurante

# Detener y eliminar
docker stop sistema-restaurante
docker rm sistema-restaurante
```

## 🌐 Acceso

Una vez iniciado el contenedor, abre tu navegador en:

**http://localhost:8081**

## 💻 Uso sin Docker

Simplemente abre el archivo `index.html` en tu navegador.

## 🛠️ Tecnologías

- HTML5
- CSS3
- JavaScript (Vanilla)
- Nginx (Docker)
- LocalStorage para persistencia de datos

## 📱 Responsive

El sistema es completamente responsive y funciona en dispositivos móviles, tablets y desktop.
