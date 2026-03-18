// Panel de Administración con Control de Acceso
class AdminApp {
    constructor() {
        this.API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
            ? API_CONFIG.url
            : 'http://localhost:3000/api';
        this.SOCKET_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.socketUrl)
            ? API_CONFIG.socketUrl
            : 'http://localhost:3000';
        this.socket = null;
        this.usuario = null;
        this.menu = [];
        this.mesas = [];
        this.pedidos = [];
        this.facturas = [];
        this.actividad = [];
        this.editandoPlatilloId = null;
        this.pedidoActual = [];
        this.usuarios = [];
        this.editandoUsuarioId = null;
        this.inventario = [];
        this.editandoInventarioId = null;
        
        this.verificarSesion();
    }

    inicializarSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO no disponible');
            return;
        }
        
        this.socket = io(this.SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        this.socket.on('connect', () => {
            console.log('🔌 Conectado a WebSocket');
            // Unirse a la sala según el rol
            this.socket.emit('join-room', this.usuario.rol);
            // Sincronizar datos al conectar/reconectar
            this.cargarDatos();
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Desconectado de WebSocket');
            this.mostrarNotificacion('⚠️ Conexión perdida', 'Intentando reconectar...');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconectado después de', attemptNumber, 'intentos');
            this.mostrarNotificacion('✅ Reconectado', 'Sincronizando datos...');
        });

        // Escuchar eventos en tiempo real - ACTUALIZACIONES INSTANTÁNEAS
        this.socket.on('nuevo-pedido', (pedido) => {
            console.log('📦 Nuevo pedido recibido:', pedido);
            // Evitar duplicados: solo agregar si no existe
            const existe = this.pedidos.some(p => p._id === pedido._id);
            if (!existe) {
                this.mostrarNotificacion('🆕 Nuevo pedido', `Mesa ${pedido.mesaNumero || pedido.numeroMesa}`);
                this.pedidos.unshift(pedido);
                this.cargarPedidosSinAnimacion();
                this.cargarDashboard();
            }
        });

        this.socket.on('pedido-actualizado', (pedido) => {
            console.log('📝 Pedido actualizado:', pedido);
            this.mostrarNotificacion('📝 Pedido actualizado', `Mesa ${pedido.mesaNumero || pedido.numeroMesa} - ${pedido.estado}`);
            // Actualización instantánea: actualizar pedido localmente
            const index = this.pedidos.findIndex(p => p._id === pedido._id);
            if (index !== -1) {
                this.pedidos[index] = pedido;
            } else {
                this.pedidos.unshift(pedido);
            }
            this.cargarPedidosSinAnimacion();
            this.cargarDashboard();
            // Actualizar sección de cobrar si está visible
            if (document.getElementById('cobrar')?.classList.contains('active')) {
                this.cargarMesasParaCobrar();
            }
        });

        this.socket.on('pedido-eliminado', (data) => {
            console.log('🗑️ Pedido eliminado:', data);
            // Eliminar pedido localmente
            this.pedidos = this.pedidos.filter(p => p._id !== data._id);
            this.cargarPedidosSinAnimacion();
            this.cargarDashboard();
            // Actualizar sección de cobrar si está visible
            if (document.getElementById('cobrar')?.classList.contains('active')) {
                this.cargarMesasParaCobrar();
            }
        });

        this.socket.on('mesa-actualizada', (mesa) => {
            console.log('🪑 Mesa actualizada:', mesa);
            // Actualización instantánea: actualizar mesa localmente
            const index = this.mesas.findIndex(m => m._id === mesa._id);
            if (index !== -1) {
                this.mesas[index] = mesa;
            }
            // Actualizar vista de mesas si está visible
            if (document.getElementById('mesas')?.classList.contains('active')) {
                this.cargarMesas();
            }
            this.cargarDashboard();
        });

        this.socket.on('nueva-factura', (factura) => {
            console.log('💰 Nueva factura:', factura);
            // Agregar factura localmente
            this.facturas.push(factura);
            if (this.usuario.rol === 'administrador') {
                this.cargarFacturacion();
            }
        });

        this.socket.on('nueva-actividad', (actividad) => {
            console.log('📋 Nueva actividad:', actividad);
            // Agregar al inicio del array local sin recargar todo
            this.actividad.unshift(actividad);
            this.mostrarActividadReciente();
        });

        // Evento para forzar recarga completa (útil cuando hay desincronización)
        this.socket.on('sync-completo', () => {
            console.log('🔄 Sincronización completa solicitada');
            this.cargarDatos();
        });
    }

    // ===== NOTIFICACIONES =====
    
    async solicitarPermisoNotificaciones() {
        if (!('Notification' in window)) {
            console.log('Este navegador no soporta notificaciones');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    }

    async enviarNotificacionPush(titulo, opciones = {}) {
        const tienePermiso = await this.solicitarPermisoNotificaciones();
        
        if (tienePermiso) {
            const notifOpciones = {
                body: opciones.body || '',
                icon: opciones.icon || '🍽️',
                badge: '🍽️',
                tag: opciones.tag || 'restaurante',
                requireInteraction: opciones.requireInteraction || false,
                ...opciones
            };
            
            try {
                const notificacion = new Notification(titulo, notifOpciones);
                
                notificacion.onclick = () => {
                    window.focus();
                    notificacion.close();
                    if (opciones.onClick) opciones.onClick();
                };
                
                // Auto cerrar después de 8 segundos si no requiere interacción
                if (!opciones.requireInteraction) {
                    setTimeout(() => notificacion.close(), 8000);
                }
                
                return notificacion;
            } catch (e) {
                console.log('Error al crear notificación:', e);
            }
        }
        
        return null;
    }

    mostrarNotificacion(titulo, mensaje) {
        // Crear notificación visual temporal (toast)
        const notif = document.createElement('div');
        notif.className = 'notificacion-toast';
        notif.innerHTML = `<strong>${titulo}</strong><p>${mensaje}</p>`;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;
        
        notif.onclick = () => notif.remove();
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 4000);
        
        // También enviar notificación push del navegador si el usuario no está en la página
        if (document.hidden) {
            this.enviarNotificacionPush(titulo, { body: mensaje });
        }
    }

    verificarSesion() {
        const usuarioGuardado = localStorage.getItem('usuario');
        const tokenGuardado = localStorage.getItem('token');
        if (usuarioGuardado && tokenGuardado) {
            this.usuario = JSON.parse(usuarioGuardado);
            this.token = tokenGuardado;
            this.mostrarPanel();
        } else {
            this.mostrarLogin();
        }
    }

    mostrarLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
        
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
    }

    async login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${this.API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                this.usuario = data.usuario;
                this.token = data.token;
                localStorage.setItem('usuario', JSON.stringify(this.usuario));
                localStorage.setItem('token', data.token);
                this.mostrarPanel();
            } else {
                alert('Usuario o contraseña incorrectos');
            }
        } catch (error) {
            alert('Error al conectar con el servidor');
            console.error(error);
        }
    }

    logout() {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
        this.usuario = null;
        this.token = null;
        location.reload();
    }

    async mostrarPanel() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        
        // Mostrar información del usuario
        document.getElementById('user-name').textContent = this.usuario.nombre;
        const badge = document.getElementById('user-role-badge');
        badge.textContent = this.usuario.rol === 'administrador' ? '👑 Admin' : '👤 Mesero';
        badge.className = `role-badge ${this.usuario.rol}`;
        
        // Cargar navegación según rol
        this.cargarNavegacion();
        
        // Aplicar restricciones según rol
        this.aplicarPermisos();
        
        // Inicializar WebSocket para tiempo real
        this.inicializarSocket();
        
        // Solicitar permisos de notificación
        this.solicitarPermisoNotificaciones();
        
        // Inicializar funcionalidad
        await this.init();
    }

    cargarNavegacion() {
        const nav = document.getElementById('main-nav');
        
        if (this.usuario.rol === 'administrador') {
            nav.innerHTML = `
                <button class="nav-btn active" data-page="dashboard">
                    <span class="icon">📊</span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="menu">
                    <span class="icon">📋</span>
                    Gestión Menú
                </button>
                <button class="nav-btn" data-page="mesas">
                    <span class="icon">🪑</span>
                    Mesas
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon">🛎️</span>
                    Pedidos
                </button>
                <button class="nav-btn" data-page="inventario">
                    <span class="icon">📦</span>
                    Inventario
                </button>
                <button class="nav-btn" data-page="reportes">
                    <span class="icon">📈</span>
                    Reportes
                </button>
                <button class="nav-btn" data-page="facturacion">
                    <span class="icon">💰</span>
                    Facturación
                </button>
                <button class="nav-btn" data-page="usuarios">
                    <span class="icon">👥</span>
                    Usuarios
                </button>
                <button class="nav-btn" data-page="config-ubicacion">
                    <span class="icon">📍</span>
                    Ubicación
                </button>
            `;
        } else if (this.usuario.rol === 'mesero') {
            // Mesero: dashboard, mesas, pedidos y cobrar
            nav.innerHTML = `
                <button class="nav-btn active" data-page="dashboard">
                    <span class="icon">📊</span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="mesas">
                    <span class="icon">🪑</span>
                    Mesas
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon">🛎️</span>
                    Pedidos
                </button>
            `;
        } else {
            // Cocinero: solo dashboard y pedidos
            nav.innerHTML = `
                <button class="nav-btn active" data-page="dashboard">
                    <span class="icon">📊</span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon">🛎️</span>
                    Pedidos
                </button>
            `;
        }
        
        this.setupNavigation();
    }

    aplicarPermisos() {
        if (this.usuario.rol !== 'administrador') {
            // Ocultar elementos exclusivos de admin
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'none';
            });
            
            // Ocultar card de ventas para meseros
            const ventasCard = document.getElementById('ventas-card');
            if (ventasCard) ventasCard.style.display = 'none';
        }
    }

    async init() {
        this.setupModals();
        this.setupForms();
        this.actualizarFechaHora();
        
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        
        await this.cargarDatos();
        
        this.cargarDashboard();
        if (this.usuario.rol === 'administrador') {
            this.cargarMenu();
            this.cargarFacturacion();
            this.cargarUsuarios();
        }
        this.cargarMesas();
        this.cargarPedidos();
        
        setInterval(() => this.actualizarFechaHora(), 1000);
        
        // Auto-refresh como fallback cada 10 segundos (WebSocket es el principal)
        // Reducido para no sobrecargar cuando WebSocket funciona
        setInterval(() => this.refrescarDatos(), 10000);
    }

    // Refrescar pedidos, mesas y actividad sin recargar toda la página
    async refrescarDatos() {
        try {
            const authHeaders = { 'Authorization': `Bearer ${this.token}` };
            const fetchAuth = (url) => fetch(url, { headers: authHeaders }).then(r => {
                if (r.status === 401 || r.status === 403) { this.logout(); throw new Error('Sesión expirada'); }
                return r.json();
            });
            const [pedidosActualizados, mesasActualizadas, actividadActualizada] = await Promise.all([
                fetchAuth(`${this.API_URL}/pedidos`),
                fetchAuth(`${this.API_URL}/mesas`),
                fetchAuth(`${this.API_URL}/actividad`)
            ]);
            
            // Detectar cambios en pedidos
            const cambiosPedidos = this.detectarCambiosPedidos(pedidosActualizados);
            
            // Detectar cambios en mesas
            const cambiosMesas = this.detectarCambiosMesas(mesasActualizadas);
            
            // Detectar cambios en actividad
            const cambiosActividad = this.actividad.length !== actividadActualizada.length;
            
            // Actualizar datos
            if (cambiosPedidos) {
                this.pedidos = pedidosActualizados;
                this.cargarPedidosSinAnimacion();
            }
            
            if (cambiosMesas) {
                this.mesas = mesasActualizadas;
                // Solo actualizar vista de mesas si está visible
                if (document.getElementById('mesas').classList.contains('active')) {
                    this.cargarMesas();
                }
            }
            
            if (cambiosActividad) {
                this.actividad = actividadActualizada;
            }
            
            // Actualizar dashboard si hubo cualquier cambio
            if (cambiosPedidos || cambiosMesas || cambiosActividad) {
                this.cargarDashboard();
            }
        } catch (error) {
            // Silenciar errores de red en auto-refresh
            console.log('Auto-refresh: sin conexión');
        }
    }
    
    detectarCambiosMesas(nuevas) {
        if (this.mesas.length !== nuevas.length) return true;
        
        for (let i = 0; i < this.mesas.length; i++) {
            const actual = this.mesas.find(m => m._id === nuevas[i]._id);
            if (!actual) return true;
            if (actual.estado !== nuevas[i].estado) return true;
        }
        return false;
    }

    detectarCambiosPedidos(nuevos) {
        if (this.pedidos.length !== nuevos.length) return true;
        
        for (let i = 0; i < this.pedidos.length; i++) {
            const actual = this.pedidos.find(p => p._id === nuevos[i]._id);
            if (!actual) return true;
            if (actual.estado !== nuevos[i].estado) return true;
        }
        return false;
    }

    cargarPedidosSinAnimacion() {
        const container = document.getElementById('lista-pedidos');
        // Mostrar todos los pedidos activos (no cancelados)
        const pedidosActivos = this.pedidos
            .filter(p => p.estado !== 'cancelado')
            .sort((a, b) => {
                // Ordenar: pendiente, preparando, listo, entregado
                const orden = { 'pendiente': 0, 'preparando': 1, 'listo': 2, 'entregado': 3 };
                if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
                return new Date(a.fecha) - new Date(b.fecha);
            });

        if (pedidosActivos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay pedidos activos</p>';
            return;
        }

        // Actualizar solo los pedidos que cambiaron
        pedidosActivos.forEach(pedido => {
            const existente = container.querySelector(`[data-pedido-id="${pedido._id}"]`);
            const nuevoHTML = this.renderPedidoCard(pedido);
            
            if (existente) {
                // Solo actualizar si el contenido cambió
                if (existente.outerHTML !== nuevoHTML) {
                    existente.outerHTML = nuevoHTML;
                }
            } else {
                // Agregar nuevo pedido al final
                container.insertAdjacentHTML('beforeend', nuevoHTML);
            }
        });

        // Eliminar pedidos que ya no están activos
        container.querySelectorAll('.pedido-card').forEach(card => {
            const id = card.dataset.pedidoId;
            if (!pedidosActivos.find(p => p._id === id)) {
                card.remove();
            }
        });
    }

    renderPedidoCard(pedido) {
        // Buscar número de mesa de varias formas
        let mesaNumero = pedido.mesaNumero || pedido.numeroMesa;
        if (!mesaNumero && pedido.mesaId) {
            const mesa = this.mesas.find(m => m._id === pedido.mesaId);
            if (mesa) mesaNumero = mesa.numero;
        }
        mesaNumero = mesaNumero || 'N/A';
        
        return `
            <div class="pedido-card ${pedido.estado === 'entregado' ? 'pedido-entregado' : ''}" data-pedido-id="${pedido._id}">
                <div class="pedido-header">
                    <span class="pedido-mesa">Mesa ${mesaNumero}</span>
                    <span class="pedido-estado ${pedido.estado}">${this.obtenerTextoEstado(pedido.estado)}</span>
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.cantidad}x ${item.nombre}</span>
                            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                        ${item.comentario ? `<div class="pedido-item-comentario">📝 ${item.comentario}</div>` : ''}
                    `).join('')}
                </div>
                <div class="pedido-total">Total: $${pedido.total.toFixed(2)}</div>
                <div class="pedido-actions">
                    ${this.puedePreparar() && pedido.estado === 'pendiente' ? `<button class="btn-primary" onclick="app.cambiarEstadoPedido('${pedido._id}', 'preparando')">🔥 Preparar</button>` : ''}
                    ${this.puedePreparar() && pedido.estado === 'preparando' ? `<button class="btn-success" onclick="app.cambiarEstadoPedido('${pedido._id}', 'listo')">✅ Marcar Listo</button>` : ''}
                    ${this.puedeEntregar() && pedido.estado === 'listo' ? `<button class="btn-success" onclick="app.entregarPedido('${pedido._id}')">🍽️ Entregar</button>` : ''}
                    ${this.puedeEntregar() && pedido.estado === 'entregado' ? `<button class="btn-cobrar" onclick="app.cobrarPedido('${pedido._id}')">💵 Cobrar</button>` : ''}
                    ${this.usuario.rol === 'administrador' && pedido.estado !== 'entregado' ? `<button class="btn-danger" onclick="app.cancelarPedido('${pedido._id}')">❌ Cancelar</button>` : ''}
                </div>
            </div>
        `;
    }

    notificarCambioPedidos() {
        // Mostrar indicador visual de actualización
        const indicator = document.createElement('div');
        indicator.className = 'refresh-indicator';
        indicator.innerHTML = '🔄 Pedidos actualizados';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            animation: fadeInOut 2s ease-in-out;
        `;
        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 2000);
    }

    async cargarDatos() {
        try {
            const authHeaders = { 'Authorization': `Bearer ${this.token}` };
            const fetchAuth = (url) => fetch(url, { headers: authHeaders }).then(r => {
                if (r.status === 401 || r.status === 403) { this.logout(); throw new Error('Sesión expirada'); }
                return r.json();
            });

            const promesas = [
                fetchAuth(`${this.API_URL}/menu`),
                fetchAuth(`${this.API_URL}/mesas`),
                fetchAuth(`${this.API_URL}/pedidos`),
                fetchAuth(`${this.API_URL}/facturas`),
                fetchAuth(`${this.API_URL}/actividad`)
            ];
            
            // Solo cargar usuarios e inventario si es administrador
            if (this.usuario.rol === 'administrador') {
                promesas.push(fetchAuth(`${this.API_URL}/usuarios`));
                promesas.push(fetchAuth(`${this.API_URL}/inventario`));
            }
            
            const resultados = await Promise.all(promesas);
            
            this.menu = resultados[0];
            this.mesas = resultados[1];
            this.pedidos = resultados[2];
            this.facturas = resultados[3];
            this.actividad = resultados[4];
            
            if (this.usuario.rol === 'administrador') {
                this.usuarios = resultados[5] || [];
                this.inventario = resultados[6] || [];
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    async apiRequest(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            };
            
            if (data) options.body = JSON.stringify(data);
            
            const response = await fetch(`${this.API_URL}${endpoint}`, options);
            if (response.status === 401 || response.status === 403) {
                this.logout();
                throw new Error('Sesión expirada');
            }
            return await response.json();
        } catch (error) {
            console.error('Error en API:', error);
            throw error;
        }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.cambiarPagina(page);
            });
        });
    }

    cambiarPagina(page) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        document.getElementById(page).classList.add('active');
        
        if (page === 'dashboard') this.cargarDashboard();
        if (page === 'menu' && this.usuario.rol === 'administrador') this.cargarMenu();
        if (page === 'mesas') this.cargarMesas();
        if (page === 'pedidos') this.cargarPedidos();
        if (page === 'cobrar') this.cargarMesasParaCobrar();
        if (page === 'inventario' && this.usuario.rol === 'administrador') this.cargarInventario();
        if (page === 'reportes' && this.usuario.rol === 'administrador') this.cargarReportes();
        if (page === 'facturacion' && this.usuario.rol === 'administrador') this.cargarFacturacion();
        if (page === 'usuarios' && this.usuario.rol === 'administrador') this.cargarUsuarios();
        if (page === 'config-ubicacion' && this.usuario.rol === 'administrador' && typeof cargarUbicacionAdmin === 'function') cargarUbicacionAdmin();
    }

    actualizarFechaHora() {
        const now = new Date();
        const opciones = { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        document.getElementById('fecha-hora').textContent = 
            now.toLocaleDateString('es-ES', opciones);
    }

    cargarDashboard() {
        const mesasOcupadas = this.mesas.filter(m => m.estado === 'ocupada').length;
        const pedidosActivos = this.pedidos.filter(p => 
            p.estado !== 'entregado' && p.estado !== 'cancelado' && p.estado !== 'pagado'
        ).length;
        const pedidosPendientes = this.pedidos.filter(p => p.estado === 'pendiente').length;
        const pedidosListos = this.pedidos.filter(p => p.estado === 'listo').length;
        
        document.getElementById('mesas-ocupadas').textContent = mesasOcupadas;
        document.getElementById('pedidos-activos').textContent = pedidosActivos;
        document.getElementById('total-platillos').textContent = this.menu.length;
        
        // Mostrar indicador de pedidos pendientes/listos
        const pedidosEl = document.getElementById('pedidos-activos');
        if (pedidosPendientes > 0) {
            pedidosEl.title = `${pedidosPendientes} pendiente(s), ${pedidosListos} listo(s) para entregar`;
        }
        
        if (this.usuario.rol === 'administrador') {
            const hoy = new Date().toDateString();
            const ventasHoy = this.facturas
                .filter(f => new Date(f.fecha).toDateString() === hoy)
                .reduce((sum, f) => sum + (f.total || 0), 0);
            document.getElementById('ventas-hoy').textContent = `$${ventasHoy.toFixed(2)}`;
        }

        this.mostrarActividadReciente();
    }

    mostrarActividadReciente() {
        const container = document.getElementById('actividad-reciente');
        // La API ya devuelve ordenado por fecha DESC (más reciente primero)
        const actividadReciente = this.actividad.slice(0, 10);
        
        if (actividadReciente.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay actividad reciente</p>';
            return;
        }

        container.innerHTML = actividadReciente.map(act => `
            <div class="activity-item">
                <div><strong>${act.descripcion || act.accion || 'Sin descripción'}</strong></div>
                <div class="time">${new Date(act.fecha).toLocaleString('es-ES')}</div>
            </div>
        `).join('');
    }

    async agregarActividad(accion) {
        try {
            const nuevaActividad = await this.apiRequest('/actividad', 'POST', { 
                descripcion: `${this.usuario.nombre}: ${accion}` 
            });
            // Agregar al inicio del array (más reciente primero)
            this.actividad.unshift(nuevaActividad);
            this.mostrarActividadReciente();
        } catch (error) {
            console.error('Error agregando actividad:', error);
        }
    }

    setupModals() {
        if (this.usuario.rol === 'administrador') {
            document.getElementById('btn-agregar-platillo')?.addEventListener('click', () => {
                this.editandoPlatilloId = null;
                this.imagenBase64 = null;
                document.getElementById('modal-platillo-titulo').textContent = 'Agregar Platillo';
                document.getElementById('form-platillo').reset();
                this.limpiarPreviewImagen();
                document.getElementById('modal-platillo').classList.add('active');
            });

            document.getElementById('btn-cancelar-platillo')?.addEventListener('click', () => {
                document.getElementById('modal-platillo').classList.remove('active');
                this.imagenBase64 = null;
                this.limpiarPreviewImagen();
            });

            // Manejo de imagen
            document.getElementById('platillo-imagen')?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.comprimirImagen(file).then(base64 => {
                        this.imagenBase64 = base64;
                        this.mostrarPreviewImagen(base64);
                        document.getElementById('imagen-nombre').textContent = file.name;
                    }).catch(err => {
                        console.error('Error al comprimir imagen:', err);
                        alert('Error al procesar la imagen');
                    });
                }
            });

            document.getElementById('btn-quitar-imagen')?.addEventListener('click', () => {
                this.imagenBase64 = '';
                this.limpiarPreviewImagen();
                document.getElementById('platillo-imagen').value = '';
            });

            document.getElementById('btn-agregar-mesa')?.addEventListener('click', () => {
                document.getElementById('form-mesa').reset();
                document.getElementById('modal-mesa').classList.add('active');
            });

            document.getElementById('btn-cancelar-mesa')?.addEventListener('click', () => {
                document.getElementById('modal-mesa').classList.remove('active');
            });

            // Modal de usuarios
            document.getElementById('btn-agregar-usuario')?.addEventListener('click', () => {
                this.editandoUsuarioId = null;
                document.getElementById('modal-usuario-titulo').textContent = 'Nuevo Usuario';
                document.getElementById('form-usuario').reset();
                document.getElementById('usuario-password').required = true;
                document.getElementById('password-help').textContent = '';
                document.getElementById('grupo-activo').style.display = 'none';
                document.getElementById('modal-usuario').classList.add('active');
            });

            document.getElementById('btn-cancelar-usuario')?.addEventListener('click', () => {
                document.getElementById('modal-usuario').classList.remove('active');
            });

            // Modal de inventario
            document.getElementById('btn-agregar-inventario')?.addEventListener('click', () => {
                this.editandoInventarioId = null;
                document.getElementById('modal-inventario-titulo').textContent = 'Nuevo Item';
                document.getElementById('form-inventario').reset();
                document.getElementById('modal-inventario').classList.add('active');
            });

            document.getElementById('btn-cancelar-inventario')?.addEventListener('click', () => {
                document.getElementById('modal-inventario').classList.remove('active');
            });
        }

        document.getElementById('btn-nuevo-pedido').addEventListener('click', () => {
            this.pedidoActual = [];
            this.cargarModalPedido();
            document.getElementById('modal-pedido').classList.add('active');
        });

        document.getElementById('btn-cancelar-pedido').addEventListener('click', () => {
            document.getElementById('modal-pedido').classList.remove('active');
        });

        // Modal de cobrar
        document.getElementById('btn-procesar-pago')?.addEventListener('click', () => {
            this.procesarPago();
        });

        document.getElementById('btn-cancelar-cobro')?.addEventListener('click', () => {
            document.getElementById('modal-cobrar').classList.remove('active');
        });

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    }

    setupForms() {
        if (this.usuario.rol === 'administrador') {
            document.getElementById('form-platillo')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarPlatillo();
            });

            document.getElementById('form-mesa')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarMesa();
            });

            document.getElementById('form-usuario')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarUsuario();
            });

            document.getElementById('form-inventario')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarInventario();
            });

            document.getElementById('filtro-categoria')?.addEventListener('change', () => this.cargarMenu());
            document.getElementById('buscar-platillo')?.addEventListener('input', () => this.cargarMenu());
        }

        document.getElementById('form-pedido').addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarPedido();
        });
    }

    // ===== UTILIDADES DE IMAGEN =====

    comprimirImagen(file, maxWidth = 400, maxHeight = 300, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    mostrarPreviewImagen(base64) {
        const preview = document.getElementById('imagen-preview');
        const previewImg = document.getElementById('imagen-preview-img');
        previewImg.src = base64;
        preview.classList.add('active');
    }

    limpiarPreviewImagen() {
        const preview = document.getElementById('imagen-preview');
        const previewImg = document.getElementById('imagen-preview-img');
        previewImg.src = '';
        preview.classList.remove('active');
        document.getElementById('imagen-nombre').textContent = 'Sin imagen seleccionada';
    }

    // ===== GESTIÓN DE MENÚ (Solo Admin) =====
    
    cargarMenu() {
        if (this.usuario.rol !== 'administrador') return;
        
        const categoria = document.getElementById('filtro-categoria')?.value || '';
        const busqueda = document.getElementById('buscar-platillo')?.value.toLowerCase() || '';
        
        let menuFiltrado = this.menu;
        
        if (categoria) menuFiltrado = menuFiltrado.filter(p => p.categoria === categoria);
        if (busqueda) menuFiltrado = menuFiltrado.filter(p => 
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
        );

        const container = document.getElementById('lista-menu');
        
        if (menuFiltrado.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No hay platillos para mostrar</p>';
            return;
        }

        container.innerHTML = menuFiltrado.map(platillo => `
            <div class="menu-item ${!platillo.disponible ? 'no-disponible' : ''}">
                ${platillo.imagen ? `<div class="menu-item-imagen"><img src="${platillo.imagen}" alt="${platillo.nombre}"></div>` : ''}
                <h3>${platillo.nombre}</h3>
                <span class="categoria">${platillo.categoria}</span>
                <div class="precio">$${platillo.precio.toFixed(2)}</div>
                <p class="descripcion">${platillo.descripcion || 'Sin descripción'}</p>
                <div class="disponibilidad-status">
                    ${platillo.disponible ? '✅ Disponible' : '❌ No disponible'}
                </div>
                <div class="menu-item-actions">
                    <button class="btn-secondary" onclick="app.toggleDisponibilidad('${platillo._id}')">
                        ${platillo.disponible ? '🚫 Marcar no disponible' : '✅ Marcar disponible'}
                    </button>
                    <button class="btn-primary" onclick="app.editarPlatillo('${platillo._id}')">✏️ Editar</button>
                    <button class="btn-danger" onclick="app.eliminarPlatillo('${platillo._id}')">🗑️ Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    async guardarPlatillo() {
        const platillo = {
            nombre: document.getElementById('platillo-nombre').value,
            categoria: document.getElementById('platillo-categoria').value,
            precio: parseFloat(document.getElementById('platillo-precio').value),
            descripcion: document.getElementById('platillo-descripcion').value
        };

        // Incluir imagen si se seleccionó una nueva o se quitó
        if (this.imagenBase64 !== null && this.imagenBase64 !== undefined) {
            platillo.imagen = this.imagenBase64 || null;
        }

        try {
            if (this.editandoPlatilloId) {
                const actualizado = await this.apiRequest(`/menu/${this.editandoPlatilloId}`, 'PUT', platillo);
                const index = this.menu.findIndex(p => p._id === this.editandoPlatilloId);
                this.menu[index] = actualizado;
                await this.agregarActividad(`Platillo actualizado: ${platillo.nombre}`);
            } else {
                const nuevo = await this.apiRequest('/menu', 'POST', platillo);
                this.menu.push(nuevo);
                await this.agregarActividad(`Nuevo platillo agregado: ${platillo.nombre}`);
            }

            this.imagenBase64 = null;
            this.limpiarPreviewImagen();
            document.getElementById('modal-platillo').classList.remove('active');
            this.cargarMenu();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar el platillo');
        }
    }

    editarPlatillo(id) {
        const platillo = this.menu.find(p => p._id === id);
        this.editandoPlatilloId = id;
        this.imagenBase64 = null;
        
        document.getElementById('modal-platillo-titulo').textContent = 'Editar Platillo';
        document.getElementById('platillo-nombre').value = platillo.nombre;
        document.getElementById('platillo-categoria').value = platillo.categoria;
        document.getElementById('platillo-precio').value = platillo.precio;
        document.getElementById('platillo-descripcion').value = platillo.descripcion || '';
        document.getElementById('platillo-imagen').value = '';

        if (platillo.imagen) {
            this.mostrarPreviewImagen(platillo.imagen);
            document.getElementById('imagen-nombre').textContent = 'Imagen actual del platillo';
        } else {
            this.limpiarPreviewImagen();
        }
        
        document.getElementById('modal-platillo').classList.add('active');
    }

    async toggleDisponibilidad(id) {
        try {
            const platillo = this.menu.find(p => p._id === id);
            const nuevoEstado = !platillo.disponible;
            
            const actualizado = await this.apiRequest(`/menu/${id}`, 'PUT', {
                ...platillo,
                disponible: nuevoEstado
            });
            
            const index = this.menu.findIndex(p => p._id === id);
            this.menu[index] = actualizado;
            
            await this.agregarActividad(`${platillo.nombre} marcado como ${nuevoEstado ? 'disponible' : 'no disponible'}`);
            this.cargarMenu();
        } catch (error) {
            alert('Error al cambiar disponibilidad');
        }
    }

    async eliminarPlatillo(id) {
        if (confirm('¿Estás seguro de eliminar este platillo?')) {
            try {
                const platillo = this.menu.find(p => p._id === id);
                await this.apiRequest(`/menu/${id}`, 'DELETE');
                this.menu = this.menu.filter(p => p._id !== id);
                await this.agregarActividad(`Platillo eliminado: ${platillo.nombre}`);
                this.cargarMenu();
                this.cargarDashboard();
            } catch (error) {
                alert('Error al eliminar el platillo');
            }
        }
    }

    // ===== GESTIÓN DE MESAS =====
    
    cargarMesas() {
        const container = document.getElementById('lista-mesas');
        
        if (this.mesas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No hay mesas registradas</p>';
            return;
        }

        const puedeEliminar = this.usuario.rol === 'administrador';

        container.innerHTML = this.mesas.map(mesa => `
            <div class="mesa-card ${mesa.estado}">
                <div class="mesa-numero" onclick="app.toggleMesa('${mesa._id}')">Mesa ${mesa.numero}</div>
                <span class="mesa-estado ${mesa.estado}">${mesa.estado === 'disponible' ? 'Disponible' : 'Ocupada'}</span>
                <p>Capacidad: ${mesa.capacidad} personas</p>
                <div class="mesa-actions" style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn-info" onclick="event.stopPropagation(); app.verHistorialMesa('${mesa._id}', ${mesa.numero})" style="flex: 1; font-size: 0.85em;">📋 Historial</button>
                    ${puedeEliminar ? `<button class="btn-danger" onclick="event.stopPropagation(); app.eliminarMesa('${mesa._id}')" style="flex: 1; font-size: 0.85em;">🗑️ Eliminar</button>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    verHistorialMesa(mesaId, mesaNumero) {
        // Buscar todos los pedidos/facturas de esta mesa
        const historial = this.facturas
            .filter(f => f.mesaId === mesaId || f.mesaNumero === mesaNumero || f.numeroMesa === mesaNumero)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 20);
        
        const pedidosActivos = this.pedidos
            .filter(p => (p.mesaId === mesaId || p.mesaNumero === mesaNumero) && p.estado !== 'cancelado')
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        let contenido = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4 style="margin-bottom: 15px;">🔄 Pedidos Activos</h4>
        `;
        
        if (pedidosActivos.length > 0) {
            contenido += pedidosActivos.map(p => `
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${p.estado === 'pendiente' ? '#f39c12' : p.estado === 'preparando' ? '#3498db' : p.estado === 'listo' ? '#27ae60' : '#95a5a6'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>${new Date(p.fecha).toLocaleString('es-ES')}</strong>
                        <span class="pedido-estado ${p.estado}" style="font-size: 0.85em;">${this.obtenerTextoEstado(p.estado)}</span>
                    </div>
                    <div style="font-size: 0.9em;">
                        ${p.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ')}
                    </div>
                    <div style="text-align: right; font-weight: bold; color: var(--primary-color);">$${p.total.toFixed(2)}</div>
                </div>
            `).join('');
        } else {
            contenido += '<p style="color: #7f8c8d; text-align: center;">Sin pedidos activos</p>';
        }
        
        contenido += `<h4 style="margin: 20px 0 15px;">📜 Historial de Facturas</h4>`;
        
        if (historial.length > 0) {
            const totalHistorico = historial.reduce((sum, f) => sum + (f.total || 0), 0);
            contenido += `<p style="background: #e8f5e9; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <strong>Total histórico:</strong> $${totalHistorico.toFixed(2)} en ${historial.length} visitas
            </p>`;
            
            contenido += historial.map(f => `
                <div style="background: #fff; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>${new Date(f.fecha).toLocaleString('es-ES')}</strong>
                        <span style="color: #27ae60;">✓ Pagado</span>
                    </div>
                    <div style="font-size: 0.9em; color: #666;">
                        ${(f.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || 'Sin detalles'}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                        <small style="color: #666;">Método: ${f.metodoPago || 'N/A'}</small>
                        <strong style="color: var(--primary-color);">$${(f.total || 0).toFixed(2)}</strong>
                    </div>
                </div>
            `).join('');
        } else {
            contenido += '<p style="color: #7f8c8d; text-align: center;">Sin historial de facturas</p>';
        }
        
        contenido += '</div>';
        
        // Mostrar en modal
        this.mostrarModalInfo(`📋 Historial Mesa ${mesaNumero}`, contenido);
    }
    
    mostrarModalInfo(titulo, contenido) {
        // Crear modal dinámico
        let modal = document.getElementById('modal-info-dinamico');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-info-dinamico';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <h3 id="modal-info-titulo"></h3>
                    <div id="modal-info-contenido" style="margin: 20px 0;"></div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-info-dinamico').classList.remove('active')">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('modal-info-titulo').textContent = titulo;
        document.getElementById('modal-info-contenido').innerHTML = contenido;
        modal.classList.add('active');
    }

    async guardarMesa() {
        const mesa = {
            numero: parseInt(document.getElementById('mesa-numero').value),
            capacidad: parseInt(document.getElementById('mesa-capacidad').value),
            estado: 'disponible'
        };

        try {
            const nueva = await this.apiRequest('/mesas', 'POST', mesa);
            this.mesas.push(nueva);
            await this.agregarActividad(`Nueva mesa agregada: Mesa ${mesa.numero}`);
            document.getElementById('modal-mesa').classList.remove('active');
            this.cargarMesas();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar la mesa');
        }
    }

    async toggleMesa(id) {
        const mesa = this.mesas.find(m => m._id === id);
        mesa.estado = mesa.estado === 'disponible' ? 'ocupada' : 'disponible';
        
        try {
            await this.apiRequest(`/mesas/${id}`, 'PUT', mesa);
            await this.agregarActividad(`Mesa ${mesa.numero} ahora está ${mesa.estado}`);
            this.cargarMesas();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al cambiar estado de la mesa');
        }
    }

    async eliminarMesa(id) {
        if (this.usuario.rol !== 'administrador') return;
        
        if (confirm('¿Estás seguro de eliminar esta mesa?')) {
            try {
                const mesa = this.mesas.find(m => m._id === id);
                await this.apiRequest(`/mesas/${id}`, 'DELETE');
                this.mesas = this.mesas.filter(m => m._id !== id);
                await this.agregarActividad(`Mesa ${mesa.numero} eliminada`);
                this.cargarMesas();
                this.cargarDashboard();
            } catch (error) {
                alert('Error al eliminar la mesa');
            }
        }
    }

    // ===== GESTIÓN DE PEDIDOS =====
    
    cargarModalPedido() {
        const selectMesa = document.getElementById('pedido-mesa');
        // Mostrar todas las mesas (disponibles primero, luego ocupadas)
        const mesasOrdenadas = [...this.mesas].sort((a, b) => {
            if (a.estado === 'disponible' && b.estado !== 'disponible') return -1;
            if (a.estado !== 'disponible' && b.estado === 'disponible') return 1;
            return a.numero - b.numero;
        });
        
        selectMesa.innerHTML = mesasOrdenadas.length > 0 
            ? mesasOrdenadas.map(m => `<option value="${m._id}">Mesa ${m.numero} ${m.estado === 'ocupada' ? '(ocupada)' : ''}</option>`).join('')
            : '<option value="">No hay mesas registradas</option>';

        // Configurar filtros de categoría
        this.categoriaFiltro = '';
        this.setupFiltrosCategorias();
        this.renderizarMenuPedido();
        this.actualizarItemsSeleccionados();
    }

    setupFiltrosCategorias() {
        document.querySelectorAll('.filtro-cat').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filtro-cat').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.categoriaFiltro = btn.dataset.categoria;
                this.renderizarMenuPedido();
            });
        });
    }

    renderizarMenuPedido() {
        const menuContainer = document.getElementById('menu-pedido');
        
        // Filtrar y ordenar platillos
        let platillosFiltrados = this.menu.filter(p => p.disponible !== false);
        
        if (this.categoriaFiltro) {
            platillosFiltrados = platillosFiltrados.filter(p => p.categoria === this.categoriaFiltro);
        }
        
        // Ordenar por categoría y luego por nombre
        const ordenCategorias = { 'Entradas': 1, 'Platos Fuertes': 2, 'Postres': 3, 'Bebidas': 4 };
        platillosFiltrados.sort((a, b) => {
            const ordenA = ordenCategorias[a.categoria] || 99;
            const ordenB = ordenCategorias[b.categoria] || 99;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return a.nombre.localeCompare(b.nombre);
        });

        if (platillosFiltrados.length === 0) {
            menuContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No hay platillos en esta categoría</p>';
            return;
        }

        menuContainer.innerHTML = platillosFiltrados.map(platillo => `
            <div class="menu-pedido-item" onclick="app.agregarItemPedido('${platillo._id}')">
                ${platillo.imagen ? `<img src="${platillo.imagen}" alt="${platillo.nombre}" class="menu-pedido-thumb">` : ''}
                <h4>${platillo.nombre}</h4>
                <div class="precio">$${platillo.precio.toFixed(2)}</div>
            </div>
        `).join('');
    }

    agregarItemPedido(platilloId) {
        const platillo = this.menu.find(p => p._id === platilloId);
        const itemExistente = this.pedidoActual.find(i => i.platilloId === platilloId && !i.comentario);

        if (itemExistente) {
            itemExistente.cantidad++;
        } else {
            this.pedidoActual.push({
                platilloId,
                nombre: platillo.nombre,
                precio: platillo.precio,
                cantidad: 1,
                comentario: ''
            });
        }

        this.actualizarItemsSeleccionados();
    }

    actualizarItemsSeleccionados() {
        const container = document.getElementById('items-seleccionados');
        
        if (this.pedidoActual.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay items seleccionados</p>';
            document.getElementById('pedido-total').textContent = '0.00';
            return;
        }

        container.innerHTML = this.pedidoActual.map((item, index) => `
            <div class="item-seleccionado">
                <div class="item-info">
                    <span>${item.nombre}</span>
                    <div class="item-cantidad">
                        <button onclick="app.cambiarCantidad(${index}, -1)">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="app.cambiarCantidad(${index}, 1)">+</button>
                        <span style="margin-left: 10px; font-weight: bold;">$${(item.precio * item.cantidad).toFixed(2)}</span>
                    </div>
                </div>
                <div class="item-comentario">
                    <input type="text" 
                           placeholder="Ej: sin cebolla, extra picante..." 
                           value="${item.comentario || ''}"
                           onchange="app.actualizarComentario(${index}, this.value)"
                           class="input-comentario">
                </div>
            </div>
        `).join('');

        const total = this.pedidoActual.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        document.getElementById('pedido-total').textContent = total.toFixed(2);
    }

    cambiarCantidad(index, cambio) {
        this.pedidoActual[index].cantidad += cambio;
        
        if (this.pedidoActual[index].cantidad <= 0) {
            this.pedidoActual.splice(index, 1);
        }
        
        this.actualizarItemsSeleccionados();
    }

    actualizarComentario(index, comentario) {
        this.pedidoActual[index].comentario = comentario;
    }

    async guardarPedido() {
        const mesaId = document.getElementById('pedido-mesa').value;
        
        if (!mesaId || this.pedidoActual.length === 0) {
            alert('Debes seleccionar una mesa y al menos un platillo');
            return;
        }

        const mesa = this.mesas.find(m => m._id === mesaId);
        const total = this.pedidoActual.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

        const pedido = {
            mesaId,
            mesaNumero: mesa.numero,
            items: [...this.pedidoActual],
            total,
            estado: 'pendiente',
            fecha: new Date().toISOString()
        };

        try {
            const nuevo = await this.apiRequest('/pedidos', 'POST', pedido);
            // No agregar localmente - el WebSocket lo hará
            // Pero sí agregarlo si no hay WebSocket activo
            if (!this.socket?.connected) {
                this.pedidos.push(nuevo);
            }
            
            mesa.estado = 'ocupada';
            await this.apiRequest(`/mesas/${mesaId}`, 'PUT', mesa);
            
            await this.agregarActividad(`Nuevo pedido para Mesa ${mesa.numero} - $${total.toFixed(2)}`);
            
            document.getElementById('modal-pedido').classList.remove('active');
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar el pedido');
        }
    }

    cargarPedidos() {
        const container = document.getElementById('lista-pedidos');
        // Mostrar todos los pedidos activos (no cancelados)
        const pedidosActivos = this.pedidos
            .filter(p => p.estado !== 'cancelado')
            .sort((a, b) => {
                // Ordenar: pendiente, preparando, listo, entregado
                const orden = { 'pendiente': 0, 'preparando': 1, 'listo': 2, 'entregado': 3 };
                if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
                return new Date(a.fecha) - new Date(b.fecha);
            });
        
        if (pedidosActivos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay pedidos activos</p>';
            return;
        }

        container.innerHTML = pedidosActivos.map(pedido => this.renderPedidoCard(pedido)).join('');
    }

    // Permisos por rol
    puedePreparar() {
        return this.usuario.rol === 'administrador' || this.usuario.rol === 'cocinero';
    }

    puedeEntregar() {
        return this.usuario.rol === 'administrador' || this.usuario.rol === 'mesero';
    }

    obtenerTextoEstado(estado) {
        const estados = {
            'pendiente': 'Pendiente',
            'preparando': 'En Preparación',
            'listo': 'Listo',
            'entregado': 'Entregado'
        };
        return estados[estado] || estado;
    }

    async cambiarEstadoPedido(pedidoId, nuevoEstado) {
        const pedido = this.pedidos.find(p => p._id === pedidoId);
        pedido.estado = nuevoEstado;
        
        try {
            await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', pedido);
            await this.agregarActividad(`Pedido Mesa ${pedido.mesaNumero} - ${this.obtenerTextoEstado(nuevoEstado)}`);
            this.cargarPedidos();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al cambiar estado del pedido');
        }
    }

    async entregarPedido(pedidoId) {
        const pedido = this.pedidos.find(p => p._id === pedidoId);
        pedido.estado = 'entregado';
        
        try {
            await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', pedido);
            
            await this.agregarActividad(`Pedido entregado - Mesa ${pedido.mesaNumero || pedido.numeroMesa}`);
            
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
            this.cargarMesasParaCobrar();
        } catch (error) {
            alert('Error al entregar el pedido');
        }
    }

    // ============= COBRAR MESA =============
    
    cargarMesasParaCobrar() {
        const container = document.getElementById('mesas-para-cobrar');
        if (!container) return;
        
        // Obtener pedidos entregados agrupados por mesa
        const pedidosEntregados = this.pedidos.filter(p => p.estado === 'entregado');
        
        // Agrupar por mesa
        const mesasConPedidos = {};
        pedidosEntregados.forEach(pedido => {
            const mesaNum = pedido.mesaNumero || pedido.numeroMesa;
            if (!mesasConPedidos[mesaNum]) {
                mesasConPedidos[mesaNum] = {
                    mesaNumero: mesaNum,
                    mesaId: pedido.mesaId,
                    pedidos: []
                };
            }
            mesasConPedidos[mesaNum].pedidos.push(pedido);
        });
        
        const mesas = Object.values(mesasConPedidos);
        
        if (mesas.length === 0) {
            container.innerHTML = `
                <div class="sin-mesas-cobrar" style="grid-column: 1/-1;">
                    <div class="icono">✅</div>
                    <h2>No hay mesas pendientes de cobro</h2>
                    <p>Todas las mesas han sido cobradas</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = mesas.map(mesa => {
            const todosItems = mesa.pedidos.flatMap(p => p.items);
            const total = mesa.pedidos.reduce((sum, p) => sum + p.total, 0);
            
            return `
                <div class="mesa-cobrar-card">
                    <div class="mesa-header">
                        <span class="mesa-numero">🪑 Mesa ${mesa.mesaNumero}</span>
                        <span class="pedidos-count">${mesa.pedidos.length} pedido(s)</span>
                    </div>
                    <div class="items-preview">
                        ${todosItems.slice(0, 5).map(item => `
                            <div class="item-preview">
                                <span>${item.cantidad}x ${item.nombre}</span>
                                <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                            </div>
                        `).join('')}
                        ${todosItems.length > 5 ? `<div class="item-preview"><span>... y ${todosItems.length - 5} más</span></div>` : ''}
                    </div>
                    <div class="total-mesa">Total: $${total.toFixed(2)}</div>
                    <div class="mesa-cobrar-actions">
                        <button class="btn-cobrar-mesa" onclick="app.abrirModalCobrar(${mesa.mesaNumero})">
                            💵 Cobrar
                        </button>
                        <button class="btn-dividir-mesa" onclick="app.abrirDivisionCuentaPorNumero(${mesa.mesaNumero})">
                            ➗ Dividir
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    abrirDivisionCuentaPorNumero(mesaNumero) {
        const mesa = this.mesas.find(m => m.numero === mesaNumero);
        if (mesa) {
            this.abrirDivisionCuenta(mesa._id);
        }
    }

    abrirModalCobrar(mesaNumero) {
        const pedidosMesa = this.pedidos.filter(p => 
            (p.mesaNumero === mesaNumero || p.numeroMesa === mesaNumero) && 
            p.estado === 'entregado'
        );
        
        if (pedidosMesa.length === 0) {
            alert('No hay pedidos para cobrar en esta mesa');
            return;
        }
        
        this.mesaACobrar = {
            mesaNumero,
            pedidos: pedidosMesa
        };
        
        const todosItems = pedidosMesa.flatMap(p => p.items);
        const total = pedidosMesa.reduce((sum, p) => sum + p.total, 0);
        
        document.getElementById('cobrar-mesa-numero').textContent = mesaNumero;
        
        document.getElementById('cuenta-items').innerHTML = todosItems.map(item => `
            <div class="cuenta-item">
                <span class="item-cantidad">${item.cantidad}x</span>
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
            ${item.comentario ? `<div class="cuenta-item-comentario">📝 ${item.comentario}</div>` : ''}
        `).join('');
        
        document.getElementById('cuenta-total').textContent = `$${total.toFixed(2)}`
        
        document.getElementById('modal-cobrar').classList.add('active');
    }

    // Cobrar un pedido individual desde el botón en la tarjeta
    cobrarPedido(pedidoId) {
        const pedido = this.pedidos.find(p => p._id === pedidoId);
        if (!pedido) {
            alert('Pedido no encontrado');
            return;
        }
        
        // Buscar número de mesa de varias formas
        let mesaNumero = pedido.mesaNumero || pedido.numeroMesa;
        if (!mesaNumero && pedido.mesaId) {
            const mesa = this.mesas.find(m => m._id === pedido.mesaId);
            if (mesa) mesaNumero = mesa.numero;
        }
        mesaNumero = mesaNumero || 'N/A';
        
        this.mesaACobrar = {
            mesaNumero,
            pedidos: [pedido]
        };
        
        const total = pedido.total;
        
        document.getElementById('cobrar-mesa-numero').textContent = mesaNumero;
        
        document.getElementById('cuenta-items').innerHTML = pedido.items.map(item => `
            <div class="cuenta-item">
                <span class="item-cantidad">${item.cantidad}x</span>
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
            ${item.comentario ? `<div class="cuenta-item-comentario">📝 ${item.comentario}</div>` : ''}
        `).join('');
        
        document.getElementById('cuenta-total').textContent = `$${total.toFixed(2)}`
        
        document.getElementById('modal-cobrar').classList.add('active');
    }

    async procesarPago() {
        if (!this.mesaACobrar) return;
        
        const metodoPago = document.getElementById('metodo-pago').value;
        const pedidos = this.mesaACobrar.pedidos;
        const todosItems = pedidos.flatMap(p => p.items);
        const total = pedidos.reduce((sum, p) => sum + p.total, 0);
        
        // Crear factura
        const subtotal = total;
        const impuesto = 0;
        const factura = {
            numeroFactura: `F-${Date.now()}`,
            numeroMesa: this.mesaACobrar.mesaNumero,
            mesaNumero: this.mesaACobrar.mesaNumero,
            items: todosItems,
            subtotal,
            impuesto,
            total,
            metodoPago,
            fecha: new Date().toISOString()
        };
        
        try {
            // Guardar factura
            const nuevaFactura = await this.apiRequest('/facturas', 'POST', factura);
            this.facturas.push(nuevaFactura);
            
            // Eliminar pedidos cobrados
            for (const pedido of pedidos) {
                await this.apiRequest(`/pedidos/${pedido._id}`, 'DELETE');
                this.pedidos = this.pedidos.filter(p => p._id !== pedido._id);
            }
            
            // Liberar mesa
            const mesa = this.mesas.find(m => 
                m.numero === this.mesaACobrar.mesaNumero || 
                m._id === pedidos[0]?.mesaId
            );
            if (mesa) {
                mesa.estado = 'disponible';
                await this.apiRequest(`/mesas/${mesa._id}`, 'PUT', mesa);
            }
            
            await this.agregarActividad(`Cobro Mesa ${this.mesaACobrar.mesaNumero} - $${total.toFixed(2)} (${metodoPago})`);
            
            document.getElementById('modal-cobrar').classList.remove('active');
            
            // Preguntar si desea imprimir ticket
            if (confirm(`✅ Pago procesado exitosamente\n\nTotal: $${total.toFixed(2)}\nMétodo: ${metodoPago}\n\n¿Desea imprimir el ticket?`)) {
                this.imprimirTicket(nuevaFactura);
            }
            
            this.mesaACobrar = null;
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
            this.cargarMesasParaCobrar();
            if (this.usuario.rol === 'administrador') this.cargarFacturacion();
        } catch (error) {
            alert('Error al procesar el pago');
            console.error(error);
        }
    }
    
    imprimirTicket(factura) {
        const fecha = new Date(factura.fecha).toLocaleString('es-ES');
        const items = factura.items || [];
        
        const ticketHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket - ${factura.numeroFactura}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Courier New', monospace; 
                        width: 300px; 
                        padding: 20px;
                        font-size: 12px;
                    }
                    .ticket-header { text-align: center; margin-bottom: 15px; }
                    .ticket-header h1 { font-size: 18px; margin-bottom: 5px; }
                    .ticket-header p { font-size: 10px; color: #666; }
                    .ticket-divider { 
                        border-top: 1px dashed #000; 
                        margin: 10px 0; 
                    }
                    .ticket-info { margin-bottom: 10px; }
                    .ticket-info p { display: flex; justify-content: space-between; }
                    .ticket-items { margin: 15px 0; }
                    .ticket-item { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 5px 0;
                    }
                    .ticket-item-name { flex: 1; }
                    .ticket-total { 
                        font-size: 16px; 
                        font-weight: bold; 
                        text-align: right;
                        margin: 15px 0;
                    }
                    .ticket-footer { 
                        text-align: center; 
                        margin-top: 20px;
                        font-size: 10px;
                    }
                    @media print {
                        body { width: 80mm; }
                    }
                </style>
            </head>
            <body>
                <div class="ticket-header">
                    <h1>🍽️ RESTAURANTE</h1>
                    <p>Sistema de Gestión</p>
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-info">
                    <p><span>Ticket:</span> <span>${factura.numeroFactura}</span></p>
                    <p><span>Fecha:</span> <span>${fecha}</span></p>
                    <p><span>Mesa:</span> <span>${factura.mesaNumero || factura.numeroMesa || 'N/A'}</span></p>
                    <p><span>Método:</span> <span>${factura.metodoPago}</span></p>
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-items">
                    ${items.map(item => `
                        <div class="ticket-item">
                            <span class="ticket-item-name">${item.cantidad}x ${item.nombre}</span>
                            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-total">
                    TOTAL: $${(factura.total || 0).toFixed(2)}
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-footer">
                    <p>¡Gracias por su visita!</p>
                    <p>Vuelva pronto</p>
                </div>
            </body>
            </html>
        `;
        
        const ventana = window.open('', '_blank', 'width=350,height=500');
        ventana.document.write(ticketHTML);
        ventana.document.close();
        
        setTimeout(() => {
            ventana.print();
        }, 250);
    }

    // ===== DIVISIÓN DE CUENTA =====
    
    divisionData = {
        mesa: null,
        pedidos: [],
        numPersonas: 2,
        pagosProcesados: []
    };

    abrirDivisionCuenta(mesaId) {
        const mesa = this.mesas.find(m => m._id === mesaId);
        // Buscar pedidos entregados de esta mesa (igual que en cobrar)
        const pedidosMesa = this.pedidos.filter(p => 
            (p.mesaId === mesaId || p.mesaNumero === mesa?.numero || p.numeroMesa === mesa?.numero) && 
            p.estado === 'entregado'
        );
        
        if (pedidosMesa.length === 0) {
            alert('No hay pedidos para dividir en esta mesa. El pedido debe estar entregado.');
            return;
        }
        
        // Combinar todos los items de todos los pedidos
        const todosItems = pedidosMesa.flatMap(p => p.items || []);
        const total = todosItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        
        this.divisionData.mesa = mesa;
        this.divisionData.pedidos = pedidosMesa;
        this.divisionData.items = todosItems;
        this.divisionData.total = total;
        this.divisionData.numPersonas = 2;
        this.divisionData.pagosProcesados = [];
        
        document.getElementById('division-mesa-numero').textContent = mesa.numero;
        document.getElementById('division-num-personas').textContent = '2';
        
        this.actualizarDivision();
        document.getElementById('modal-division').classList.add('active');
    }

    cerrarModalDivision() {
        document.getElementById('modal-division').classList.remove('active');
    }

    cambiarPersonas(delta) {
        const nuevaCantidad = this.divisionData.numPersonas + delta;
        if (nuevaCantidad >= 2 && nuevaCantidad <= 10) {
            this.divisionData.numPersonas = nuevaCantidad;
            document.getElementById('division-num-personas').textContent = nuevaCantidad;
            this.actualizarDivision();
        }
    }

    actualizarDivision() {
        const items = this.divisionData.items;
        const total = this.divisionData.total;
        const numPersonas = this.divisionData.numPersonas;
        
        // Mostrar items
        const itemsContainer = document.getElementById('division-items');
        itemsContainer.innerHTML = items.map(item => `
            <div class="division-item">
                <span>${item.cantidad}x ${item.nombre}</span>
                <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
        `).join('');
        
        // Calcular totales
        const porPersona = total / numPersonas;
        
        document.getElementById('division-total').textContent = `$${total.toFixed(2)}`;
        document.getElementById('division-por-persona').textContent = `$${porPersona.toFixed(2)}`;
        
        // Mostrar desglose por persona
        const desgloseContainer = document.getElementById('division-desglose');
        let desgloseHTML = '';
        
        for (let i = 1; i <= numPersonas; i++) {
            const pagado = this.divisionData.pagosProcesados.includes(i);
            desgloseHTML += `
                <div class="persona-card ${pagado ? 'pagado' : ''}">
                    <h4>👤 Persona ${i}</h4>
                    <div class="monto">$${porPersona.toFixed(2)}</div>
                    ${pagado 
                        ? '<p style="color: green; margin-top: 10px;">✅ Pagado</p>' 
                        : `<button class="btn-primary" onclick="app.pagarPersona(${i}, ${porPersona.toFixed(2)})">💳 Pagar</button>`
                    }
                </div>
            `;
        }
        desgloseContainer.innerHTML = desgloseHTML;
    }

    async pagarPersona(numeroPersona, monto) {
        const metodo = prompt('Método de pago (efectivo/tarjeta):', 'efectivo');
        if (!metodo) return;
        
        this.divisionData.pagosProcesados.push(numeroPersona);
        this.actualizarDivision();
        
        // Verificar si todos pagaron
        if (this.divisionData.pagosProcesados.length === this.divisionData.numPersonas) {
            await this.finalizarDivision();
        }
    }

    async procesarDivision() {
        const pendientes = this.divisionData.numPersonas - this.divisionData.pagosProcesados.length;
        
        if (pendientes > 0) {
            if (!confirm(`Aún faltan ${pendientes} persona(s) por pagar. ¿Procesar todos los pagos restantes?`)) {
                return;
            }
            
            // Marcar todos como pagados
            for (let i = 1; i <= this.divisionData.numPersonas; i++) {
                if (!this.divisionData.pagosProcesados.includes(i)) {
                    this.divisionData.pagosProcesados.push(i);
                }
            }
        }
        
        await this.finalizarDivision();
    }

    async finalizarDivision() {
        try {
            const mesa = this.divisionData.mesa;
            const pedidos = this.divisionData.pedidos;
            const items = this.divisionData.items;
            const total = this.divisionData.total;
            const numPersonas = this.divisionData.numPersonas;
            const porPersona = total / numPersonas;
            
            // Crear factura con nota de división
            const factura = {
                numeroFactura: `DIV-${Date.now()}`,
                mesaNumero: mesa.numero,
                numeroMesa: mesa.numero,
                items: items,
                subtotal: total,
                impuesto: 0,
                total: total,
                metodoPago: `Dividido entre ${numPersonas} personas ($${porPersona.toFixed(2)} c/u)`,
                fecha: new Date().toISOString()
            };
            
            await this.apiRequest('/facturas', 'POST', factura);
            
            // Actualizar mesa
            mesa.estado = 'disponible';
            await this.apiRequest(`/mesas/${mesa._id}`, 'PUT', mesa);
            
            // Eliminar todos los pedidos de la mesa
            for (const pedido of pedidos) {
                await this.apiRequest(`/pedidos/${pedido._id}`, 'DELETE');
            }
            
            // Registrar actividad
            await this.agregarActividad(`Cuenta dividida - Mesa ${mesa.numero} - ${numPersonas} personas - $${total.toFixed(2)}`);
            
            this.cerrarModalDivision();
            
            alert(`✅ Cuenta dividida exitosamente!\nTotal: $${total.toFixed(2)}\nPor persona: $${porPersona.toFixed(2)}`);
            
            // Preguntar si imprimir
            if (confirm('¿Desea imprimir el ticket?')) {
                this.imprimirTicket(factura);
            }
            
            // Recargar datos
            await this.cargarDatos();
            this.cargarDashboard();
            
        } catch (error) {
            alert('Error al procesar la división');
            console.error(error);
        }
    }

    async cancelarPedido(pedidoId) {
        if (confirm('¿Estás seguro de cancelar este pedido?')) {
            try {
                const pedido = this.pedidos.find(p => p._id === pedidoId);
                const mesa = this.mesas.find(m => m._id === pedido.mesaId);
                
                if (mesa) {
                    mesa.estado = 'disponible';
                    await this.apiRequest(`/mesas/${mesa._id}`, 'PUT', mesa);
                }
                
                await this.apiRequest(`/pedidos/${pedidoId}`, 'DELETE');
                this.pedidos = this.pedidos.filter(p => p._id !== pedidoId);
                
                await this.agregarActividad(`Pedido cancelado - Mesa ${pedido.mesaNumero}`);
                
                this.cargarPedidos();
                this.cargarMesas();
                this.cargarDashboard();
            } catch (error) {
                alert('Error al cancelar el pedido');
            }
        }
    }

    // ===== REPORTES (Solo Admin) =====
    
    cargarReportes() {
        if (this.usuario.rol !== 'administrador') return;
        
        // Configurar evento del botón (solo una vez)
        if (!this._reportesInit) {
            document.getElementById('btn-generar-reporte')?.addEventListener('click', () => this.generarReporte());
            this._reportesInit = true;
        }
        
        // Cargar reporte inicial
        this.generarReporte();
    }
    
    generarReporte() {
        const periodo = document.getElementById('reporte-periodo').value;
        const { inicio, fin } = this.obtenerRangoFechas(periodo);
        
        // Filtrar facturas por período
        const facturasDelPeriodo = this.facturas.filter(f => {
            const fecha = new Date(f.fecha);
            return fecha >= inicio && fecha <= fin;
        });
        
        // Calcular estadísticas
        const totalVentas = facturasDelPeriodo.reduce((sum, f) => sum + (f.total || 0), 0);
        const pedidosCompletados = facturasDelPeriodo.length;
        const ticketPromedio = pedidosCompletados > 0 ? totalVentas / pedidosCompletados : 0;
        
        // Mostrar resumen
        document.getElementById('reporte-total-ventas').textContent = `$${totalVentas.toFixed(2)}`;
        document.getElementById('reporte-pedidos-completados').textContent = pedidosCompletados;
        document.getElementById('reporte-ticket-promedio').textContent = `$${ticketPromedio.toFixed(2)}`;
        
        // Platillos más vendidos
        this.mostrarPlatillosTop(facturasDelPeriodo);
        
        // Mesas más activas
        this.mostrarMesasTop(facturasDelPeriodo);
        
        // Ventas por día
        this.mostrarVentasPorDia(facturasDelPeriodo);
        
        // Horas pico
        this.mostrarHorasPico(facturasDelPeriodo);
        
        // Ventas por categoría
        this.mostrarVentasPorCategoria(facturasDelPeriodo);
    }
    
    obtenerRangoFechas(periodo) {
        const ahora = new Date();
        let inicio, fin;
        
        switch(periodo) {
            case 'hoy':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
                fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
                break;
            case 'semana':
                // Semana empieza el lunes (estándar en Perú)
                const diaSemana = ahora.getDay();
                const diasDesdelunes = diaSemana === 0 ? 6 : diaSemana - 1;
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasDesdelunes);
                inicio.setHours(0, 0, 0, 0);
                fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
                break;
            case 'mes':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'anio':
                inicio = new Date(ahora.getFullYear(), 0, 1);
                fin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
                break;
            default:
                inicio = new Date(0);
                fin = ahora;
        }
        
        return { inicio, fin };
    }
    
    mostrarPlatillosTop(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            (f.items || []).forEach(item => {
                const nombre = item.nombre || 'Sin nombre';
                if (!conteo[nombre]) {
                    conteo[nombre] = { cantidad: 0, total: 0 };
                }
                conteo[nombre].cantidad += item.cantidad || 1;
                conteo[nombre].total += (item.precio || 0) * (item.cantidad || 1);
            });
        });
        
        const ordenado = Object.entries(conteo)
            .sort((a, b) => b[1].cantidad - a[1].cantidad)
            .slice(0, 5);
        
        const maxCantidad = ordenado[0]?.[1].cantidad || 1;
        
        document.getElementById('reporte-platillos-top').innerHTML = ordenado.length > 0 
            ? ordenado.map(([nombre, data], i) => `
                <div class="reporte-item">
                    <div style="display: flex; align-items: center; flex: 1;">
                        <span class="reporte-item-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
                        <div style="flex: 1;">
                            <div class="reporte-item-name">${nombre}</div>
                            <div class="reporte-item-bar" style="width: ${(data.cantidad / maxCantidad * 100)}%"></div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">${data.cantidad} uds</div>
                        <small style="color: #666;">$${data.total.toFixed(2)}</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarMesasTop(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            const mesa = f.mesaNumero || f.numeroMesa || 'N/A';
            if (!conteo[mesa]) {
                conteo[mesa] = { pedidos: 0, total: 0 };
            }
            conteo[mesa].pedidos++;
            conteo[mesa].total += f.total || 0;
        });
        
        const ordenado = Object.entries(conteo)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);
        
        document.getElementById('reporte-mesas-top').innerHTML = ordenado.length > 0
            ? ordenado.map(([mesa, data], i) => `
                <div class="reporte-item">
                    <div style="display: flex; align-items: center;">
                        <span class="reporte-item-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
                        <span class="reporte-item-name">Mesa ${mesa}</span>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">$${data.total.toFixed(2)}</div>
                        <small style="color: #666;">${data.pedidos} pedidos</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarVentasPorDia(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            const fecha = new Date(f.fecha);
            const clave = fecha.toISOString().slice(0, 10); // YYYY-MM-DD para ordenar
            const dia = fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            if (!conteo[clave]) {
                conteo[clave] = { label: dia, total: 0 };
            }
            conteo[clave].total += f.total || 0;
        });
        
        const ordenado = Object.entries(conteo)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-7);
        const maxVenta = Math.max(...ordenado.map(([_, v]) => v.total)) || 1;
        
        document.getElementById('reporte-ventas-dia').innerHTML = ordenado.length > 0
            ? ordenado.map(([_, data]) => `
                <div class="reporte-item">
                    <span class="reporte-item-name">${data.label}</span>
                    <div style="flex: 1; margin: 0 15px;">
                        <div class="reporte-item-bar" style="width: ${(data.total / maxVenta * 100)}%"></div>
                    </div>
                    <span class="reporte-item-value">$${data.total.toFixed(2)}</span>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarHorasPico(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            const fecha = new Date(f.fecha);
            const hora = fecha.getHours();
            const rango = `${hora}:00 - ${hora + 1}:00`;
            if (!conteo[rango]) {
                conteo[rango] = { pedidos: 0, total: 0 };
            }
            conteo[rango].pedidos++;
            conteo[rango].total += f.total || 0;
        });
        
        const ordenado = Object.entries(conteo)
            .sort((a, b) => b[1].pedidos - a[1].pedidos)
            .slice(0, 5);
        
        const maxPedidos = ordenado[0]?.[1].pedidos || 1;
        
        document.getElementById('reporte-horas-pico').innerHTML = ordenado.length > 0
            ? ordenado.map(([hora, data], i) => `
                <div class="reporte-item">
                    <div style="display: flex; align-items: center; flex: 1;">
                        <span class="reporte-item-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
                        <div style="flex: 1;">
                            <div class="reporte-item-name">🕐 ${hora}</div>
                            <div class="reporte-item-bar" style="width: ${(data.pedidos / maxPedidos * 100)}%"></div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">${data.pedidos} pedidos</div>
                        <small style="color: #666;">$${data.total.toFixed(2)}</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarVentasPorCategoria(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            (f.items || []).forEach(item => {
                // Buscar categoría del platillo
                const platillo = this.menu.find(p => p.nombre === item.nombre);
                const categoria = platillo?.categoria || 'Otros';
                if (!conteo[categoria]) {
                    conteo[categoria] = 0;
                }
                conteo[categoria] += (item.precio || 0) * (item.cantidad || 1);
            });
        });
        
        const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        const total = ordenado.reduce((sum, [_, v]) => sum + v, 0) || 1;
        
        const iconos = {
            'Entradas': '🥗',
            'Platos Fuertes': '🍖',
            'Postres': '🍰',
            'Bebidas': '🥤',
            'Otros': '📦'
        };
        
        document.getElementById('reporte-categorias').innerHTML = ordenado.length > 0
            ? ordenado.map(([categoria, valor]) => `
                <div class="reporte-item">
                    <span class="reporte-item-name">${iconos[categoria] || '📦'} ${categoria}</span>
                    <div style="flex: 1; margin: 0 15px;">
                        <div class="reporte-item-bar" style="width: ${(valor / total * 100)}%"></div>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">$${valor.toFixed(2)}</div>
                        <small style="color: #666;">${(valor / total * 100).toFixed(1)}%</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }

    // ===== INVENTARIO (Solo Admin) =====
    
    cargarInventario() {
        if (this.usuario.rol !== 'administrador') return;
        
        // Mostrar alertas de stock bajo
        this.mostrarAlertasInventario();
        
        // Configurar filtros (solo una vez)
        if (!this._inventarioInit) {
            document.getElementById('filtro-inventario-categoria')?.addEventListener('change', () => this.renderizarInventario());
            document.getElementById('buscar-inventario')?.addEventListener('input', () => this.renderizarInventario());
            this._inventarioInit = true;
        }
        
        this.renderizarInventario();
    }
    
    mostrarAlertasInventario() {
        const alertas = this.inventario.filter(item => item.cantidad <= item.stockMinimo);
        const container = document.getElementById('inventario-alertas');
        
        if (alertas.length > 0) {
            container.innerHTML = `
                <div class="alerta-stock">
                    <strong>⚠️ Alerta de Stock Bajo (${alertas.length} items)</strong>
                    <div class="alertas-items">
                        ${alertas.map(item => `
                            <span class="alerta-item">
                                ${item.nombre}: ${item.cantidad} ${item.unidad} (mín: ${item.stockMinimo})
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    }
    
    renderizarInventario() {
        const container = document.getElementById('lista-inventario');
        const filtroCategoria = document.getElementById('filtro-inventario-categoria')?.value || '';
        const busqueda = document.getElementById('buscar-inventario')?.value.toLowerCase() || '';
        
        let items = this.inventario;
        
        if (filtroCategoria) {
            items = items.filter(i => i.categoria === filtroCategoria);
        }
        
        if (busqueda) {
            items = items.filter(i => i.nombre.toLowerCase().includes(busqueda));
        }
        
        if (items.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No hay items en el inventario</p>';
            return;
        }
        
        const iconosCategoria = {
            'Carnes': '🥩',
            'Verduras': '🥬',
            'Frutas': '🍎',
            'Granos': '🌾',
            'Lácteos': '🧀',
            'Bebidas': '🥤',
            'Condimentos': '🧂',
            'Otros': '📦'
        };
        
        container.innerHTML = items.map(item => {
            const stockBajo = item.cantidad <= item.stockMinimo;
            // Barra proporcional: 100% = 2x el mínimo (nivel óptimo)
            const nivelOptimo = item.stockMinimo * 2;
            const porcentajeStock = Math.min(100, (item.cantidad / nivelOptimo) * 100);
            const colorBarra = stockBajo ? 'bajo' : (item.cantidad >= nivelOptimo ? 'optimo' : '');
            
            return `
                <div class="inventario-card ${stockBajo ? 'stock-bajo' : ''}">
                    <div class="inventario-header">
                        <span class="inventario-icono">${iconosCategoria[item.categoria] || '📦'}</span>
                        <div class="inventario-info">
                            <h4>${item.nombre}</h4>
                            <small>${item.categoria}</small>
                        </div>
                    </div>
                    <div class="inventario-stock">
                        <div class="stock-cantidad">
                            <strong>${item.cantidad}</strong> ${item.unidad}
                        </div>
                        <div class="stock-barra-container">
                            <div class="stock-barra ${colorBarra}" style="width: ${porcentajeStock}%"></div>
                        </div>
                        <small>Mínimo: ${item.stockMinimo} ${item.unidad}</small>
                    </div>
                    ${item.costo > 0 ? `<div class="inventario-costo">Costo: $${item.costo.toFixed(2)}/${item.unidad}</div>` : ''}
                    <div class="inventario-actions">
                        <button class="btn-info" onclick="app.ajustarStock('${item._id}', 1)" title="+1">➕</button>
                        <button class="btn-secondary" onclick="app.ajustarStock('${item._id}', -1)" title="-1">➖</button>
                        <button class="btn-primary" onclick="app.ajustarStockPersonalizado('${item._id}')" title="Ajustar cantidad">🔢</button>
                        <button class="btn-primary" onclick="app.editarInventario('${item._id}')" title="Editar">✏️</button>
                        <button class="btn-danger" onclick="app.eliminarInventario('${item._id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async ajustarStock(id, cantidad) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;
        
        const nuevaCantidad = Math.max(0, item.cantidad + cantidad);
        
        try {
            await this.apiRequest(`/inventario/${id}`, 'PUT', { cantidad: nuevaCantidad });
            item.cantidad = nuevaCantidad;
            this.renderizarInventario();
            this.mostrarAlertasInventario();
        } catch (error) {
            alert('Error al ajustar stock');
        }
    }

    async ajustarStockPersonalizado(id) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;

        const input = prompt(`Ajustar stock de "${item.nombre}"\nActual: ${item.cantidad} ${item.unidad}\n\nIngresa la cantidad a agregar (o negativo para restar):`, '10');
        if (input === null) return;

        const cantidad = parseFloat(input);
        if (isNaN(cantidad)) {
            alert('Cantidad inválida');
            return;
        }

        const nuevaCantidad = Math.max(0, item.cantidad + cantidad);

        try {
            await this.apiRequest(`/inventario/${id}`, 'PUT', { cantidad: nuevaCantidad });
            const accion = cantidad >= 0 ? `+${cantidad}` : `${cantidad}`;
            await this.agregarActividad(`Stock ajustado: ${item.nombre} ${accion} ${item.unidad} (${item.cantidad} → ${nuevaCantidad})`);
            item.cantidad = nuevaCantidad;
            this.renderizarInventario();
            this.mostrarAlertasInventario();
        } catch (error) {
            alert('Error al ajustar stock');
        }
    }
    
    editarInventario(id) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;
        
        this.editandoInventarioId = id;
        document.getElementById('modal-inventario-titulo').textContent = 'Editar Item';
        document.getElementById('inventario-nombre').value = item.nombre;
        document.getElementById('inventario-categoria').value = item.categoria;
        document.getElementById('inventario-unidad').value = item.unidad;
        document.getElementById('inventario-cantidad').value = item.cantidad;
        document.getElementById('inventario-stock-minimo').value = item.stockMinimo;
        document.getElementById('inventario-costo').value = item.costo || 0;
        document.getElementById('modal-inventario').classList.add('active');
    }
    
    async guardarInventario() {
        const item = {
            nombre: document.getElementById('inventario-nombre').value,
            categoria: document.getElementById('inventario-categoria').value,
            unidad: document.getElementById('inventario-unidad').value,
            cantidad: parseFloat(document.getElementById('inventario-cantidad').value),
            stockMinimo: parseFloat(document.getElementById('inventario-stock-minimo').value),
            costo: parseFloat(document.getElementById('inventario-costo').value) || 0
        };
        
        try {
            if (this.editandoInventarioId) {
                const actualizado = await this.apiRequest(`/inventario/${this.editandoInventarioId}`, 'PUT', item);
                const index = this.inventario.findIndex(i => i._id === this.editandoInventarioId);
                this.inventario[index] = actualizado;
                await this.agregarActividad(`Inventario actualizado: ${item.nombre}`);
            } else {
                const nuevo = await this.apiRequest('/inventario', 'POST', item);
                this.inventario.push(nuevo);
                await this.agregarActividad(`Nuevo item de inventario: ${item.nombre}`);
            }
            
            document.getElementById('modal-inventario').classList.remove('active');
            this.renderizarInventario();
            this.mostrarAlertasInventario();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar el item');
        }
    }
    
    async eliminarInventario(id) {
        const item = this.inventario.find(i => i._id === id);
        if (confirm(`¿Eliminar "${item.nombre}" del inventario?`)) {
            try {
                await this.apiRequest(`/inventario/${id}`, 'DELETE');
                this.inventario = this.inventario.filter(i => i._id !== id);
                await this.agregarActividad(`Item eliminado del inventario: ${item.nombre}`);
                this.renderizarInventario();
                this.mostrarAlertasInventario();
            } catch (error) {
                alert('Error al eliminar el item');
            }
        }
    }

    // ===== FACTURACIÓN (Solo Admin) =====
    
    cargarFacturacion() {
        if (this.usuario.rol !== 'administrador') return;
        
        const hoy = new Date();
        const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        const totalDia = this.facturas
            .filter(f => new Date(f.fecha) >= inicioDia)
            .reduce((sum, f) => sum + f.total, 0);

        const totalSemana = this.facturas
            .filter(f => new Date(f.fecha) >= inicioSemana)
            .reduce((sum, f) => sum + f.total, 0);

        const totalMes = this.facturas
            .filter(f => new Date(f.fecha) >= inicioMes)
            .reduce((sum, f) => sum + f.total, 0);

        document.getElementById('total-dia').textContent = `$${totalDia.toFixed(2)}`;
        document.getElementById('total-semana').textContent = `$${totalSemana.toFixed(2)}`;
        document.getElementById('total-mes').textContent = `$${totalMes.toFixed(2)}`;

        const container = document.getElementById('lista-facturas');
        
        if (this.facturas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay facturas registradas</p>';
            return;
        }

        const facturasRecientes = [...this.facturas].reverse().slice(0, 50);
        
        container.innerHTML = facturasRecientes.map(factura => `
            <div class="factura-item">
                <div>
                    <strong>Mesa ${factura.mesaNumero || factura.numeroMesa}</strong> - 
                    ${new Date(factura.fecha).toLocaleString('es-ES')}
                    <small style="color: #666; margin-left: 10px;">${factura.metodoPago || ''}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: var(--success-color);">$${factura.total.toFixed(2)}</span>
                    <button class="btn-info" onclick="app.imprimirTicket(${JSON.stringify(factura).replace(/"/g, '&quot;')})" style="padding: 5px 10px; font-size: 0.8em;">🖨️</button>
                </div>
            </div>
        `).join('');
    }

    // ===== GESTIÓN DE USUARIOS (Solo Admin) =====

    cargarUsuarios() {
        if (this.usuario.rol !== 'administrador') return;
        
        const container = document.getElementById('lista-usuarios');
        
        if (!this.usuarios || this.usuarios.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No hay usuarios registrados</p>';
            return;
        }

        const rolIcono = {
            'administrador': '👑',
            'mesero': '👤',
            'cocinero': '👨‍🍳'
        };

        const rolNombre = {
            'administrador': 'Administrador',
            'mesero': 'Mesero',
            'cocinero': 'Cocinero'
        };

        container.innerHTML = this.usuarios.map(usuario => `
            <div class="usuario-card ${!usuario.activo ? 'inactivo' : ''}">
                <div class="usuario-header">
                    <span class="usuario-icono">${rolIcono[usuario.rol] || '👤'}</span>
                    <div class="usuario-info">
                        <h3>${usuario.nombre}</h3>
                        <span class="usuario-username">@${usuario.username}</span>
                    </div>
                </div>
                <div class="usuario-detalles">
                    <span class="usuario-rol ${usuario.rol}">${rolNombre[usuario.rol]}</span>
                    <span class="usuario-estado ${usuario.activo ? 'activo' : 'inactivo'}">
                        ${usuario.activo ? '✅ Activo' : '❌ Inactivo'}
                    </span>
                </div>
                <div class="usuario-acciones">
                    <button class="btn-secondary" onclick="app.editarUsuario('${usuario._id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn-danger" onclick="app.eliminarUsuario('${usuario._id}')" 
                        ${usuario._id === this.usuario.id ? 'disabled title="No puedes eliminarte a ti mismo"' : ''}>
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    }

    editarUsuario(id) {
        const usuario = this.usuarios.find(u => u._id === id);
        if (!usuario) return;

        this.editandoUsuarioId = id;
        
        document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuario';
        document.getElementById('usuario-nombre').value = usuario.nombre;
        document.getElementById('usuario-username').value = usuario.username;
        document.getElementById('usuario-password').value = '';
        document.getElementById('usuario-password').required = false;
        document.getElementById('password-help').textContent = 'Dejar vacío para mantener la contraseña actual';
        document.getElementById('usuario-rol').value = usuario.rol;
        document.getElementById('usuario-activo').value = usuario.activo.toString();
        document.getElementById('grupo-activo').style.display = 'block';
        
        document.getElementById('modal-usuario').classList.add('active');
    }

    async guardarUsuario() {
        const nombre = document.getElementById('usuario-nombre').value.trim();
        const username = document.getElementById('usuario-username').value.trim();
        const password = document.getElementById('usuario-password').value;
        const rol = document.getElementById('usuario-rol').value;
        const activo = document.getElementById('usuario-activo').value === 'true';

        if (!nombre || !username || !rol) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        if (!this.editandoUsuarioId && password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        const datosUsuario = { nombre, username, rol, activo };
        if (password) {
            datosUsuario.password = password;
        }

        try {
            if (this.editandoUsuarioId) {
                const actualizado = await this.apiRequest(`/usuarios/${this.editandoUsuarioId}`, 'PUT', datosUsuario);
                if (actualizado.error) {
                    alert(actualizado.error);
                    return;
                }
                const index = this.usuarios.findIndex(u => u._id === this.editandoUsuarioId);
                this.usuarios[index] = actualizado;
                await this.agregarActividad(`Usuario actualizado: ${nombre}`);
            } else {
                datosUsuario.password = password;
                const nuevo = await this.apiRequest('/usuarios', 'POST', datosUsuario);
                if (nuevo.error) {
                    alert(nuevo.error);
                    return;
                }
                this.usuarios.push(nuevo);
                await this.agregarActividad(`Nuevo usuario creado: ${nombre} (${rol})`);
            }

            document.getElementById('modal-usuario').classList.remove('active');
            this.cargarUsuarios();
        } catch (error) {
            alert('Error al guardar el usuario');
            console.error(error);
        }
    }

    async eliminarUsuario(id) {
        const usuario = this.usuarios.find(u => u._id === id);
        
        if (id === this.usuario.id) {
            alert('No puedes eliminarte a ti mismo');
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
            return;
        }

        try {
            const resultado = await this.apiRequest(`/usuarios/${id}`, 'DELETE');
            if (resultado.error) {
                alert(resultado.error);
                return;
            }
            
            this.usuarios = this.usuarios.filter(u => u._id !== id);
            await this.agregarActividad(`Usuario eliminado: ${usuario.nombre}`);
            this.cargarUsuarios();
        } catch (error) {
            alert('Error al eliminar el usuario');
            console.error(error);
        }
    }
}

// Inicializar
const app = new AdminApp();
