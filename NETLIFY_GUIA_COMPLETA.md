# Guía Completa: Desplegar en Netlify + Backend Remoto

## 🚀 Resumen Rápido

Tu sistema tiene dos partes:
- **Frontend**: HTML/CSS/JS → Se despliega en **Netlify**
- **Backend**: Node.js + Express + MongoDB → Se despliega en **Railway, Render o Heroku**

---

## 📋 Paso 1: Preparar el Frontend

### 1.1 Crear repositorio de GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tuusuario/sistema-restaurante
git push -u origin main
```

### 1.2 Archivos necesarios

✅ Ya incluidos:
- `netlify.toml` - Configuración de Netlify
- `.env.example` - Variables de ejemplo
- `js/config.js` - Configuración dinámica

---

## 🌐 Paso 2: Desplegar Frontend en Netlify

### 2.1 Acceder a Netlify

1. Ve a https://app.netlify.com
2. Haz clic en "New site from Git"
3. Selecciona GitHub y autoriza
4. Busca el repositorio `sistema-restaurante`

### 2.2 Configurar Build

```
Build command: (dejar vacío)
Publish directory: .
```

### 2.3 Agregar Variables de Entorno

En **Site settings → Build & deploy → Environment**:

```
VITE_API_URL=https://tu-backend.railway.app/api
```

✅ Tu frontend estará en: `https://tu-sitio.netlify.app`

---

## 🔧 Paso 3: Desplegar Backend en Railway (Recomendado)

### 3.1 Crear Cuenta en Railway

1. Ve a https://railway.app
2. Inicia sesión con GitHub
3. Crea un nuevo proyecto

### 3.2 Conectar tu Repositorio

1. Click en "New Project"
2. "Deploy from GitHub repo"
3. Selecciona `sistema-restaurante`
4. Selecciona la carpeta: `backend/`

### 3.3 Configurar Variables de Entorno

En el proyecto Railway, agrega:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/restaurante
CORS_ORIGIN=https://tu-sitio.netlify.app
```

### 3.4 Obtener URL del Backend

Railway asignará una URL como:
```
https://tu-backend-xxxxxx.railway.app
```

Copia esta URL.

---

## 🗄️ Paso 4: Configurar MongoDB Atlas

### 4.1 Crear Cluster Gratis

1. Ve a https://www.mongodb.com/cloud/atlas
2. Crea una cuenta
3. Crea un "Free Cluster"
4. Selecciona región
5. Crea un usuario de base de datos

### 4.2 Obtener Connection String

1. Click en "Connect"
2. Selecciona "Drivers"
3. Copia la URL: `mongodb+srv://username:password@cluster.mongodb.net/restaurante`
4. Reemplaza `<password>` con tu contraseña

### 4.3 Asegurar Acceso

1. En "Network Access"
2. Agrega: `0.0.0.0/0` (para permitir cualquier IP)

---

## 🔐 Paso 5: Actualizar Frontend con URL del Backend

### 5.1 En Netlify Environment

1. Site settings → Build & deploy → Environment
2. Edita `VITE_API_URL`
3. Cambia a: `https://tu-backend-xxxxxx.railway.app/api`

### 5.2 Desplegar cambios

```bash
git push origin main
```

Netlify se redesplegará automáticamente.

---

## ✅ Verificar Despliegue

### Test del Frontend
```
https://tu-sitio.netlify.app
```

### Test del Backend
```
https://tu-backend-xxxxxx.railway.app/api/health
```

Deberías recibir:
```json
{
  "status": "OK",
  "timestamp": "2026-01-05T..."
}
```

### Test de API
```bash
curl https://tu-backend-xxxxxx.railway.app/api/menu
```

---

## 🐛 Troubleshooting

### Error: CORS

**Solución:**
```bash
# En Railway, asegurar que CORS_ORIGIN esté configurado
CORS_ORIGIN=https://tu-sitio.netlify.app
```

### Error: MongoDB Connection Refused

**Solución:**
1. Verificar MONGODB_URI es correcta
2. Verificar que MongoDB Atlas permite la IP (0.0.0.0/0)
3. Verificar usuario/contraseña

### Error: API_URL undefined

**Solución:**
En `cliente.js` y `admin.js`, cambiar:
```javascript
this.API_URL = 'http://localhost:3000/api';
```

Por:
```javascript
this.API_URL = window.__API_URL__ || 
              (window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://tu-backend-xxxxxx.railway.app/api');
```

---

## 📊 Arquitectura Final

```
Internet
    ↓
┌─────────────────────────────────────────┐
│ NETLIFY (Frontend)                      │
│ https://tu-sitio.netlify.app            │
│ - index.html                            │
│ - cliente.html                          │
│ - admin.html                            │
│ - css/                                  │
│ - js/                                   │
└─────────────────────────────────────────┘
         ↓ (API calls)
┌─────────────────────────────────────────┐
│ RAILWAY (Backend)                       │
│ https://tu-backend.railway.app          │
│ - Node.js + Express                     │
│ - REST API (/api/...)                   │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ MONGODB ATLAS (Base de Datos)           │
│ mongodb+srv://...                       │
│ - Collections: Menu, Mesa, Pedido, etc. │
└─────────────────────────────────────────┘
```

---

## 🎉 Listo!

Tu sistema está desplegado en la nube y accesible desde cualquier lugar.

**URLs Finales:**
- 🌐 Frontend: `https://tu-sitio.netlify.app`
- 🔧 Backend: `https://tu-backend.railway.app`
- 🗄️ MongoDB: Cloud Atlas

¡Éxito! 🚀
