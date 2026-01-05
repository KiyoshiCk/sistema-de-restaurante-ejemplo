const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/restaurante?authSource=admin';

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(bodyParser.json());

// ============= SCHEMAS =============

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
    numeroMesa: Number,
    items: [{
        id: mongoose.Schema.Types.ObjectId,
        nombre: String,
        cantidad: Number,
        precio: Number
    }],
    estado: String,
    total: Number,
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

const facturaSchema = new mongoose.Schema({
    numeroFactura: String,
    numeroMesa: Number,
    items: [{
        nombre: String,
        cantidad: Number,
        precio: Number
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

// ============= MODELOS =============

const Menu = mongoose.model('Menu', menuSchema);
const Mesa = mongoose.model('Mesa', mesaSchema);
const Pedido = mongoose.model('Pedido', pedidoSchema);
const Factura = mongoose.model('Factura', facturaSchema);
const Actividad = mongoose.model('Actividad', actividadSchema);

// ============= CONEXIÓN A MONGODB =============

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('✅ Conectado a MongoDB');
    
    // Inicializar datos de ejemplo si la BD está vacía
    await inicializarDatos();
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
        res.status(500).json({ error: 'Error al obtener menú' });
    }
});

app.post('/api/menu', async (req, res) => {
    try {
        const nuevoPlatillo = new Menu(req.body);
        await nuevoPlatillo.save();
        res.status(201).json(nuevoPlatillo);
    } catch (error) {
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
        res.status(500).json({ error: 'Error al eliminar platillo' });
    }
});

// ============= MESAS =============

app.get('/api/mesas', async (req, res) => {
    try {
        const mesas = await Mesa.find();
        res.json(mesas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener mesas' });
    }
});

app.post('/api/mesas', async (req, res) => {
    try {
        const nuevaMesa = new Mesa(req.body);
        await nuevaMesa.save();
        res.status(201).json(nuevaMesa);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear mesa' });
    }
});

app.put('/api/mesas/:id', async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (mesa) {
            res.json(mesa);
        } else {
            res.status(404).json({ error: 'Mesa no encontrada' });
        }
    } catch (error) {
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
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

app.post('/api/pedidos', async (req, res) => {
    try {
        const nuevoPedido = new Pedido(req.body);
        await nuevoPedido.save();
        res.status(201).json(nuevoPedido);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear pedido' });
    }
});

app.put('/api/pedidos/:id', async (req, res) => {
    try {
        const pedido = await Pedido.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (pedido) {
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
        res.status(201).json(nuevaFactura);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear factura' });
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
        res.status(201).json(nuevaActividad);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear actividad' });
    }
});

// ============= AUTENTICACIÓN =============

app.post('/api/login', (req, res) => {
    const usuarios = [
        { id: 1, username: 'admin', password: 'admin123', rol: 'administrador', nombre: 'Administrador' },
        { id: 2, username: 'mesero', password: 'mesero123', rol: 'mesero', nombre: 'Mesero' }
    ];

    const { username, password } = req.body;
    const usuario = usuarios.find(u => u.username === username && u.password === password);
    
    if (usuario) {
        res.json({
            success: true,
            usuario: {
                id: usuario.id,
                username: usuario.username,
                rol: usuario.rol,
                nombre: usuario.nombre
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
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

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend corriendo en puerto ${PORT}`);
    console.log(`📦 Base de datos: MongoDB`);
});
