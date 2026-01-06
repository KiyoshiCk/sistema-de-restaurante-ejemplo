const { connectToDatabase, Menu, Mesa, Pedido, Factura, Actividad } = require('./db');

// Headers CORS
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Respuesta helper
const respond = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body)
});

// Handler principal
exports.handler = async (event, context) => {
    // Evitar que la conexión espere al event loop vacío
    context.callbackWaitsForEmptyEventLoop = false;

    // Manejar preflight CORS
    if (event.httpMethod === 'OPTIONS') {
        return respond(200, {});
    }

    try {
        await connectToDatabase();

        const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '') || '/';
        const method = event.httpMethod;
        const body = event.body ? JSON.parse(event.body) : {};
        
        // Extraer ID de la ruta (ej: /menu/123 -> 123)
        const pathParts = path.split('/').filter(Boolean);
        const resource = pathParts[0];
        const id = pathParts[1];

        console.log(`📥 ${method} ${path}`, id ? `ID: ${id}` : '');

        // ============= ROUTING =============

        // Health check
        if (path === '/health' || path === '/') {
            return respond(200, { status: 'OK', timestamp: new Date().toISOString() });
        }

        // ============= MENÚ =============
        if (resource === 'menu') {
            if (method === 'GET' && !id) {
                const menu = await Menu.find();
                return respond(200, menu);
            }
            if (method === 'POST') {
                const nuevoPlatillo = new Menu(body);
                await nuevoPlatillo.save();
                return respond(201, nuevoPlatillo);
            }
            if (method === 'PUT' && id) {
                const platillo = await Menu.findByIdAndUpdate(id, body, { new: true });
                if (platillo) return respond(200, platillo);
                return respond(404, { error: 'Platillo no encontrado' });
            }
            if (method === 'DELETE' && id) {
                const platillo = await Menu.findByIdAndDelete(id);
                if (platillo) return respond(200, { message: 'Platillo eliminado' });
                return respond(404, { error: 'Platillo no encontrado' });
            }
        }

        // ============= MESAS =============
        if (resource === 'mesas') {
            if (method === 'GET' && !id) {
                const mesas = await Mesa.find();
                return respond(200, mesas);
            }
            if (method === 'POST') {
                const nuevaMesa = new Mesa(body);
                await nuevaMesa.save();
                return respond(201, nuevaMesa);
            }
            if (method === 'PUT' && id) {
                const mesa = await Mesa.findByIdAndUpdate(id, body, { new: true });
                if (mesa) return respond(200, mesa);
                return respond(404, { error: 'Mesa no encontrada' });
            }
            if (method === 'DELETE' && id) {
                const mesa = await Mesa.findByIdAndDelete(id);
                if (mesa) return respond(200, { message: 'Mesa eliminada' });
                return respond(404, { error: 'Mesa no encontrada' });
            }
        }

        // ============= PEDIDOS =============
        if (resource === 'pedidos') {
            if (method === 'GET' && !id) {
                const pedidos = await Pedido.find();
                return respond(200, pedidos);
            }
            if (method === 'POST') {
                const nuevoPedido = new Pedido(body);
                await nuevoPedido.save();
                return respond(201, nuevoPedido);
            }
            if (method === 'PUT' && id) {
                const pedido = await Pedido.findByIdAndUpdate(id, body, { new: true });
                if (pedido) return respond(200, pedido);
                return respond(404, { error: 'Pedido no encontrado' });
            }
            if (method === 'DELETE' && id) {
                const pedido = await Pedido.findByIdAndDelete(id);
                if (pedido) return respond(200, { message: 'Pedido eliminado' });
                return respond(404, { error: 'Pedido no encontrado' });
            }
        }

        // ============= FACTURAS =============
        if (resource === 'facturas') {
            if (method === 'GET') {
                const facturas = await Factura.find();
                return respond(200, facturas);
            }
            if (method === 'POST') {
                const nuevaFactura = new Factura(body);
                await nuevaFactura.save();
                return respond(201, nuevaFactura);
            }
        }

        // ============= ACTIVIDAD =============
        if (resource === 'actividad') {
            if (method === 'GET') {
                const actividad = await Actividad.find().sort({ fecha: -1 });
                return respond(200, actividad);
            }
            if (method === 'POST') {
                const nuevaActividad = new Actividad(body);
                await nuevaActividad.save();
                return respond(201, nuevaActividad);
            }
        }

        // ============= LOGIN =============
        if (resource === 'login' && method === 'POST') {
            const usuarios = [
                { id: 1, username: 'admin', password: 'admin123', rol: 'administrador', nombre: 'Administrador' },
                { id: 2, username: 'mesero', password: 'mesero123', rol: 'mesero', nombre: 'Mesero' }
            ];

            const { username, password } = body;
            const usuario = usuarios.find(u => u.username === username && u.password === password);
            
            if (usuario) {
                return respond(200, {
                    success: true,
                    usuario: {
                        id: usuario.id,
                        username: usuario.username,
                        rol: usuario.rol,
                        nombre: usuario.nombre
                    }
                });
            }
            return respond(401, { success: false, message: 'Usuario o contraseña incorrectos' });
        }

        // ============= BACKUP =============
        if (resource === 'backup' && method === 'GET') {
            const backup = {
                menu: await Menu.find(),
                mesas: await Mesa.find(),
                pedidos: await Pedido.find(),
                facturas: await Factura.find(),
                actividad: await Actividad.find(),
                fecha: new Date().toISOString()
            };
            return respond(200, backup);
        }

        // ============= RESTORE =============
        if (resource === 'restore' && method === 'POST') {
            const { menu, mesas, pedidos, facturas, actividad } = body;
            
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
            
            return respond(200, { message: 'Datos restaurados correctamente' });
        }

        // Ruta no encontrada
        return respond(404, { error: 'Endpoint no encontrado', path, method });

    } catch (error) {
        console.error('❌ Error en API:', error);
        return respond(500, { error: 'Error interno del servidor', details: error.message });
    }
};
