const mongoose = require('mongoose');

// Cachear la conexión para reutilizarla entre invocaciones
let cachedDb = null;

const MONGODB_URI = process.env.MONGODB_URI;

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
// Usar modelos existentes o crear nuevos

const Menu = mongoose.models.Menu || mongoose.model('Menu', menuSchema);
const Mesa = mongoose.models.Mesa || mongoose.model('Mesa', mesaSchema);
const Pedido = mongoose.models.Pedido || mongoose.model('Pedido', pedidoSchema);
const Factura = mongoose.models.Factura || mongoose.model('Factura', facturaSchema);
const Actividad = mongoose.models.Actividad || mongoose.model('Actividad', actividadSchema);

// ============= CONEXIÓN =============

async function connectToDatabase() {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI no está configurada en las variables de entorno');
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
        });
        
        cachedDb = mongoose.connection;
        console.log('✅ Conectado a MongoDB Atlas');
        
        // Inicializar datos si es necesario
        await inicializarDatos();
        
        return cachedDb;
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        throw error;
    }
}

// ============= INICIALIZACIÓN DE DATOS =============

const inicializarDatos = async () => {
    try {
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

module.exports = {
    connectToDatabase,
    Menu,
    Mesa,
    Pedido,
    Factura,
    Actividad
};
