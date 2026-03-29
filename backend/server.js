const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;

// JWT_SECRET: usar variable de entorno o generar uno seguro por instalación
const JWT_SECRET_PATH = path.join(__dirname, '.jwt_secret');
const getJwtSecret = () => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    try {
        const fs = require('fs');
        if (fs.existsSync(JWT_SECRET_PATH)) {
            return fs.readFileSync(JWT_SECRET_PATH, 'utf8').trim();
        }
        const secret = crypto.randomBytes(64).toString('hex');
        fs.writeFileSync(JWT_SECRET_PATH, secret);
        return secret;
    } catch {
        return crypto.randomBytes(64).toString('hex');
    }
};
const JWT_SECRET = getJwtSecret();

// ============= BASE DE DATOS SQLite =============
const DB_PATH = path.join(__dirname, 'restaurante.db');
const db = new Database(DB_PATH);

// Habilitar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`📦 Base de datos SQLite: ${DB_PATH}`);

// Helper: generar ID único
const generarId = () => crypto.randomBytes(12).toString('hex');

const logError = (context, error) => {
    console.error(`❌ ${context}:`, error);
};

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

// ============= UPLOADS (Logo) =============
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(uploadsDir));

// Configurar multer para subida de logo
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `logo${ext}`);
    }
});
const uploadLogo = multer({
    storage: logoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP, SVG)'));
        }
    }
});

// ============= MIDDLEWARE DE AUTENTICACIÓN =============
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

// Middleware para verificar rol de administrador
const soloAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'administrador') {
        return res.status(403).json({ error: 'Acceso solo para administradores' });
    }
    next();
};

// Middleware para verificar rol de mesero o administrador
const soloMeseroOAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'administrador' && req.usuario.rol !== 'mesero') {
        return res.status(403).json({ error: 'Acceso solo para meseros y administradores' });
    }
    next();
};

// ============= CREAR TABLAS =============
db.exec(`
    CREATE TABLE IF NOT EXISTS config (
        _id TEXT PRIMARY KEY,
        nombre TEXT DEFAULT '',
        slogan TEXT DEFAULT '',
        descripcion TEXT DEFAULT '',
        telefono TEXT DEFAULT '',
        email TEXT DEFAULT '',
        whatsapp TEXT DEFAULT '',
        horarioSemana TEXT DEFAULT '',
        horarioDomingo TEXT DEFAULT '',
        horaAbre TEXT DEFAULT '',
        horaCierra TEXT DEFAULT '',
        horaAbreDom TEXT DEFAULT '',
        horaCierraDom TEXT DEFAULT '',
        metodosPago TEXT DEFAULT '',
        moneda TEXT DEFAULT 'S/',
        monedaCodigo TEXT DEFAULT 'PEN',
        cocinas TEXT DEFAULT '',
        ciudad TEXT DEFAULT '',
        barrio TEXT DEFAULT '',
        direccion TEXT DEFAULT '',
        codigoPostal TEXT DEFAULT '',
        region TEXT DEFAULT '',
        lat REAL DEFAULT -8.1713,
        lng REAL DEFAULT -78.5143,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu (
        _id TEXT PRIMARY KEY,
        nombre TEXT,
        categoria TEXT,
        precio REAL,
        descripcion TEXT,
        disponible INTEGER DEFAULT 1,
        icono TEXT,
        imagen TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mesas (
        _id TEXT PRIMARY KEY,
        numero INTEGER,
        capacidad INTEGER,
        estado TEXT DEFAULT 'disponible',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
        _id TEXT PRIMARY KEY,
        mesaId TEXT,
        mesaNumero INTEGER,
        items TEXT DEFAULT '[]',
        estado TEXT,
        total REAL,
        fecha TEXT DEFAULT (datetime('now')),
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (mesaId) REFERENCES mesas(_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS facturas (
        _id TEXT PRIMARY KEY,
        numeroFactura TEXT,
        mesaNumero INTEGER,
        pedidoIds TEXT DEFAULT '[]',
        items TEXT DEFAULT '[]',
        subtotal REAL,
        impuesto REAL,
        total REAL,
        metodoPago TEXT,
        fecha TEXT DEFAULT (datetime('now')),
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS actividad (
        _id TEXT PRIMARY KEY,
        tipo TEXT,
        descripcion TEXT,
        usuario TEXT,
        fecha TEXT DEFAULT (datetime('now')),
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        _id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT CHECK(rol IN ('administrador', 'mesero', 'cocinero')) NOT NULL,
        activo INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventario (
        _id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        categoria TEXT DEFAULT 'General',
        cantidad REAL DEFAULT 0,
        unidad TEXT DEFAULT 'unidades',
        stockMinimo REAL DEFAULT 10,
        costo REAL DEFAULT 0,
        costoAnterior REAL DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historial_costos (
        _id TEXT PRIMARY KEY,
        inventarioId TEXT NOT NULL,
        costoAnterior REAL NOT NULL,
        costoNuevo REAL NOT NULL,
        variacion REAL NOT NULL,
        fecha TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (inventarioId) REFERENCES inventario(_id) ON DELETE CASCADE
    );
`);

// ============= ÍNDICES =============
try {
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
        CREATE INDEX IF NOT EXISTS idx_pedidos_mesaId ON pedidos(mesaId);
        CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
        CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha);
        CREATE INDEX IF NOT EXISTS idx_facturas_mesaNumero ON facturas(mesaNumero);
        CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON inventario(categoria);
        CREATE INDEX IF NOT EXISTS idx_actividad_fecha ON actividad(fecha);
        CREATE INDEX IF NOT EXISTS idx_historial_costos_inventarioId ON historial_costos(inventarioId);
    `);
} catch {}

// Migración: agregar costoAnterior si no existe
try {
    db.prepare('SELECT costoAnterior FROM inventario LIMIT 1').get();
} catch {
    try { db.prepare('ALTER TABLE inventario ADD COLUMN costoAnterior REAL DEFAULT 0').run(); } catch {}
}

// Migración: agregar pedidoIds a facturas si no existe
try {
    db.prepare('SELECT pedidoIds FROM facturas LIMIT 1').get();
} catch {
    try { db.prepare("ALTER TABLE facturas ADD COLUMN pedidoIds TEXT DEFAULT '[]'").run(); } catch {}
}

// Migración: copiar numeroMesa a mesaNumero en pedidos existentes
try {
    db.prepare('SELECT numeroMesa FROM pedidos LIMIT 1').get();
    // Si la columna existe, copiar datos y dejarla (SQLite no puede DROP COLUMN fácilmente)
    db.prepare('UPDATE pedidos SET mesaNumero = numeroMesa WHERE mesaNumero IS NULL AND numeroMesa IS NOT NULL').run();
} catch {}

// Migración: agregar campos de identidad del restaurante a config
const configMigrations = [
    { col: 'nombre', sql: "ALTER TABLE config ADD COLUMN nombre TEXT DEFAULT ''" },
    { col: 'slogan', sql: "ALTER TABLE config ADD COLUMN slogan TEXT DEFAULT ''" },
    { col: 'descripcion', sql: "ALTER TABLE config ADD COLUMN descripcion TEXT DEFAULT ''" },
    { col: 'telefono', sql: "ALTER TABLE config ADD COLUMN telefono TEXT DEFAULT ''" },
    { col: 'email', sql: "ALTER TABLE config ADD COLUMN email TEXT DEFAULT ''" },
    { col: 'whatsapp', sql: "ALTER TABLE config ADD COLUMN whatsapp TEXT DEFAULT ''" },
    { col: 'horarioSemana', sql: "ALTER TABLE config ADD COLUMN horarioSemana TEXT DEFAULT ''" },
    { col: 'horarioDomingo', sql: "ALTER TABLE config ADD COLUMN horarioDomingo TEXT DEFAULT ''" },
    { col: 'horaAbre', sql: "ALTER TABLE config ADD COLUMN horaAbre TEXT DEFAULT ''" },
    { col: 'horaCierra', sql: "ALTER TABLE config ADD COLUMN horaCierra TEXT DEFAULT ''" },
    { col: 'horaAbreDom', sql: "ALTER TABLE config ADD COLUMN horaAbreDom TEXT DEFAULT ''" },
    { col: 'horaCierraDom', sql: "ALTER TABLE config ADD COLUMN horaCierraDom TEXT DEFAULT ''" },
    { col: 'metodosPago', sql: "ALTER TABLE config ADD COLUMN metodosPago TEXT DEFAULT ''" },
    { col: 'moneda', sql: "ALTER TABLE config ADD COLUMN moneda TEXT DEFAULT 'S/'" },
    { col: 'monedaCodigo', sql: "ALTER TABLE config ADD COLUMN monedaCodigo TEXT DEFAULT 'PEN'" },
    { col: 'cocinas', sql: "ALTER TABLE config ADD COLUMN cocinas TEXT DEFAULT ''" },
    { col: 'codigoPostal', sql: "ALTER TABLE config ADD COLUMN codigoPostal TEXT DEFAULT ''" },
    { col: 'region', sql: "ALTER TABLE config ADD COLUMN region TEXT DEFAULT ''" },
];
for (const m of configMigrations) {
    try { db.prepare(`SELECT ${m.col} FROM config LIMIT 1`).get(); } catch {
        try { db.prepare(m.sql).run(); } catch {}
    }
}

// Migración: limpiar defaults hardcodeados de versiones anteriores
try {
    const cfg = db.prepare('SELECT nombre FROM config LIMIT 1').get();
    if (cfg && cfg.nombre === 'Mi Restaurante') {
        db.prepare(`UPDATE config SET 
            nombre='', horarioSemana='', horarioDomingo='', 
            horaAbre='', horaCierra='', horaAbreDom='', horaCierraDom='',
            metodosPago='', cocinas='', ciudad=''
            WHERE nombre='Mi Restaurante'`).run();
    }
} catch {}

// ============= HELPERS =============
const formatRow = (row, jsonFields = []) => {
    if (!row) return null;
    const obj = { ...row };
    for (const field of jsonFields) {
        if (obj[field] && typeof obj[field] === 'string') {
            try { obj[field] = JSON.parse(obj[field]); } catch { /* mantener string */ }
        }
    }
    if ('disponible' in obj) obj.disponible = Boolean(obj.disponible);
    if ('activo' in obj) obj.activo = Boolean(obj.activo);
    return obj;
};

const formatRows = (rows, jsonFields = []) => rows.map(r => formatRow(r, jsonFields));
const now = () => new Date().toISOString();

// ============= CONFIGURACIÓN DEL RESTAURANTE =============

app.get('/api/config', (req, res) => {
    try {
        let config = db.prepare('SELECT * FROM config LIMIT 1').get();
        if (!config) {
            const _id = generarId();
            db.prepare('INSERT INTO config (_id) VALUES (?)').run(_id);
            config = db.prepare('SELECT * FROM config WHERE _id = ?').get(_id);
        }
        res.json(config);
    } catch (error) {
        logError('Error al obtener configuración', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

app.put('/api/config', verificarToken, soloAdmin, (req, res) => {
    try {
        let config = db.prepare('SELECT * FROM config LIMIT 1').get();
        if (!config) {
            const _id = generarId();
            db.prepare('INSERT INTO config (_id) VALUES (?)').run(_id);
            config = db.prepare('SELECT * FROM config WHERE _id = ?').get(_id);
        }

        // Merge: usar valor enviado o mantener el existente
        const campos = [
            'nombre', 'slogan', 'descripcion', 'telefono', 'email', 'whatsapp',
            'horarioSemana', 'horarioDomingo', 'horaAbre', 'horaCierra',
            'horaAbreDom', 'horaCierraDom', 'metodosPago', 'moneda', 'monedaCodigo',
            'cocinas', 'ciudad', 'barrio', 'direccion', 'codigoPostal', 'region'
        ];
        const valores = {};
        for (const c of campos) {
            valores[c] = req.body[c] !== undefined ? req.body[c] : config[c];
        }
        valores.lat = typeof req.body.lat === 'number' ? req.body.lat : config.lat;
        valores.lng = typeof req.body.lng === 'number' ? req.body.lng : config.lng;

        const setClauses = [...campos, 'lat', 'lng'].map(c => `${c}=?`).join(', ');
        const params = [...campos.map(c => valores[c]), valores.lat, valores.lng, now(), config._id];

        db.prepare(`UPDATE config SET ${setClauses}, updatedAt=? WHERE _id=?`).run(...params);

        const updated = db.prepare('SELECT * FROM config WHERE _id = ?').get(config._id);
        res.json(updated);
    } catch (error) {
        logError('Error al actualizar configuración', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// ============= LOGO DEL RESTAURANTE =============

// Subir/cambiar logo
app.post('/api/config/logo', verificarToken, soloAdmin, (req, res) => {
    uploadLogo.single('logo')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'La imagen no debe superar 5MB' });
                }
                return res.status(400).json({ error: 'Error al subir archivo: ' + err.message });
            }
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }

        // Eliminar logos anteriores con extensiones diferentes
        const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const currentExt = path.extname(req.file.filename).toLowerCase();
        exts.forEach(ext => {
            if (ext !== currentExt) {
                const oldFile = path.join(uploadsDir, `logo${ext}`);
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
            }
        });

        const logoUrl = `/uploads/${req.file.filename}`;
        res.json({ message: 'Logo actualizado correctamente', logo: logoUrl });
    });
});

// Obtener logo actual
app.get('/api/config/logo', (req, res) => {
    try {
        const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        for (const ext of exts) {
            const logoPath = path.join(uploadsDir, `logo${ext}`);
            if (fs.existsSync(logoPath)) {
                return res.json({ logo: `/uploads/logo${ext}` });
            }
        }
        res.json({ logo: null });
    } catch (error) {
        logError('Error al obtener logo', error);
        res.status(500).json({ error: 'Error al obtener logo' });
    }
});

// Eliminar logo
app.delete('/api/config/logo', verificarToken, soloAdmin, (req, res) => {
    try {
        const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        let deleted = false;
        exts.forEach(ext => {
            const logoPath = path.join(uploadsDir, `logo${ext}`);
            if (fs.existsSync(logoPath)) {
                fs.unlinkSync(logoPath);
                deleted = true;
            }
        });
        res.json({ message: deleted ? 'Logo eliminado' : 'No había logo para eliminar', logo: null });
    } catch (error) {
        logError('Error al eliminar logo', error);
        res.status(500).json({ error: 'Error al eliminar logo' });
    }
});

// ============= SOCKET.IO =============

// Autenticación en el handshake de WebSocket
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token de autenticación requerido'));
    try {
        socket.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        next(new Error('Token inválido o expirado'));
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id} (${socket.usuario?.rol || 'desconocido'})`);

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📢 ${socket.id} se unió a la sala: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

const emitirEvento = (evento, datos) => {
    io.emit(evento, datos);
};

// ============= MIGRACIONES =============
try {
    const columnas = db.prepare("PRAGMA table_info(menu)").all();
    if (!columnas.find(c => c.name === 'imagen')) {
        db.exec('ALTER TABLE menu ADD COLUMN imagen TEXT');
        console.log('✅ Columna imagen agregada a menu');
    }
} catch (e) {
    console.log('Migración imagen ya aplicada o no necesaria');
}

// ============= INICIALIZACIÓN DE DATOS =============

const inicializarDatos = () => {
    try {
        const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu').get().count;
        const mesasCount = db.prepare('SELECT COUNT(*) as count FROM mesas').get().count;
        const usuariosCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;

        if (menuCount === 0) {
            const menuPeruano = [
                { nombre: "Ceviche de Pescado", categoria: "Entradas", precio: 35, descripcion: "Pescado fresco marinado en limón con ají limo, cebolla morada y camote", disponible: 1, icono: "🐟" },
                { nombre: "Causa Limeña", categoria: "Entradas", precio: 22, descripcion: "Papa amarilla con limón, ají amarillo, rellena de atún o pollo", disponible: 1, icono: "🥔" },
                { nombre: "Anticuchos de Corazón", categoria: "Entradas", precio: 28, descripcion: "Brochetas de corazón de res marinadas en especias peruanas", disponible: 1, icono: "🍢" },
                { nombre: "Tequeños", categoria: "Entradas", precio: 18, descripcion: "Deditos de masa rellenos de queso fresco", disponible: 1, icono: "🧀" },
                { nombre: "Lomo Saltado", categoria: "Platos Fuertes", precio: 42, descripcion: "Tiras de lomo fino salteado con cebolla, tomate, papas fritas y arroz", disponible: 1, icono: "🥩" },
                { nombre: "Ají de Gallina", categoria: "Platos Fuertes", precio: 38, descripcion: "Pollo deshilachado en crema de ají amarillo con papas y aceitunas", disponible: 1, icono: "🍗" },
                { nombre: "Arroz con Pollo", categoria: "Platos Fuertes", precio: 32, descripcion: "Arroz verde con cilantro acompañado de pollo y papa a la huancaína", disponible: 1, icono: "🍚" },
                { nombre: "Tacu Tacu con Lomo", categoria: "Platos Fuertes", precio: 45, descripcion: "Mezcla de arroz y frijoles frita con lomo saltado encima", disponible: 1, icono: "🍛" },
                { nombre: "Seco de Carne", categoria: "Platos Fuertes", precio: 40, descripcion: "Carne guisada con cilantro, frijoles y arroz", disponible: 1, icono: "🥘" },
                { nombre: "Pescado a lo Macho", categoria: "Platos Fuertes", precio: 48, descripcion: "Pescado frito con salsa de mariscos cremosa", disponible: 1, icono: "🐠" },
                { nombre: "Tallarín Saltado", categoria: "Platos Fuertes", precio: 35, descripcion: "Fideos salteados con carne o pollo al estilo chifa peruano", disponible: 1, icono: "🍝" },
                { nombre: "Chicharrón de Pescado", categoria: "Platos Fuertes", precio: 38, descripcion: "Trozos de pescado frito crocante con yuca y salsa criolla", disponible: 1, icono: "🍤" },
                { nombre: "Inca Kola", categoria: "Bebidas", precio: 8, descripcion: "La bebida nacional del Perú, sabor único", disponible: 1, icono: "🥤" },
                { nombre: "Chicha Morada", categoria: "Bebidas", precio: 10, descripcion: "Refresco de maíz morado con especias y frutas", disponible: 1, icono: "🍹" },
                { nombre: "Pisco Sour", categoria: "Bebidas", precio: 25, descripcion: "Cóctel de pisco, limón, jarabe y clara de huevo", disponible: 1, icono: "🍸" },
                { nombre: "Emoliente", categoria: "Bebidas", precio: 7, descripcion: "Bebida caliente de hierbas medicinales", disponible: 1, icono: "☕" },
                { nombre: "Limonada Frozen", categoria: "Bebidas", precio: 12, descripcion: "Limonada peruana bien helada", disponible: 1, icono: "🍋" },
                { nombre: "Suspiro Limeño", categoria: "Postres", precio: 18, descripcion: "Manjar blanco con merengue de oporto", disponible: 1, icono: "🍮" },
                { nombre: "Mazamorra Morada", categoria: "Postres", precio: 15, descripcion: "Postre de maíz morado con frutas", disponible: 1, icono: "🍇" },
                { nombre: "Picarones", categoria: "Postres", precio: 16, descripcion: "Buñuelos de zapallo con miel de chancaca", disponible: 1, icono: "🍩" },
                { nombre: "Alfajores", categoria: "Postres", precio: 12, descripcion: "Galletas rellenas de manjar blanco", disponible: 1, icono: "🍪" },
                { nombre: "Arroz con Leche", categoria: "Postres", precio: 14, descripcion: "Arroz cremoso con leche, canela y pasas", disponible: 1, icono: "🍚" }
            ];

            const insertMenu = db.prepare('INSERT INTO menu (_id, nombre, categoria, precio, descripcion, disponible, icono) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insertManyMenu = db.transaction((items) => {
                for (const item of items) {
                    insertMenu.run(generarId(), item.nombre, item.categoria, item.precio, item.descripcion, item.disponible, item.icono);
                }
            });
            insertManyMenu(menuPeruano);
            console.log('✅ Menú peruano inicializado');
        }

        if (mesasCount === 0) {
            const mesas = [
                { numero: 1, capacidad: 4, estado: "disponible" },
                { numero: 2, capacidad: 2, estado: "disponible" },
                { numero: 3, capacidad: 6, estado: "disponible" },
                { numero: 4, capacidad: 4, estado: "disponible" },
                { numero: 5, capacidad: 8, estado: "disponible" },
                { numero: 6, capacidad: 2, estado: "disponible" },
                { numero: 7, capacidad: 4, estado: "disponible" },
                { numero: 8, capacidad: 4, estado: "disponible" },
                { numero: 9, capacidad: 6, estado: "disponible" },
                { numero: 10, capacidad: 2, estado: "disponible" }
            ];
            const insertMesa = db.prepare('INSERT INTO mesas (_id, numero, capacidad, estado) VALUES (?, ?, ?, ?)');
            const insertManyMesas = db.transaction((items) => {
                for (const item of items) {
                    insertMesa.run(generarId(), item.numero, item.capacidad, item.estado);
                }
            });
            insertManyMesas(mesas);
            console.log('✅ Mesas inicializadas');
        }

        if (usuariosCount === 0) {
            const usuariosPorDefecto = [
                { username: 'admin', password: 'admin123', nombre: 'Administrador', rol: 'administrador', activo: 1 },
                { username: 'mesero', password: 'mesero123', nombre: 'Mesero', rol: 'mesero', activo: 1 },
                { username: 'cocinero', password: 'cocinero123', nombre: 'Cocinero', rol: 'cocinero', activo: 1 }
            ];
            const insertUsuario = db.prepare('INSERT INTO usuarios (_id, username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?, ?)');
            // Hashear contraseñas antes de guardar
            for (const item of usuariosPorDefecto) {
                const hashedPassword = bcrypt.hashSync(item.password, 10);
                insertUsuario.run(generarId(), item.username, hashedPassword, item.nombre, item.rol, item.activo);
            }
            console.log('✅ Usuarios inicializados (contraseñas hasheadas)');
        }
    } catch (error) {
        console.error('Error inicializando datos:', error);
    }
};

// ============= MENÚ =============

app.get('/api/menu', (req, res) => {
    try {
        const menu = db.prepare('SELECT * FROM menu').all();
        res.json(formatRows(menu));
    } catch (error) {
        logError('Error al obtener menú', error);
        res.status(500).json({ error: 'Error al obtener menú' });
    }
});

app.post('/api/menu', verificarToken, soloAdmin, (req, res) => {
    try {
        const { nombre, categoria, precio, descripcion, disponible, icono, imagen } = req.body;

        // Validación de datos
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
        if (!categoria) return res.status(400).json({ error: 'La categoría es requerida' });
        if (precio === undefined || precio === null || precio < 0) return res.status(400).json({ error: 'El precio debe ser un número positivo' });

        const _id = generarId();
        db.prepare('INSERT INTO menu (_id, nombre, categoria, precio, descripcion, disponible, icono, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(_id, nombre, categoria, precio, descripcion, disponible ? 1 : 0, icono, imagen || null);
        const platillo = db.prepare('SELECT * FROM menu WHERE _id = ?').get(_id);
        res.status(201).json(formatRow(platillo));
    } catch (error) {
        logError('Error al crear platillo', error);
        res.status(500).json({ error: 'Error al crear platillo' });
    }
});

app.put('/api/menu/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const { nombre, categoria, precio, descripcion, disponible, icono, imagen } = req.body;
        const existing = db.prepare('SELECT * FROM menu WHERE _id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Platillo no encontrado' });

        // Validación
        if (precio !== undefined && precio < 0) return res.status(400).json({ error: 'El precio debe ser positivo' });

        db.prepare('UPDATE menu SET nombre=?, categoria=?, precio=?, descripcion=?, disponible=?, icono=?, imagen=?, updatedAt=? WHERE _id=?')
            .run(
                nombre ?? existing.nombre,
                categoria ?? existing.categoria,
                precio ?? existing.precio,
                descripcion ?? existing.descripcion,
                disponible !== undefined ? (disponible ? 1 : 0) : existing.disponible,
                icono ?? existing.icono,
                imagen !== undefined ? imagen : existing.imagen,
                now(),
                req.params.id
            );
        const platillo = db.prepare('SELECT * FROM menu WHERE _id = ?').get(req.params.id);
        res.json(formatRow(platillo));
    } catch (error) {
        logError('Error al actualizar platillo', error);
        res.status(500).json({ error: 'Error al actualizar platillo' });
    }
});

app.delete('/api/menu/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM menu WHERE _id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ message: 'Platillo eliminado' });
        } else {
            res.status(404).json({ error: 'Platillo no encontrado' });
        }
    } catch (error) {
        logError('Error al eliminar platillo', error);
        res.status(500).json({ error: 'Error al eliminar platillo' });
    }
});

// ============= MESAS =============

app.get('/api/mesas', verificarToken, (req, res) => {
    try {
        const mesas = db.prepare('SELECT * FROM mesas').all();
        res.json(mesas);
    } catch (error) {
        logError('Error al obtener mesas', error);
        res.status(500).json({ error: 'Error al obtener mesas' });
    }
});

app.post('/api/mesas', verificarToken, soloAdmin, (req, res) => {
    try {
        const { numero, capacidad, estado } = req.body;

        // Validación
        if (!numero || numero < 1) return res.status(400).json({ error: 'Número de mesa inválido' });
        if (!capacidad || capacidad < 1) return res.status(400).json({ error: 'Capacidad inválida' });
        const duplicada = db.prepare('SELECT _id FROM mesas WHERE numero = ?').get(numero);
        if (duplicada) return res.status(400).json({ error: 'Ya existe una mesa con ese número' });

        const _id = generarId();
        db.prepare('INSERT INTO mesas (_id, numero, capacidad, estado) VALUES (?, ?, ?, ?)')
            .run(_id, numero, capacidad, estado || 'disponible');
        const mesa = db.prepare('SELECT * FROM mesas WHERE _id = ?').get(_id);
        res.status(201).json(mesa);
    } catch (error) {
        logError('Error al crear mesa', error);
        res.status(500).json({ error: 'Error al crear mesa' });
    }
});

app.put('/api/mesas/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM mesas WHERE _id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Mesa no encontrada' });

        const { numero, capacidad, estado } = req.body;
        db.prepare('UPDATE mesas SET numero=?, capacidad=?, estado=?, updatedAt=? WHERE _id=?')
            .run(numero ?? existing.numero, capacidad ?? existing.capacidad, estado ?? existing.estado, now(), req.params.id);

        const mesa = db.prepare('SELECT * FROM mesas WHERE _id = ?').get(req.params.id);
        emitirEvento('mesa-actualizada', mesa);
        res.json(mesa);
    } catch (error) {
        logError('Error al actualizar mesa', error);
        res.status(500).json({ error: 'Error al actualizar mesa' });
    }
});

app.delete('/api/mesas/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM mesas WHERE _id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ message: 'Mesa eliminada' });
        } else {
            res.status(404).json({ error: 'Mesa no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar mesa' });
    }
});

// ============= PEDIDOS =============

app.get('/api/pedidos', verificarToken, (req, res) => {
    try {
        const query = req.query.todos === '1'
            ? 'SELECT * FROM pedidos ORDER BY fecha DESC'
            : "SELECT * FROM pedidos WHERE estado NOT IN ('cobrado', 'cancelado') ORDER BY fecha DESC";
        const pedidos = db.prepare(query).all();
        res.json(formatRows(pedidos, ['items']));
    } catch (error) {
        logError('Error al obtener pedidos', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

app.post('/api/pedidos', verificarToken, soloMeseroOAdmin, (req, res) => {
    try {
        const _id = generarId();
        const pedidoData = { ...req.body };

        const items = JSON.stringify(pedidoData.items || []);
        db.prepare('INSERT INTO pedidos (_id, mesaId, mesaNumero, items, estado, total) VALUES (?, ?, ?, ?, ?, ?)')
            .run(_id, pedidoData.mesaId || null, pedidoData.mesaNumero || null, items, pedidoData.estado, pedidoData.total);

        const pedido = formatRow(db.prepare('SELECT * FROM pedidos WHERE _id = ?').get(_id), ['items']);
        emitirEvento('nuevo-pedido', pedido);
        res.status(201).json(pedido);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear pedido' });
    }
});

app.put('/api/pedidos/:id', verificarToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM pedidos WHERE _id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

        // Cocinero solo puede cambiar estado a 'en-preparacion' o 'listo'
        if (req.usuario.rol === 'cocinero') {
            const estadosPermitidos = ['en-preparacion', 'listo'];
            if (req.body.estado && !estadosPermitidos.includes(req.body.estado)) {
                return res.status(403).json({ error: 'Cocinero solo puede marcar como en-preparacion o listo' });
            }
            // Cocinero solo puede modificar el estado, nada más
            req.body = { estado: req.body.estado };
        }

        const items = req.body.items ? JSON.stringify(req.body.items) : existing.items;
        db.prepare('UPDATE pedidos SET mesaId=?, mesaNumero=?, items=?, estado=?, total=?, updatedAt=? WHERE _id=?')
            .run(
                req.body.mesaId ?? existing.mesaId,
                req.body.mesaNumero ?? existing.mesaNumero,
                items,
                req.body.estado ?? existing.estado,
                req.body.total ?? existing.total,
                now(),
                req.params.id
            );

        const pedido = formatRow(db.prepare('SELECT * FROM pedidos WHERE _id = ?').get(req.params.id), ['items']);
        emitirEvento('pedido-actualizado', pedido);
        res.json(pedido);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

app.delete('/api/pedidos/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const pedido = db.prepare('SELECT * FROM pedidos WHERE _id = ?').get(req.params.id);
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

        db.prepare('DELETE FROM pedidos WHERE _id = ?').run(req.params.id);
        emitirEvento('pedido-eliminado', { _id: req.params.id, mesaNumero: pedido.mesaNumero });
        res.json({ message: 'Pedido eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
});

// ============= FACTURAS =============

app.get('/api/facturas', verificarToken, (req, res) => {
    try {
        const facturas = db.prepare('SELECT * FROM facturas ORDER BY fecha DESC').all();
        res.json(formatRows(facturas, ['items', 'pedidoIds']));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener facturas' });
    }
});

app.post('/api/facturas', verificarToken, (req, res) => {
    try {
        const _id = generarId();
        const { numeroFactura, mesaNumero, pedidoIds, items, subtotal, impuesto, total, metodoPago } = req.body;
        db.prepare('INSERT INTO facturas (_id, numeroFactura, mesaNumero, pedidoIds, items, subtotal, impuesto, total, metodoPago) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(_id, numeroFactura, mesaNumero, JSON.stringify(pedidoIds || []), JSON.stringify(items || []), subtotal, impuesto, total, metodoPago);

        const factura = formatRow(db.prepare('SELECT * FROM facturas WHERE _id = ?').get(_id), ['items', 'pedidoIds']);
        emitirEvento('nueva-factura', factura);
        res.status(201).json(factura);
    } catch (error) {
        console.error('Error al crear factura:', error);
        res.status(500).json({ error: 'Error al crear factura', details: error.message });
    }
});

// ============= INVENTARIO =============

app.get('/api/inventario', verificarToken, (req, res) => {
    try {
        const inventario = db.prepare('SELECT * FROM inventario ORDER BY categoria ASC, nombre ASC').all();
        res.json(inventario);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

app.post('/api/inventario', verificarToken, soloAdmin, (req, res) => {
    try {
        const _id = generarId();
        const { nombre, categoria, cantidad, unidad, stockMinimo, costo } = req.body;
        db.prepare('INSERT INTO inventario (_id, nombre, categoria, cantidad, unidad, stockMinimo, costo, costoAnterior) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(_id, nombre, categoria || 'General', cantidad || 0, unidad || 'unidades', stockMinimo || 10, costo || 0, 0);
        const item = db.prepare('SELECT * FROM inventario WHERE _id = ?').get(_id);
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear item de inventario' });
    }
});

app.put('/api/inventario/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM inventario WHERE _id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Item no encontrado' });

        const { nombre, categoria, cantidad, unidad, stockMinimo, costo } = req.body;
        const costoFinal = costo ?? existing.costo;
        const costoAnteriorFinal = existing.costo;

        // Registrar cambio de costo si el precio cambió
        if (costo !== undefined && costo !== null && costo !== existing.costo && existing.costo > 0) {
            const variacion = ((costo - existing.costo) / existing.costo) * 100;
            db.prepare('INSERT INTO historial_costos (_id, inventarioId, costoAnterior, costoNuevo, variacion) VALUES (?, ?, ?, ?, ?)')
                .run(generarId(), req.params.id, existing.costo, costo, Math.round(variacion * 100) / 100);
        }

        db.prepare('UPDATE inventario SET nombre=?, categoria=?, cantidad=?, unidad=?, stockMinimo=?, costo=?, costoAnterior=?, updatedAt=? WHERE _id=?')
            .run(
                nombre ?? existing.nombre,
                categoria ?? existing.categoria,
                cantidad ?? existing.cantidad,
                unidad ?? existing.unidad,
                stockMinimo ?? existing.stockMinimo,
                costoFinal,
                (costo !== undefined && costo !== null && costo !== existing.costo) ? costoAnteriorFinal : (existing.costoAnterior || 0),
                now(),
                req.params.id
            );
        const item = db.prepare('SELECT * FROM inventario WHERE _id = ?').get(req.params.id);
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar item' });
    }
});

app.delete('/api/inventario/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM historial_costos WHERE inventarioId = ?').run(req.params.id);
        const result = db.prepare('DELETE FROM inventario WHERE _id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ message: 'Item eliminado' });
        } else {
            res.status(404).json({ error: 'Item no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar item' });
    }
});

app.get('/api/inventario/alertas', verificarToken, (req, res) => {
    try {
        const alertas = db.prepare('SELECT * FROM inventario WHERE cantidad <= stockMinimo').all();
        res.json(alertas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
});

app.get('/api/inventario/:id/historial-costos', verificarToken, (req, res) => {
    try {
        const historial = db.prepare('SELECT * FROM historial_costos WHERE inventarioId = ? ORDER BY fecha DESC LIMIT 20').all(req.params.id);
        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener historial de costos' });
    }
});

// ============= ACTIVIDAD =============

app.get('/api/actividad', verificarToken, (req, res) => {
    try {
        const actividad = db.prepare('SELECT * FROM actividad ORDER BY fecha DESC').all();
        res.json(actividad);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener actividad' });
    }
});

app.post('/api/actividad', verificarToken, (req, res) => {
    try {
        const _id = generarId();
        const { tipo, descripcion, usuario } = req.body;
        db.prepare('INSERT INTO actividad (_id, tipo, descripcion, usuario) VALUES (?, ?, ?, ?)')
            .run(_id, tipo, descripcion, usuario);
        const act = db.prepare('SELECT * FROM actividad WHERE _id = ?').get(_id);
        emitirEvento('nueva-actividad', act);
        res.status(201).json(act);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear actividad' });
    }
});

// ============= AUTENTICACIÓN =============

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1').get(username);

        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        let passwordValida = false;
        if (usuario.password.startsWith('$2')) {
            passwordValida = await bcrypt.compare(password, usuario.password);
        } else {
            passwordValida = usuario.password === password;
            if (passwordValida) {
                const hashed = await bcrypt.hash(password, 10);
                db.prepare('UPDATE usuarios SET password = ?, updatedAt = ? WHERE _id = ?').run(hashed, now(), usuario._id);
            }
        }

        if (passwordValida) {
            const token = jwt.sign(
                { id: usuario._id, username: usuario.username, rol: usuario.rol },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.json({
                success: true,
                token,
                usuario: {
                    id: usuario._id,
                    username: usuario.username,
                    rol: usuario.rol,
                    nombre: usuario.nombre
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        logError('Error en login', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ============= GESTIÓN DE USUARIOS =============

app.get('/api/usuarios', verificarToken, soloAdmin, (req, res) => {
    try {
        const usuarios = db.prepare('SELECT _id, username, nombre, rol, activo, createdAt, updatedAt FROM usuarios').all();
        res.json(formatRows(usuarios));
    } catch (error) {
        logError('Error al obtener usuarios', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { username, password, nombre, rol } = req.body;

        const existente = db.prepare('SELECT _id FROM usuarios WHERE username = ?').get(username);
        if (existente) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const _id = generarId();
        db.prepare('INSERT INTO usuarios (_id, username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?, 1)')
            .run(_id, username, hashedPassword, nombre, rol);

        const usuario = db.prepare('SELECT _id, username, nombre, rol, activo, createdAt, updatedAt FROM usuarios WHERE _id = ?').get(_id);
        res.status(201).json(formatRow(usuario));
    } catch (error) {
        logError('Error al crear usuario', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.put('/api/usuarios/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { username, nombre, rol, activo, password } = req.body;

        const existente = db.prepare('SELECT _id FROM usuarios WHERE username = ? AND _id != ?').get(username, req.params.id);
        if (existente) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }

        const existing = db.prepare('SELECT * FROM usuarios WHERE _id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

        let passwordFinal = existing.password;
        if (password) {
            passwordFinal = await bcrypt.hash(password, 10);
        }

        db.prepare('UPDATE usuarios SET username=?, password=?, nombre=?, rol=?, activo=?, updatedAt=? WHERE _id=?')
            .run(username ?? existing.username, passwordFinal, nombre ?? existing.nombre, rol ?? existing.rol, activo !== undefined ? (activo ? 1 : 0) : existing.activo, now(), req.params.id);

        const usuario = db.prepare('SELECT _id, username, nombre, rol, activo, createdAt, updatedAt FROM usuarios WHERE _id = ?').get(req.params.id);
        res.json(formatRow(usuario));
    } catch (error) {
        logError('Error al actualizar usuario', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

app.delete('/api/usuarios/:id', verificarToken, soloAdmin, (req, res) => {
    try {
        const admins = db.prepare("SELECT COUNT(*) as count FROM usuarios WHERE rol = 'administrador' AND activo = 1").get().count;
        const usuarioAEliminar = db.prepare('SELECT * FROM usuarios WHERE _id = ?').get(req.params.id);

        if (usuarioAEliminar?.rol === 'administrador' && admins <= 1) {
            return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
        }

        const result = db.prepare('DELETE FROM usuarios WHERE _id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ message: 'Usuario eliminado' });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        logError('Error al eliminar usuario', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// ============= BACKUP Y RESTORE =============

app.get('/api/backup', verificarToken, soloAdmin, (req, res) => {
    try {
        const backup = {
            menu: formatRows(db.prepare('SELECT * FROM menu').all()),
            mesas: db.prepare('SELECT * FROM mesas').all(),
            pedidos: formatRows(db.prepare('SELECT * FROM pedidos').all(), ['items']),
            facturas: formatRows(db.prepare('SELECT * FROM facturas').all(), ['items', 'pedidoIds']),
            inventario: db.prepare('SELECT * FROM inventario').all(),
            historial_costos: db.prepare('SELECT * FROM historial_costos').all(),
            usuarios: db.prepare('SELECT _id, username, password, nombre, rol, activo, createdAt, updatedAt FROM usuarios').all(),
            actividad: db.prepare('SELECT * FROM actividad').all(),
            fecha: new Date().toISOString()
        };
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear backup' });
    }
});

app.post('/api/restore', verificarToken, soloAdmin, (req, res) => {
    try {
        const { menu, mesas, pedidos, facturas, inventario, historial_costos, usuarios, actividad } = req.body;

        const restore = db.transaction(() => {
            if (menu && Array.isArray(menu)) {
                db.prepare('DELETE FROM menu').run();
                const stmt = db.prepare('INSERT INTO menu (_id, nombre, categoria, precio, descripcion, disponible, icono, imagen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const item of menu) {
                    stmt.run(item._id || generarId(), item.nombre, item.categoria, item.precio, item.descripcion, item.disponible ? 1 : 0, item.icono, item.imagen || null, item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (mesas && Array.isArray(mesas)) {
                db.prepare('DELETE FROM mesas').run();
                const stmt = db.prepare('INSERT INTO mesas (_id, numero, capacidad, estado, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
                for (const item of mesas) {
                    stmt.run(item._id || generarId(), item.numero, item.capacidad, item.estado, item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (pedidos && Array.isArray(pedidos)) {
                db.prepare('DELETE FROM pedidos').run();
                const stmt = db.prepare('INSERT INTO pedidos (_id, mesaId, mesaNumero, items, estado, total, fecha, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const item of pedidos) {
                    stmt.run(item._id || generarId(), item.mesaId, item.mesaNumero || item.numeroMesa, JSON.stringify(item.items || []), item.estado, item.total, item.fecha || now(), item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (facturas && Array.isArray(facturas)) {
                db.prepare('DELETE FROM facturas').run();
                const stmt = db.prepare('INSERT INTO facturas (_id, numeroFactura, mesaNumero, pedidoIds, items, subtotal, impuesto, total, metodoPago, fecha, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const item of facturas) {
                    stmt.run(item._id || generarId(), item.numeroFactura, item.mesaNumero || item.numeroMesa, JSON.stringify(item.pedidoIds || []), JSON.stringify(item.items || []), item.subtotal, item.impuesto, item.total, item.metodoPago, item.fecha || now(), item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (inventario && Array.isArray(inventario)) {
                db.prepare('DELETE FROM inventario').run();
                const stmt = db.prepare('INSERT INTO inventario (_id, nombre, categoria, cantidad, unidad, stockMinimo, costo, costoAnterior, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const item of inventario) {
                    stmt.run(item._id || generarId(), item.nombre, item.categoria || 'General', item.cantidad || 0, item.unidad || 'unidades', item.stockMinimo || 10, item.costo || 0, item.costoAnterior || 0, item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (historial_costos && Array.isArray(historial_costos)) {
                db.prepare('DELETE FROM historial_costos').run();
                const stmt = db.prepare('INSERT INTO historial_costos (_id, inventarioId, costoAnterior, costoNuevo, variacion, fecha) VALUES (?, ?, ?, ?, ?, ?)');
                for (const item of historial_costos) {
                    stmt.run(item._id || generarId(), item.inventarioId, item.costoAnterior, item.costoNuevo, item.variacion, item.fecha || now());
                }
            }
            if (usuarios && Array.isArray(usuarios)) {
                db.prepare('DELETE FROM usuarios').run();
                const stmt = db.prepare('INSERT INTO usuarios (_id, username, password, nombre, rol, activo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                for (const item of usuarios) {
                    stmt.run(item._id || generarId(), item.username, item.password, item.nombre, item.rol, item.activo ? 1 : 0, item.createdAt || now(), item.updatedAt || now());
                }
            }
            if (actividad && Array.isArray(actividad)) {
                db.prepare('DELETE FROM actividad').run();
                const stmt = db.prepare('INSERT INTO actividad (_id, tipo, descripcion, usuario, fecha, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
                for (const item of actividad) {
                    stmt.run(item._id || generarId(), item.tipo, item.descripcion, item.usuario, item.fecha || now(), item.createdAt || now(), item.updatedAt || now());
                }
            }
        });
        restore();

        res.json({ message: 'Datos restaurados correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al restaurar datos' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), database: 'SQLite' });
});

// ============= INICIAR SERVIDOR =============

inicializarDatos();

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Conectado a SQLite');
    console.log(`🚀 Backend corriendo en puerto ${PORT}`);
    console.log('📦 Base de datos: SQLite (local, gratis)');
    console.log('🔌 WebSocket activo');
});

server.on('error', (err) => {
    console.error('❌ Error al iniciar servidor:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso`);
    }
    process.exit(1);
});

// Cerrar BD al salir
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});

