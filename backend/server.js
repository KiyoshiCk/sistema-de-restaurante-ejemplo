const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'restaurante_secret_key_2024';

const IS_RENDER = Boolean(process.env.RENDER)
    || Boolean(process.env.RENDER_SERVICE_ID)
    || Boolean(process.env.RENDER_EXTERNAL_URL)
    || Boolean(process.env.RENDER_INSTANCE_ID);
const IS_PRODUCTION = (process.env.NODE_ENV || '').toLowerCase() === 'production';

if (!MONGODB_URI) {
    if (IS_RENDER || IS_PRODUCTION) {
        console.error('❌ Falta configurar MONGODB_URI en variables de entorno (Render/producción).');
        process.exit(1);
    }

    console.warn('⚠️ MONGODB_URI no está configurada. Usando MongoDB local por defecto.');
}

const EFFECTIVE_MONGODB_URI = MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurante';
console.log(`🔧 MongoDB URI: ${MONGODB_URI ? 'desde env (MONGODB_URI)' : 'fallback local (solo desarrollo)'}`);

const logError = (context, error) => {
    console.error(`❌ ${context}:`, error);
};

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(bodyParser.json());


// ============= SCHEMAS =============
// Configuración general del restaurante (incluye ubicación)
const configSchema = new mongoose.Schema({
    ciudad: { type: String, default: 'Moche' },
    barrio: { type: String, default: '' },
    direccion: { type: String, default: '' },
    lat: { type: Number, default: -8.1713 },
    lng: { type: Number, default: -78.5143 },
}, { timestamps: true });


const menuSchema = new mongoose.Schema({
    nombre: String,
    categoria: String,
    precio: Number,
    descripcion: String,
    disponible: Boolean,
    icono: String
}, { timestamps: true });

const mesaSchema = new mongoose.Schema({
    numero: Number,
    capacidad: Number,
    estado: String
}, { timestamps: true });

const pedidoSchema = new mongoose.Schema({
    mesaId: mongoose.Schema.Types.ObjectId,
    mesaNumero: Number,
    numeroMesa: Number, // Legacy field
    items: [{
        id: mongoose.Schema.Types.ObjectId,
        nombre: String,
        cantidad: Number,
        precio: Number,
        comentario: String
    }],
    estado: String,
    total: Number,
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

const facturaSchema = new mongoose.Schema({
    numeroFactura: String,
    numeroMesa: mongoose.Schema.Types.Mixed, // Puede ser Number o String
    items: [{
        nombre: String,
        cantidad: Number,
        precio: Number,
        comentario: String
    }],
    subtotal: Number,
    impuesto: Number,
    total: Number,
    metodoPago: String,
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

const actividadSchema = new mongoose.Schema({
    tipo: String,
    descripcion: String,
    usuario: String,
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

const usuarioSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nombre: { type: String, required: true },
    rol: { type: String, enum: ['administrador', 'mesero', 'cocinero'], required: true },
    activo: { type: Boolean, default: true }
}, { timestamps: true });

const inventarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    categoria: { type: String, default: 'General' },
    cantidad: { type: Number, default: 0 },
    unidad: { type: String, default: 'unidades' },
    stockMinimo: { type: Number, default: 10 },
    costo: { type: Number, default: 0 }
}, { timestamps: true });

// ============= MODELOS =============


const Menu = mongoose.model('Menu', menuSchema);
const Mesa = mongoose.model('Mesa', mesaSchema);
const Pedido = mongoose.model('Pedido', pedidoSchema);
const Factura = mongoose.model('Factura', facturaSchema);
const Actividad = mongoose.model('Actividad', actividadSchema);
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Inventario = mongoose.model('Inventario', inventarioSchema);
const Config = mongoose.model('Config', configSchema);
// ============= CONFIGURACIÓN DEL RESTAURANTE (UBICACIÓN) =============

// Obtener configuración (solo 1 documento)
app.get('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({});
        }
        res.json(config);
    } catch (error) {
        logError('Error al obtener configuración', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// Actualizar configuración (ubicación)
app.put('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({});
        }
        config.ciudad = req.body.ciudad || config.ciudad;
        config.barrio = req.body.barrio || config.barrio;
        config.direccion = req.body.direccion || config.direccion;
        if (typeof req.body.lat === 'number') config.lat = req.body.lat;
        if (typeof req.body.lng === 'number') config.lng = req.body.lng;
        await config.save();
        res.json(config);
    } catch (error) {
        logError('Error al actualizar configuración', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// ============= SOCKET.IO EVENTOS =============

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    // Unirse a una sala específica (admin, cocina, mesero)
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📢 ${socket.id} se unió a la sala: ${room}`);
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

// Función helper para emitir eventos a todos los clientes
const emitirEvento = (evento, datos) => {
    io.emit(evento, datos);
};

// ============= CONEXIÓN A MONGODB =============

mongoose.connect(EFFECTIVE_MONGODB_URI)
.then(async () => {
    console.log('✅ Conectado a MongoDB');
    
    // Inicializar datos de ejemplo si la BD está vacía
    await inicializarDatos();

    // Iniciar servidor solo cuando la BD está lista
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Backend corriendo en puerto ${PORT}`);
        console.log('📦 Base de datos: MongoDB');
        console.log('🔌 WebSocket activo');
    });
})
.catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
});

// ============= INICIALIZACIÓN DE DATOS =============

const inicializarDatos = async () => {
    try {
        // Verificar si ya hay datos
        const menuCount = await Menu.countDocuments();
        const mesasCount = await Mesa.countDocuments();

        if (menuCount === 0) {
            const menuPeruano = [
                { nombre: "Ceviche de Pescado", categoria: "Entradas", precio: 35, descripcion: "Pescado fresco marinado en limón con ají limo, cebolla morada y camote", disponible: true, icono: "🐟" },
                { nombre: "Causa Limeña", categoria: "Entradas", precio: 22, descripcion: "Papa amarilla con limón, ají amarillo, rellena de atún o pollo", disponible: true, icono: "🥔" },
                { nombre: "Anticuchos de Corazón", categoria: "Entradas", precio: 28, descripcion: "Brochetas de corazón de res marinadas en especias peruanas", disponible: true, icono: "🍢" },
                { nombre: "Tequeños", categoria: "Entradas", precio: 18, descripcion: "Deditos de masa rellenos de queso fresco", disponible: true, icono: "🧀" },
                { nombre: "Lomo Saltado", categoria: "Platos Fuertes", precio: 42, descripcion: "Tiras de lomo fino salteado con cebolla, tomate, papas fritas y arroz", disponible: true, icono: "🥩" },
                { nombre: "Ají de Gallina", categoria: "Platos Fuertes", precio: 38, descripcion: "Pollo deshilachado en crema de ají amarillo con papas y aceitunas", disponible: true, icono: "🍗" },
                { nombre: "Arroz con Pollo", categoria: "Platos Fuertes", precio: 32, descripcion: "Arroz verde con cilantro acompañado de pollo y papa a la huancaína", disponible: true, icono: "🍚" },
                { nombre: "Tacu Tacu con Lomo", categoria: "Platos Fuertes", precio: 45, descripcion: "Mezcla de arroz y frijoles frita con lomo saltado encima", disponible: true, icono: "🍛" },
                { nombre: "Seco de Carne", categoria: "Platos Fuertes", precio: 40, descripcion: "Carne guisada con cilantro, frijoles y arroz", disponible: true, icono: "🥘" },
                { nombre: "Pescado a lo Macho", categoria: "Platos Fuertes", precio: 48, descripcion: "Pescado frito con salsa de mariscos cremosa", disponible: true, icono: "🐠" },
                { nombre: "Tallarín Saltado", categoria: "Platos Fuertes", precio: 35, descripcion: "Fideos salteados con carne o pollo al estilo chifa peruano", disponible: true, icono: "🍝" },
                { nombre: "Chicharrón de Pescado", categoria: "Platos Fuertes", precio: 38, descripcion: "Trozos de pescado frito crocante con yuca y salsa criolla", disponible: true, icono: "🍤" },
                { nombre: "Inca Kola", categoria: "Bebidas", precio: 8, descripcion: "La bebida nacional del Perú, sabor único", disponible: true, icono: "🥤" },
                { nombre: "Chicha Morada", categoria: "Bebidas", precio: 10, descripcion: "Refresco de maíz morado con especias y frutas", disponible: true, icono: "🍹" },
                { nombre: "Pisco Sour", categoria: "Bebidas", precio: 25, descripcion: "Cóctel de pisco, limón, jarabe y clara de huevo", disponible: true, icono: "🍸" },
                { nombre: "Emoliente", categoria: "Bebidas", precio: 7, descripcion: "Bebida caliente de hierbas medicinales", disponible: true, icono: "☕" },
                { nombre: "Limonada Frozen", categoria: "Bebidas", precio: 12, descripcion: "Limonada peruana bien helada", disponible: true, icono: "🍋" },
                { nombre: "Suspiro Limeño", categoria: "Postres", precio: 18, descripcion: "Manjar blanco con merengue de oporto", disponible: true, icono: "🍮" },
                { nombre: "Mazamorra Morada", categoria: "Postres", precio: 15, descripcion: "Postre de maíz morado con frutas", disponible: true, icono: "🍇" },
                { nombre: "Picarones", categoria: "Postres", precio: 16, descripcion: "Buñuelos de zapallo con miel de chancaca", disponible: true, icono: "🍩" },
                { nombre: "Alfajores", categoria: "Postres", precio: 12, descripcion: "Galletas rellenas de manjar blanco", disponible: true, icono: "🍪" },
                { nombre: "Arroz con Leche", categoria: "Postres", precio: 14, descripcion: "Arroz cremoso con leche, canela y pasas", disponible: true, icono: "🍚" }
            ];
            await Menu.insertMany(menuPeruano);
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
            await Mesa.insertMany(mesas);
            console.log('✅ Mesas inicializadas');
        }

        // Inicializar usuarios por defecto
        const usuariosCount = await Usuario.countDocuments();
        if (usuariosCount === 0) {
            const usuariosPorDefecto = [
                { username: 'admin', password: 'admin123', nombre: 'Administrador', rol: 'administrador', activo: true },
                { username: 'mesero', password: 'mesero123', nombre: 'Mesero', rol: 'mesero', activo: true },
                { username: 'cocinero', password: 'cocinero123', nombre: 'Cocinero', rol: 'cocinero', activo: true }
            ];
            await Usuario.insertMany(usuariosPorDefecto);
            console.log('✅ Usuarios inicializados');
        }
    } catch (error) {
        console.error('Error inicializando datos:', error);
    }
};

// ============= MENÚ =============

app.get('/api/menu', async (req, res) => {
    try {
        const menu = await Menu.find();
        res.json(menu);
    } catch (error) {
        logError('Error al obtener menú', error);
        res.status(500).json({ error: 'Error al obtener menú' });
    }
});

app.post('/api/menu', async (req, res) => {
    try {
        const nuevoPlatillo = new Menu(req.body);
        await nuevoPlatillo.save();
        res.status(201).json(nuevoPlatillo);
    } catch (error) {
        logError('Error al crear platillo', error);
        res.status(500).json({ error: 'Error al crear platillo' });
    }
});

app.put('/api/menu/:id', async (req, res) => {
    try {
        const platillo = await Menu.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (platillo) {
            res.json(platillo);
        } else {
            res.status(404).json({ error: 'Platillo no encontrado' });
        }
    } catch (error) {
        logError('Error al actualizar platillo', error);
        res.status(500).json({ error: 'Error al actualizar platillo' });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        const platillo = await Menu.findByIdAndDelete(req.params.id);
        if (platillo) {
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

app.get('/api/mesas', async (req, res) => {
    try {
        const mesas = await Mesa.find();
        res.json(mesas);
    } catch (error) {
        logError('Error al obtener mesas', error);
        res.status(500).json({ error: 'Error al obtener mesas' });
    }
});

app.post('/api/mesas', async (req, res) => {
    try {
        const nuevaMesa = new Mesa(req.body);
        await nuevaMesa.save();
        res.status(201).json(nuevaMesa);
    } catch (error) {
        logError('Error al crear mesa', error);
        res.status(500).json({ error: 'Error al crear mesa' });
    }
});

app.put('/api/mesas/:id', async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (mesa) {
            // Emitir evento de mesa actualizada
            emitirEvento('mesa-actualizada', mesa);
            res.json(mesa);
        } else {
            res.status(404).json({ error: 'Mesa no encontrada' });
        }
    } catch (error) {
        logError('Error al actualizar mesa', error);
        res.status(500).json({ error: 'Error al actualizar mesa' });
    }
});

app.delete('/api/mesas/:id', async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndDelete(req.params.id);
        if (mesa) {
            res.json({ message: 'Mesa eliminada' });
        } else {
            res.status(404).json({ error: 'Mesa no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar mesa' });
    }
});

// ============= PEDIDOS =============

app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await Pedido.find();
        res.json(pedidos);
    } catch (error) {
        logError('Error al obtener pedidos', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

app.post('/api/pedidos', async (req, res) => {
    try {
        const pedidoData = { ...req.body };
        // Asegurar compatibilidad: guardar en ambos campos
        if (pedidoData.mesaNumero && !pedidoData.numeroMesa) {
            pedidoData.numeroMesa = pedidoData.mesaNumero;
        }
        if (pedidoData.numeroMesa && !pedidoData.mesaNumero) {
            pedidoData.mesaNumero = pedidoData.numeroMesa;
        }
        const nuevoPedido = new Pedido(pedidoData);
        await nuevoPedido.save();
        
        // Emitir evento de nuevo pedido
        emitirEvento('nuevo-pedido', nuevoPedido);
        
        res.status(201).json(nuevoPedido);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear pedido' });
    }
});

app.put('/api/pedidos/:id', async (req, res) => {
    try {
        const pedido = await Pedido.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (pedido) {
            // Emitir evento de pedido actualizado
            emitirEvento('pedido-actualizado', pedido);
            res.json(pedido);
        } else {
            res.status(404).json({ error: 'Pedido no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        const pedido = await Pedido.findByIdAndDelete(req.params.id);
        if (pedido) {
            // Emitir evento de pedido eliminado
            emitirEvento('pedido-eliminado', { _id: req.params.id, mesaNumero: pedido.mesaNumero || pedido.numeroMesa });
            res.json({ message: 'Pedido eliminado' });
        } else {
            res.status(404).json({ error: 'Pedido no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
});

// ============= FACTURAS =============

app.get('/api/facturas', async (req, res) => {
    try {
        const facturas = await Factura.find();
        res.json(facturas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener facturas' });
    }
});

app.post('/api/facturas', async (req, res) => {
    try {
        const nuevaFactura = new Factura(req.body);
        await nuevaFactura.save();
        // Emitir evento de nueva factura
        emitirEvento('nueva-factura', nuevaFactura);
        res.status(201).json(nuevaFactura);
    } catch (error) {
        console.error('Error al crear factura:', error);
        res.status(500).json({ error: 'Error al crear factura', details: error.message });
    }
});

// ============= INVENTARIO =============

app.get('/api/inventario', async (req, res) => {
    try {
        const inventario = await Inventario.find().sort({ categoria: 1, nombre: 1 });
        res.json(inventario);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

app.post('/api/inventario', async (req, res) => {
    try {
        const nuevoItem = new Inventario(req.body);
        await nuevoItem.save();
        res.status(201).json(nuevoItem);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear item de inventario' });
    }
});

app.put('/api/inventario/:id', async (req, res) => {
    try {
        const item = await Inventario.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: 'Item no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar item' });
    }
});

app.delete('/api/inventario/:id', async (req, res) => {
    try {
        const item = await Inventario.findByIdAndDelete(req.params.id);
        if (item) {
            res.json({ message: 'Item eliminado' });
        } else {
            res.status(404).json({ error: 'Item no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar item' });
    }
});

// Endpoint para obtener items con stock bajo
app.get('/api/inventario/alertas', async (req, res) => {
    try {
        const alertas = await Inventario.find({
            $expr: { $lte: ['$cantidad', '$stockMinimo'] }
        });
        res.json(alertas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
});

// ============= ACTIVIDAD =============

app.get('/api/actividad', async (req, res) => {
    try {
        const actividad = await Actividad.find().sort({ fecha: -1 });
        res.json(actividad);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener actividad' });
    }
});

app.post('/api/actividad', async (req, res) => {
    try {
        const nuevaActividad = new Actividad(req.body);
        await nuevaActividad.save();
        
        // Emitir evento de nueva actividad
        emitirEvento('nueva-actividad', nuevaActividad);
        
        res.status(201).json(nuevaActividad);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear actividad' });
    }
});

// ============= AUTENTICACIÓN =============

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const usuario = await Usuario.findOne({ username, activo: true });
        
        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }
        
        // Verificar contraseña (soporta tanto hash como texto plano para migración)
        let passwordValida = false;
        if (usuario.password.startsWith('$2')) {
            // Contraseña hasheada con bcrypt
            passwordValida = await bcrypt.compare(password, usuario.password);
        } else {
            // Contraseña en texto plano (migración pendiente)
            passwordValida = usuario.password === password;
            // Actualizar a hash si coincide
            if (passwordValida) {
                usuario.password = await bcrypt.hash(password, 10);
                await usuario.save();
            }
        }
        
        if (passwordValida) {
            // Generar token JWT
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

app.get('/api/usuarios', async (req, res) => {
    try {
        const usuarios = await Usuario.find().select('-password');
        res.json(usuarios);
    } catch (error) {
        logError('Error al obtener usuarios', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        const { username, password, nombre, rol } = req.body;
        
        // Verificar si el usuario ya existe
        const existente = await Usuario.findOne({ username });
        if (existente) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        
        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const nuevoUsuario = new Usuario({ username, password: hashedPassword, nombre, rol, activo: true });
        await nuevoUsuario.save();
        
        const usuarioSinPassword = nuevoUsuario.toObject();
        delete usuarioSinPassword.password;
        
        res.status(201).json(usuarioSinPassword);
    } catch (error) {
        logError('Error al crear usuario', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    try {
        const { username, nombre, rol, activo, password } = req.body;
        
        // Verificar si el username ya existe en otro usuario
        const existente = await Usuario.findOne({ username, _id: { $ne: req.params.id } });
        if (existente) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        
        const updateData = { username, nombre, rol, activo };
        if (password) {
            // Encriptar nueva contraseña
            updateData.password = await bcrypt.hash(password, 10);
        }
        
        const usuario = await Usuario.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
        
        if (usuario) {
            res.json(usuario);
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        logError('Error al actualizar usuario', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        // No permitir eliminar el último administrador
        const admins = await Usuario.countDocuments({ rol: 'administrador', activo: true });
        const usuarioAEliminar = await Usuario.findById(req.params.id);
        
        if (usuarioAEliminar?.rol === 'administrador' && admins <= 1) {
            return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
        }
        
        const usuario = await Usuario.findByIdAndDelete(req.params.id);
        if (usuario) {
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

app.get('/api/backup', async (req, res) => {
    try {
        const backup = {
            menu: await Menu.find(),
            mesas: await Mesa.find(),
            pedidos: await Pedido.find(),
            facturas: await Factura.find(),
            actividad: await Actividad.find(),
            fecha: new Date().toISOString()
        };
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear backup' });
    }
});

app.post('/api/restore', async (req, res) => {
    try {
        const { menu, mesas, pedidos, facturas, actividad } = req.body;
        
        if (menu && Array.isArray(menu)) {
            await Menu.deleteMany({});
            await Menu.insertMany(menu);
        }
        if (mesas && Array.isArray(mesas)) {
            await Mesa.deleteMany({});
            await Mesa.insertMany(mesas);
        }
        if (pedidos && Array.isArray(pedidos)) {
            await Pedido.deleteMany({});
            await Pedido.insertMany(pedidos);
        }
        if (facturas && Array.isArray(facturas)) {
            await Factura.deleteMany({});
            await Factura.insertMany(facturas);
        }
        if (actividad && Array.isArray(actividad)) {
            await Actividad.deleteMany({});
            await Actividad.insertMany(actividad);
        }
        
        res.json({ message: 'Datos restaurados correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al restaurar datos' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

