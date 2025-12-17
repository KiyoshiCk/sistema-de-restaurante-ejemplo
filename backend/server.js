const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = '/data';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Asegurar que el directorio de datos existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Función para leer datos de archivo
const readData = (filename) => {
    const filePath = path.join(DATA_DIR, `${filename}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

// Función para escribir datos a archivo
const writeData = (filename, data) => {
    const filePath = path.join(DATA_DIR, `${filename}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

// Inicializar datos de ejemplo peruanos
const inicializarDatos = () => {
    const menuPath = path.join(DATA_DIR, 'menu.json');
    const mesasPath = path.join(DATA_DIR, 'mesas.json');
    
    // Solo inicializar si no existen datos
    if (!fs.existsSync(menuPath)) {
        const menuPeruano = [
            { id: 1, nombre: "Ceviche de Pescado", categoria: "Entradas", precio: 35, descripcion: "Pescado fresco marinado en limón con ají limo, cebolla morada y camote", disponible: true, icono: "🐟" },
            { id: 2, nombre: "Causa Limeña", categoria: "Entradas", precio: 22, descripcion: "Papa amarilla con limón, ají amarillo, rellena de atún o pollo", disponible: true, icono: "🥔" },
            { id: 3, nombre: "Anticuchos de Corazón", categoria: "Entradas", precio: 28, descripcion: "Brochetas de corazón de res marinadas en especias peruanas", disponible: true, icono: "🍢" },
            { id: 4, nombre: "Tequeños", categoria: "Entradas", precio: 18, descripcion: "Deditos de masa rellenos de queso fresco", disponible: true, icono: "🧀" },
            { id: 5, nombre: "Lomo Saltado", categoria: "Platos Fuertes", precio: 42, descripcion: "Tiras de lomo fino salteado con cebolla, tomate, papas fritas y arroz", disponible: true, icono: "🥩" },
            { id: 6, nombre: "Ají de Gallina", categoria: "Platos Fuertes", precio: 38, descripcion: "Pollo deshilachado en crema de ají amarillo con papas y aceitunas", disponible: true, icono: "🍗" },
            { id: 7, nombre: "Arroz con Pollo", categoria: "Platos Fuertes", precio: 32, descripcion: "Arroz verde con cilantro acompañado de pollo y papa a la huancaína", disponible: true, icono: "🍚" },
            { id: 8, nombre: "Tacu Tacu con Lomo", categoria: "Platos Fuertes", precio: 45, descripcion: "Mezcla de arroz y frijoles frita con lomo saltado encima", disponible: true, icono: "🍛" },
            { id: 9, nombre: "Seco de Carne", categoria: "Platos Fuertes", precio: 40, descripcion: "Carne guisada con cilantro, frijoles y arroz", disponible: true, icono: "🥘" },
            { id: 10, nombre: "Pescado a lo Macho", categoria: "Platos Fuertes", precio: 48, descripcion: "Pescado frito con salsa de mariscos cremosa", disponible: true, icono: "🐠" },
            { id: 11, nombre: "Tallarín Saltado", categoria: "Platos Fuertes", precio: 35, descripcion: "Fideos salteados con carne o pollo al estilo chifa peruano", disponible: true, icono: "🍝" },
            { id: 12, nombre: "Chicharrón de Pescado", categoria: "Platos Fuertes", precio: 38, descripcion: "Trozos de pescado frito crocante con yuca y salsa criolla", disponible: true, icono: "🍤" },
            { id: 13, nombre: "Inca Kola", categoria: "Bebidas", precio: 8, descripcion: "La bebida nacional del Perú, sabor único", disponible: true, icono: "🥤" },
            { id: 14, nombre: "Chicha Morada", categoria: "Bebidas", precio: 10, descripcion: "Refresco de maíz morado con especias y frutas", disponible: true, icono: "🍹" },
            { id: 15, nombre: "Pisco Sour", categoria: "Bebidas", precio: 25, descripcion: "Cóctel de pisco, limón, jarabe y clara de huevo", disponible: true, icono: "🍸" },
            { id: 16, nombre: "Emoliente", categoria: "Bebidas", precio: 7, descripcion: "Bebida caliente de hierbas medicinales", disponible: true, icono: "☕" },
            { id: 17, nombre: "Limonada Frozen", categoria: "Bebidas", precio: 12, descripcion: "Limonada peruana bien helada", disponible: true, icono: "🍋" },
            { id: 18, nombre: "Suspiro Limeño", categoria: "Postres", precio: 18, descripcion: "Manjar blanco con merengue de oporto", disponible: true, icono: "🍮" },
            { id: 19, nombre: "Mazamorra Morada", categoria: "Postres", precio: 15, descripcion: "Postre de maíz morado con frutas", disponible: true, icono: "🍇" },
            { id: 20, nombre: "Picarones", categoria: "Postres", precio: 16, descripcion: "Buñuelos de zapallo con miel de chancaca", disponible: true, icono: "🍩" },
            { id: 21, nombre: "Alfajores", categoria: "Postres", precio: 12, descripcion: "Galletas rellenas de manjar blanco", disponible: true, icono: "🍪" },
            { id: 22, nombre: "Arroz con Leche", categoria: "Postres", precio: 14, descripcion: "Arroz cremoso con leche, canela y pasas", disponible: true, icono: "🍚" }
        ];
        writeData('menu', menuPeruano);
        console.log('✅ Menú peruano inicializado');
    }
    
    if (!fs.existsSync(mesasPath)) {
        const mesas = [
            { id: 1, numero: 1, capacidad: 4, estado: "disponible" },
            { id: 2, numero: 2, capacidad: 2, estado: "disponible" },
            { id: 3, numero: 3, capacidad: 6, estado: "disponible" },
            { id: 4, numero: 4, capacidad: 4, estado: "disponible" },
            { id: 5, numero: 5, capacidad: 8, estado: "disponible" },
            { id: 6, numero: 6, capacidad: 2, estado: "disponible" },
            { id: 7, numero: 7, capacidad: 4, estado: "disponible" },
            { id: 8, numero: 8, capacidad: 4, estado: "disponible" },
            { id: 9, numero: 9, capacidad: 6, estado: "disponible" },
            { id: 10, numero: 10, capacidad: 2, estado: "disponible" }
        ];
        writeData('mesas', mesas);
        console.log('✅ Mesas inicializadas');
    }
};

// ============= MENÚ =============

// GET todos los platillos
app.get('/api/menu', (req, res) => {
    const menu = readData('menu');
    res.json(menu);
});

// POST nuevo platillo
app.post('/api/menu', (req, res) => {
    const menu = readData('menu');
    const nuevoPlatillo = {
        id: Date.now(),
        ...req.body
    };
    menu.push(nuevoPlatillo);
    writeData('menu', menu);
    res.status(201).json(nuevoPlatillo);
});

// PUT actualizar platillo
app.put('/api/menu/:id', (req, res) => {
    const menu = readData('menu');
    const id = parseInt(req.params.id);
    const index = menu.findIndex(p => p.id === id);
    
    if (index !== -1) {
        menu[index] = { id, ...req.body };
        writeData('menu', menu);
        res.json(menu[index]);
    } else {
        res.status(404).json({ error: 'Platillo no encontrado' });
    }
});

// DELETE eliminar platillo
app.delete('/api/menu/:id', (req, res) => {
    const menu = readData('menu');
    const id = parseInt(req.params.id);
    const filteredMenu = menu.filter(p => p.id !== id);
    
    if (menu.length !== filteredMenu.length) {
        writeData('menu', filteredMenu);
        res.json({ message: 'Platillo eliminado' });
    } else {
        res.status(404).json({ error: 'Platillo no encontrado' });
    }
});

// ============= MESAS =============

app.get('/api/mesas', (req, res) => {
    const mesas = readData('mesas');
    res.json(mesas);
});

app.post('/api/mesas', (req, res) => {
    const mesas = readData('mesas');
    const nuevaMesa = {
        id: Date.now(),
        ...req.body
    };
    mesas.push(nuevaMesa);
    writeData('mesas', mesas);
    res.status(201).json(nuevaMesa);
});

app.put('/api/mesas/:id', (req, res) => {
    const mesas = readData('mesas');
    const id = parseInt(req.params.id);
    const index = mesas.findIndex(m => m.id === id);
    
    if (index !== -1) {
        mesas[index] = { id, ...req.body };
        writeData('mesas', mesas);
        res.json(mesas[index]);
    } else {
        res.status(404).json({ error: 'Mesa no encontrada' });
    }
});

app.delete('/api/mesas/:id', (req, res) => {
    const mesas = readData('mesas');
    const id = parseInt(req.params.id);
    const filteredMesas = mesas.filter(m => m.id !== id);
    
    if (mesas.length !== filteredMesas.length) {
        writeData('mesas', filteredMesas);
        res.json({ message: 'Mesa eliminada' });
    } else {
        res.status(404).json({ error: 'Mesa no encontrada' });
    }
});

// ============= PEDIDOS =============

app.get('/api/pedidos', (req, res) => {
    const pedidos = readData('pedidos');
    res.json(pedidos);
});

app.post('/api/pedidos', (req, res) => {
    const pedidos = readData('pedidos');
    const nuevoPedido = {
        id: Date.now(),
        ...req.body
    };
    pedidos.push(nuevoPedido);
    writeData('pedidos', pedidos);
    res.status(201).json(nuevoPedido);
});

app.put('/api/pedidos/:id', (req, res) => {
    const pedidos = readData('pedidos');
    const id = parseInt(req.params.id);
    const index = pedidos.findIndex(p => p.id === id);
    
    if (index !== -1) {
        pedidos[index] = { id, ...req.body };
        writeData('pedidos', pedidos);
        res.json(pedidos[index]);
    } else {
        res.status(404).json({ error: 'Pedido no encontrado' });
    }
});

app.delete('/api/pedidos/:id', (req, res) => {
    const pedidos = readData('pedidos');
    const id = parseInt(req.params.id);
    const filteredPedidos = pedidos.filter(p => p.id !== id);
    
    if (pedidos.length !== filteredPedidos.length) {
        writeData('pedidos', filteredPedidos);
        res.json({ message: 'Pedido eliminado' });
    } else {
        res.status(404).json({ error: 'Pedido no encontrado' });
    }
});

// ============= FACTURAS =============

app.get('/api/facturas', (req, res) => {
    const facturas = readData('facturas');
    res.json(facturas);
});

app.post('/api/facturas', (req, res) => {
    const facturas = readData('facturas');
    const nuevaFactura = {
        id: Date.now(),
        ...req.body
    };
    facturas.push(nuevaFactura);
    writeData('facturas', facturas);
    res.status(201).json(nuevaFactura);
});

// ============= ACTIVIDAD =============

app.get('/api/actividad', (req, res) => {
    const actividad = readData('actividad');
    res.json(actividad);
});

app.post('/api/actividad', (req, res) => {
    const actividad = readData('actividad');
    const nuevaActividad = {
        ...req.body,
        fecha: new Date().toISOString()
    };
    actividad.push(nuevaActividad);
    writeData('actividad', actividad);
    res.status(201).json(nuevaActividad);
});

// ============= AUTENTICACIÓN =============

// Usuarios del sistema (en producción esto debería estar en BD con contraseñas hasheadas)
const usuarios = [
    { id: 1, username: 'admin', password: 'admin123', rol: 'administrador', nombre: 'Administrador' },
    { id: 2, username: 'mesero', password: 'mesero123', rol: 'mesero', nombre: 'Mesero' }
];

app.post('/api/login', (req, res) => {
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

// GET backup completo
app.get('/api/backup', (req, res) => {
    const backup = {
        menu: readData('menu'),
        mesas: readData('mesas'),
        pedidos: readData('pedidos'),
        facturas: readData('facturas'),
        actividad: readData('actividad'),
        fecha: new Date().toISOString()
    };
    res.json(backup);
});

// POST restore desde backup
app.post('/api/restore', (req, res) => {
    try {
        const { menu, mesas, pedidos, facturas, actividad } = req.body;
        
        if (menu) writeData('menu', menu);
        if (mesas) writeData('mesas', mesas);
        if (pedidos) writeData('pedidos', pedidos);
        if (facturas) writeData('facturas', facturas);
        if (actividad) writeData('actividad', actividad);
        
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
    console.log(`📁 Datos guardados en: ${DATA_DIR}`);
    
    // Inicializar datos después de que el servidor esté listo
    inicializarDatos();
});
