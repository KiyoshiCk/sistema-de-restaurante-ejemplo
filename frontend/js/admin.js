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
        this.filtroPedidoEstado = 'todos';
        this.config = {};
        
        this.verificarSesion();
    }

    escapeHTML(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    inicializarSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO no disponible');
            return;
        }
        
        this.socket = io(this.SOCKET_URL, {
            auth: { token: this.token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        this.socket.on('connect', () => {
            console.log('Conectado a WebSocket');
            // Unirse a la sala según el rol
            this.socket.emit('join-room', this.usuario.rol);
            // Sincronizar datos al conectar/reconectar
            this.cargarDatos();
        });

        this.socket.on('disconnect', () => {
            console.log('Desconectado de WebSocket');
            this.mostrarNotificacion('Conexión perdida', 'Intentando reconectar...');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconectado después de', attemptNumber, 'intentos');
            this.mostrarNotificacion('Reconectado', 'Sincronizando datos...');
        });

        // Escuchar eventos en tiempo real - ACTUALIZACIONES INSTANTÁNEAS
        this.socket.on('nuevo-pedido', (pedido) => {
            console.log('Nuevo pedido recibido:', pedido);
            // Evitar duplicados: solo agregar si no existe
            const existe = this.pedidos.some(p => p._id === pedido._id);
            if (!existe) {
                this.mostrarNotificacion('Nuevo pedido', `Mesa ${pedido.mesaNumero}`);
                this.pedidos.unshift(pedido);
                this.cargarPedidosSinAnimacion();
                this.actualizarBadgesPedidos();
                this.actualizarBadgeNavPedidos();
                this.cargarDashboard();
            }
        });

        this.socket.on('pedido-actualizado', (pedido) => {
            console.log('Pedido actualizado:', pedido);
            // Detectar cambio a "listo" para notificación especial al mesero
            const pedidoAnterior = this.pedidos.find(p => p._id === pedido._id);
            const cambioAListo = pedidoAnterior && pedidoAnterior.estado !== 'listo' && pedido.estado === 'listo';
            
            if (cambioAListo && this.puedeEntregar()) {
                this.notificarPedidoListo(pedido);
            } else {
                this.mostrarNotificacion('Pedido actualizado', `Mesa ${pedido.mesaNumero} - ${this.obtenerTextoEstado(pedido.estado)}`);
            }
            // Actualización instantánea: actualizar pedido localmente
            const index = this.pedidos.findIndex(p => p._id === pedido._id);
            if (index !== -1) {
                this.pedidos[index] = pedido;
            } else {
                this.pedidos.unshift(pedido);
            }
            this.cargarPedidosSinAnimacion();
            this.actualizarBadgesPedidos();
            this.actualizarBadgeNavPedidos();
            this.cargarDashboard();
            // Actualizar sección de cobrar si está visible
            if (document.getElementById('cobrar')?.classList.contains('active')) {
                this.cargarMesasParaCobrar();
            }
        });

        this.socket.on('pedido-eliminado', (data) => {
            console.log('Pedido eliminado:', data);
            // Eliminar pedido localmente
            this.pedidos = this.pedidos.filter(p => p._id !== data._id);
            this.cargarPedidosSinAnimacion();
            this.actualizarBadgesPedidos();
            this.actualizarBadgeNavPedidos();
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
            console.log('Nueva factura:', factura);
            // Agregar factura localmente
            this.facturas.push(factura);
            if (this.usuario.rol === 'administrador') {
                this.cargarFacturacion();
            }
        });

        this.socket.on('nueva-actividad', (actividad) => {
            console.log('Nueva actividad:', actividad);
            // Agregar al inicio del array local sin recargar todo
            this.actividad.unshift(actividad);
            this.mostrarActividadReciente();
        });

        // Evento para forzar recarga completa (útil cuando hay desincronización)
        this.socket.on('sync-completo', () => {
            console.log('Sincronización completa solicitada');
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
                icon: opciones.icon || '/uploads/logo.png',
                badge: '/uploads/logo.png',
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
        notif.innerHTML = `<strong>${this.escapeHTML(titulo)}</strong><p>${this.escapeHTML(mensaje)}</p>`;
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
            try {
                this.usuario = JSON.parse(usuarioGuardado);
                this.token = tokenGuardado;
                // Verificar si el token está expirado antes de cargar la app
                const payload = JSON.parse(atob(tokenGuardado.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    localStorage.removeItem('usuario');
                    localStorage.removeItem('token');
                    this.mostrarLogin();
                    return;
                }
                this.mostrarPanel();
            } catch {
                localStorage.removeItem('usuario');
                localStorage.removeItem('token');
                this.mostrarLogin();
            }
        } else {
            this.mostrarLogin();
        }
    }

    mostrarLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';

        if (!this._loginListenerAdded) {
            document.getElementById('login-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
            this._loginListenerAdded = true;
        }
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
        badge.innerHTML = this.usuario.rol === 'administrador' ? '<i class="fa-solid fa-crown"></i> Admin' : '<i class="fa-solid fa-user"></i> Mesero';
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
                    <span class="icon"><i class="fa-solid fa-gauge"></i></span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="menu">
                    <span class="icon"><i class="fa-solid fa-clipboard-list"></i></span>
                    Gestión Menú
                </button>
                <button class="nav-btn" data-page="mesas">
                    <span class="icon"><i class="fa-solid fa-chair"></i></span>
                    Mesas
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon"><i class="fa-solid fa-bell-concierge"></i></span>
                    Pedidos
                </button>
                <button class="nav-btn" data-page="inventario">
                    <span class="icon"><i class="fa-solid fa-boxes-stacked"></i></span>
                    Inventario
                </button>
                <button class="nav-btn" data-page="reportes">
                    <span class="icon"><i class="fa-solid fa-chart-line"></i></span>
                    Reportes
                </button>
                <button class="nav-btn" data-page="facturacion">
                    <span class="icon"><i class="fa-solid fa-cash-register"></i></span>
                    Facturación
                </button>
                <button class="nav-btn" data-page="usuarios">
                    <span class="icon"><i class="fa-solid fa-users"></i></span>
                    Usuarios
                </button>
                <button class="nav-btn" data-page="config-ubicacion">
                    <span class="icon"><i class="fa-solid fa-location-dot"></i></span>
                    Ubicación
                </button>
            `;
        } else if (this.usuario.rol === 'mesero') {
            // Mesero: dashboard, mesas, pedidos, cobrar
            nav.innerHTML = `
                <button class="nav-btn active" data-page="dashboard">
                    <span class="icon"><i class="fa-solid fa-gauge"></i></span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="mesas">
                    <span class="icon"><i class="fa-solid fa-chair"></i></span>
                    Mesas
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon"><i class="fa-solid fa-bell-concierge"></i></span>
                    Pedidos
                </button>
            `;
        } else {
            // Cocinero: solo dashboard y pedidos
            nav.innerHTML = `
                <button class="nav-btn active" data-page="dashboard">
                    <span class="icon"><i class="fa-solid fa-gauge"></i></span>
                    Dashboard
                </button>
                <button class="nav-btn" data-page="pedidos">
                    <span class="icon"><i class="fa-solid fa-bell-concierge"></i></span>
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
        try { this.config = await fetch(`${this.API_URL}/config`).then(r => r.json()); } catch { this.config = {}; }

        this.cargarDashboard();
        if (this.usuario.rol === 'administrador') {
            this.cargarMenu();
            this.cargarFacturacion();
            this.cargarUsuarios();
            this.initLogo();
        }
        // Cargar logo y favicon para todos los roles
        this.cargarLogo();
        this.cargarMesas();
        this.cargarPedidos();
        this.setupFiltrosPedidos();

        // Ocultar botón "Nuevo Pedido" para cocineros
        if (this.usuario.rol === 'cocinero') {
            const btnNuevoPedido = document.getElementById('btn-nuevo-pedido');
            if (btnNuevoPedido) btnNuevoPedido.style.display = 'none';
        }

        // Cargar sección cobrar para mesero
        if (this.usuario.rol === 'mesero' || this.usuario.rol === 'administrador') {
            this.cargarMesasParaCobrar();
        }
        
        setInterval(() => this.actualizarFechaHora(), 1000);
        
        // Auto-refresh como fallback cada 10 segundos (WebSocket es el principal)
        setInterval(() => this.refrescarDatos(), 10000);

        // Actualizar tiempos de pedidos cada 30 segundos
        setInterval(() => {
            if (document.getElementById('pedidos')?.classList.contains('active')) {
                this.cargarPedidos();
            }
        }, 30000);
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
        // Mostrar pedidos activos (no cancelados), con filtro
        let pedidosActivos = this.pedidos
            .filter(p => p.estado !== 'cancelado')
            .sort((a, b) => {
                // Ordenar: pendiente, en-preparacion, listo, entregado
                const orden = { 'pendiente': 0, 'en-preparacion': 1, 'listo': 2, 'entregado': 3 };
                if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
                return new Date(a.fecha) - new Date(b.fecha);
            });

        // Aplicar filtro de estado
        if (this.filtroPedidoEstado && this.filtroPedidoEstado !== 'todos') {
            pedidosActivos = pedidosActivos.filter(p => p.estado === this.filtroPedidoEstado);
        }

        this.actualizarBadgesPedidos();
        this.actualizarBadgeNavPedidos();

        if (pedidosActivos.length === 0) {
            const msg = this.filtroPedidoEstado !== 'todos'
                ? `No hay pedidos con estado "${this.obtenerTextoEstado(this.filtroPedidoEstado)}"`
                : 'No hay pedidos activos';
            container.innerHTML = `<p style="text-align: center; color: #7f8c8d; padding: 40px 0;"><i class="fa-solid fa-inbox" style="font-size: 2em; display: block; margin-bottom: 10px; opacity: 0.4;"></i>${msg}</p>`;
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
        let mesaNumero = pedido.mesaNumero;
        if (!mesaNumero && pedido.mesaId) {
            const mesa = this.mesas.find(m => m._id === pedido.mesaId);
            if (mesa) mesaNumero = mesa.numero;
        }
        mesaNumero = mesaNumero || 'N/A';

        // Calcular tiempo transcurrido
        const tiempoTexto = this.calcularTiempoTranscurrido(pedido.fecha || pedido.createdAt);
        const minutos = this.calcularMinutos(pedido.fecha || pedido.createdAt);
        const esUrgente = minutos > 15 && pedido.estado !== 'entregado';

        // Icono del estado
        const iconosEstado = {
            'pendiente': 'fa-clock',
            'en-preparacion': 'fa-fire',
            'listo': 'fa-circle-check',
            'entregado': 'fa-utensils'
        };
        const iconoEstado = iconosEstado[pedido.estado] || 'fa-circle-question';
        
        return `
            <div class="pedido-card ${pedido.estado === 'entregado' ? 'pedido-entregado' : ''}" data-pedido-id="${pedido._id}">
                <div class="pedido-header">
                    <div class="pedido-header-left">
                        <span class="pedido-mesa"><i class="fa-solid fa-chair"></i> Mesa ${mesaNumero}</span>
                        <span class="pedido-tiempo ${esUrgente ? 'urgente' : ''}"><i class="fa-regular fa-clock"></i> ${tiempoTexto}</span>
                    </div>
                    <span class="pedido-estado ${pedido.estado}"><i class="fa-solid ${iconoEstado}"></i> ${this.obtenerTextoEstado(pedido.estado)}</span>
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span><strong>${item.cantidad}x</strong> ${this.escapeHTML(item.nombre)}</span>
                            <span>S/${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                        ${item.comentario ? `<div class="pedido-item-comentario"><i class="fa-solid fa-comment"></i> ${this.escapeHTML(item.comentario)}</div>` : ''}
                    `).join('')}
                </div>
                <div class="pedido-total"><i class="fa-solid fa-receipt"></i> Total: S/${pedido.total.toFixed(2)}</div>
                <div class="pedido-actions">
                    ${this.puedePreparar() && pedido.estado === 'pendiente' ? `<button class="btn-primary" onclick="app.cambiarEstadoPedido('${pedido._id}', 'en-preparacion')"><i class="fa-solid fa-fire"></i> Preparar</button>` : ''}
                    ${this.puedePreparar() && pedido.estado === 'en-preparacion' ? `<button class="btn-success" onclick="app.cambiarEstadoPedido('${pedido._id}', 'listo')"><i class="fa-solid fa-circle-check"></i> Marcar Listo</button>` : ''}
                    ${!this.puedePreparar() && pedido.estado === 'pendiente' ? `<div class="pedido-estado-info pendiente-info"><i class="fa-solid fa-clock"></i> Esperando que cocina lo tome</div>` : ''}
                    ${!this.puedePreparar() && pedido.estado === 'en-preparacion' ? `<div class="pedido-estado-info preparando-info"><i class="fa-solid fa-fire fa-beat"></i> Cocina está preparando este pedido</div>` : ''}
                    ${this.puedeEntregar() && pedido.estado === 'listo' ? `<button class="btn-success" onclick="app.entregarPedido('${pedido._id}')"><i class="fa-solid fa-utensils"></i> Entregar</button>` : ''}
                    ${this.puedeEntregar() && pedido.estado === 'entregado' ? `<button class="btn-cobrar" onclick="app.cobrarPedido('${pedido._id}')"><i class="fa-solid fa-money-bill"></i> Cobrar</button>` : ''}
                    ${(this.usuario.rol === 'administrador' || this.usuario.rol === 'mesero') && pedido.estado !== 'entregado' && pedido.estado !== 'listo' ? `<button class="btn-danger btn-cancelar-pedido" onclick="app.cancelarPedido('${pedido._id}')"><i class="fa-solid fa-xmark"></i> Cancelar</button>` : ''}
                </div>
            </div>
        `;
    }

    calcularTiempoTranscurrido(fecha) {
        if (!fecha) return '';
        const ahora = new Date();
        const creado = new Date(fecha);
        const diff = Math.floor((ahora - creado) / 1000);
        
        if (diff < 60) return 'Hace un momento';
        if (diff < 3600) {
            const min = Math.floor(diff / 60);
            return `${min} min`;
        }
        const hrs = Math.floor(diff / 3600);
        const min = Math.floor((diff % 3600) / 60);
        return `${hrs}h ${min}m`;
    }

    calcularMinutos(fecha) {
        if (!fecha) return 0;
        return Math.floor((new Date() - new Date(fecha)) / 60000);
    }

    notificarCambioPedidos() {
        // Mostrar indicador visual de actualización
        const indicator = document.createElement('div');
        indicator.className = 'refresh-indicator';
        indicator.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Pedidos actualizados';
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
            const json = await response.json();
            if (!response.ok) {
                throw new Error(json.error || `Error ${response.status}`);
            }
            return json;
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
            p.estado !== 'entregado' && p.estado !== 'cancelado' && p.estado !== 'cobrado'
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
            document.getElementById('ventas-hoy').textContent = `S/${ventasHoy.toFixed(2)}`;
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

        const iconosRol = {
            'administrador': '<i class="fa-solid fa-user-shield"></i>',
            'mesero': '<i class="fa-solid fa-bell-concierge"></i>',
            'cocinero': '<i class="fa-solid fa-fire"></i>'
        };
        const coloresRol = {
            'administrador': '#e74c3c',
            'mesero': '#3498db',
            'cocinero': '#e67e22'
        };

        container.innerHTML = actividadReciente.map(act => {
            const rol = act.tipo || '';
            const usuario = act.usuario || '';
            const icono = iconosRol[rol] || '<i class="fa-solid fa-user"></i>';
            const color = coloresRol[rol] || '#95a5a6';
            const rolTexto = rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : '';
            
            return `
                <div class="activity-item">
                    <div class="activity-content">
                        <div class="activity-user">
                            <span class="activity-rol-badge" style="background: ${color}">${icono} ${this.escapeHTML(rolTexto)}</span>
                            <span class="activity-nombre">${this.escapeHTML(usuario)}</span>
                        </div>
                        <div class="activity-desc">${this.escapeHTML(act.descripcion || 'Sin descripción')}</div>
                    </div>
                    <div class="time">${new Date(act.fecha).toLocaleString('es-ES')}</div>
                </div>
            `;
        }).join('');
    }

    async agregarActividad(accion) {
        try {
            const nuevaActividad = await this.apiRequest('/actividad', 'POST', { 
                descripcion: accion,
                usuario: this.usuario.nombre,
                tipo: this.usuario.rol
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
                ${platillo.imagen ? `<div class="menu-item-imagen"><img src="${platillo.imagen}" alt="${this.escapeHTML(platillo.nombre)}"></div>` : ''}
                <h3>${this.escapeHTML(platillo.nombre)}</h3>
                <span class="categoria">${this.escapeHTML(platillo.categoria)}</span>
                <div class="precio">S/${platillo.precio.toFixed(2)}</div>
                <p class="descripcion">${this.escapeHTML(platillo.descripcion || 'Sin descripción')}</p>
                <div class="disponibilidad-status">
                    ${platillo.disponible ? '<i class="fa-solid fa-circle-check" style="color:#27ae60"></i> Disponible' : '<i class="fa-solid fa-circle-xmark" style="color:#e74c3c"></i> No disponible'}
                </div>
                <div class="menu-item-actions">
                    <button class="btn-secondary" onclick="app.toggleDisponibilidad('${platillo._id}')">
                        ${platillo.disponible ? '<i class="fa-solid fa-ban"></i> Marcar no disponible' : '<i class="fa-solid fa-circle-check"></i> Marcar disponible'}
                    </button>
                    <button class="btn-primary" onclick="app.editarPlatillo('${platillo._id}')"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button class="btn-danger" onclick="app.eliminarPlatillo('${platillo._id}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    async guardarPlatillo() {
        const btn = document.querySelector('#modal-platillo [type="submit"]');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

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
        } finally {
            if (btn) btn.disabled = false;
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
        const resumen = document.getElementById('mesas-resumen');
        
        // Resumen de mesas
        const totalMesas = this.mesas.length;
        const disponibles = this.mesas.filter(m => m.estado === 'disponible').length;
        const ocupadas = this.mesas.filter(m => m.estado === 'ocupada').length;

        if (resumen) {
            resumen.innerHTML = `
                <div class="mesa-stat">
                    <div class="mesa-stat-icon" style="background: var(--info-color);"><i class="fa-solid fa-chair"></i></div>
                    <div class="mesa-stat-info">
                        <span class="mesa-stat-num">${totalMesas}</span>
                        <span class="mesa-stat-label">Total</span>
                    </div>
                </div>
                <div class="mesa-stat">
                    <div class="mesa-stat-icon" style="background: var(--success-color);"><i class="fa-solid fa-circle-check"></i></div>
                    <div class="mesa-stat-info">
                        <span class="mesa-stat-num">${disponibles}</span>
                        <span class="mesa-stat-label">Disponibles</span>
                    </div>
                </div>
                <div class="mesa-stat">
                    <div class="mesa-stat-icon" style="background: var(--danger-color);"><i class="fa-solid fa-bell-concierge"></i></div>
                    <div class="mesa-stat-info">
                        <span class="mesa-stat-num">${ocupadas}</span>
                        <span class="mesa-stat-label">Ocupadas</span>
                    </div>
                </div>
            `;
        }
        
        if (totalMesas === 0) {
            container.innerHTML = `
                <div class="mesas-empty">
                    <i class="fa-solid fa-chair"></i>
                    <h3>No hay mesas registradas</h3>
                    <p>Agrega tu primera mesa para comenzar</p>
                </div>`;
            return;
        }

        const puedeEliminar = this.usuario.rol === 'administrador';

        container.innerHTML = this.mesas
            .sort((a, b) => a.numero - b.numero)
            .map(mesa => {
                // Contar pedidos activos de esta mesa
                const pedidosMesa = this.pedidos.filter(p => 
                    (p.mesaId === mesa._id || p.mesaNumero === mesa.numero) &&
                    p.estado !== 'cancelado' && p.estado !== 'cobrado'
                );
                const pedidosActivos = pedidosMesa.filter(p => p.estado !== 'entregado');
                const pedidosEntregados = pedidosMesa.filter(p => p.estado === 'entregado');
                const totalConsumo = pedidosMesa.reduce((sum, p) => sum + (p.total || 0), 0);

                // Icono de capacidad
                const iconoCapacidad = mesa.capacidad <= 2 ? 'fa-user-group' 
                    : mesa.capacidad <= 4 ? 'fa-users' 
                    : 'fa-people-group';

                return `
                <div class="mesa-card ${mesa.estado}" data-mesa-id="${mesa._id}">
                    <div class="mesa-card-header">
                        <div class="mesa-card-numero">
                            <div class="mesa-card-icon ${mesa.estado}">
                                <i class="fa-solid fa-chair"></i>
                            </div>
                            <div>
                                <span class="mesa-card-title">Mesa ${mesa.numero}</span>
                                <span class="mesa-card-cap"><i class="fa-solid ${iconoCapacidad}"></i> ${mesa.capacidad} personas</span>
                            </div>
                        </div>
                        <span class="mesa-estado-badge ${mesa.estado}">
                            <i class="fa-solid ${mesa.estado === 'disponible' ? 'fa-circle-check' : 'fa-utensils'}"></i>
                            ${mesa.estado === 'disponible' ? 'Disponible' : 'Ocupada'}
                        </span>
                    </div>

                    ${mesa.estado === 'ocupada' && pedidosMesa.length > 0 ? `
                    <div class="mesa-card-info">
                        ${pedidosActivos.length > 0 ? `<div class="mesa-info-row"><i class="fa-solid fa-fire"></i> ${pedidosActivos.length} pedido${pedidosActivos.length > 1 ? 's' : ''} activo${pedidosActivos.length > 1 ? 's' : ''}</div>` : ''}
                        ${pedidosEntregados.length > 0 ? `<div class="mesa-info-row entregado"><i class="fa-solid fa-circle-check"></i> ${pedidosEntregados.length} listo${pedidosEntregados.length > 1 ? 's' : ''} para cobrar</div>` : ''}
                        <div class="mesa-info-total"><i class="fa-solid fa-receipt"></i> Consumo: S/${totalConsumo.toFixed(2)}</div>
                    </div>
                    ` : mesa.estado === 'disponible' ? `
                    <div class="mesa-card-info libre">
                        <i class="fa-solid fa-sparkles"></i> Lista para recibir clientes
                    </div>
                    ` : ''}

                    <div class="mesa-card-actions">
                        <button class="mesa-btn mesa-btn-toggle ${mesa.estado}" onclick="app.toggleMesa('${mesa._id}')" title="${mesa.estado === 'disponible' ? 'Marcar como ocupada' : 'Liberar mesa'}">
                            <i class="fa-solid ${mesa.estado === 'disponible' ? 'fa-lock-open' : 'fa-lock'}"></i>
                            ${mesa.estado === 'disponible' ? 'Ocupar' : 'Liberar'}
                        </button>
                        <button class="mesa-btn mesa-btn-historial" onclick="event.stopPropagation(); app.verHistorialMesa('${mesa._id}', ${mesa.numero})" title="Ver historial">
                            <i class="fa-solid fa-clock-rotate-left"></i> Historial
                        </button>
                        ${puedeEliminar ? `<button class="mesa-btn mesa-btn-eliminar" onclick="event.stopPropagation(); app.eliminarMesa('${mesa._id}')" title="Eliminar mesa">
                            <i class="fa-solid fa-trash"></i>
                        </button>` : ''}
                    </div>
                </div>
                `;
            }).join('');
    }
    
    verHistorialMesa(mesaId, mesaNumero) {
        // Buscar todos los pedidos/facturas de esta mesa
        const historial = this.facturas
            .filter(f => f.mesaNumero === mesaNumero)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 20);
        
        const pedidosActivos = this.pedidos
            .filter(p => (p.mesaId === mesaId || p.mesaNumero === mesaNumero) && p.estado !== 'cancelado' && p.estado !== 'cobrado')
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        let contenido = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4 style="margin-bottom: 15px;"><i class="fa-solid fa-arrows-rotate"></i> Pedidos Activos</h4>
        `;
        
        if (pedidosActivos.length > 0) {
            contenido += pedidosActivos.map(p => `
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${p.estado === 'pendiente' ? '#f39c12' : p.estado === 'en-preparacion' ? '#3498db' : p.estado === 'listo' ? '#27ae60' : '#95a5a6'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>${new Date(p.fecha).toLocaleString('es-ES')}</strong>
                        <span class="pedido-estado ${p.estado}" style="font-size: 0.85em;">${this.obtenerTextoEstado(p.estado)}</span>
                    </div>
                    <div style="font-size: 0.9em;">
                        ${p.items.map(i => `${i.cantidad}x ${this.escapeHTML(i.nombre)}`).join(', ')}
                    </div>
                    <div style="text-align: right; font-weight: bold; color: var(--primary-color);">S/${p.total.toFixed(2)}</div>
                </div>
            `).join('');
        } else {
            contenido += '<p style="color: #7f8c8d; text-align: center;">Sin pedidos activos</p>';
        }
        
        contenido += `<h4 style="margin: 20px 0 15px;"><i class="fa-solid fa-scroll"></i> Historial de Facturas</h4>`;
        
        if (historial.length > 0) {
            const totalHistorico = historial.reduce((sum, f) => sum + (f.total || 0), 0);
            contenido += `<p style="background: #e8f5e9; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <strong>Total histórico:</strong> S/${totalHistorico.toFixed(2)} en ${historial.length} visitas
            </p>`;
            
            contenido += historial.map(f => `
                <div style="background: #fff; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>${new Date(f.fecha).toLocaleString('es-ES')}</strong>
                        <span style="color: #27ae60;"><i class="fa-solid fa-circle-check"></i> Pagado</span>
                    </div>
                    <div style="font-size: 0.9em; color: #666;">
                        ${(f.items || []).map(i => `${i.cantidad}x ${this.escapeHTML(i.nombre)}`).join(', ') || 'Sin detalles'}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                        <small style="color: #666;">Método: ${this.escapeHTML(f.metodoPago || 'N/A')}</small>
                        <strong style="color: var(--primary-color);">S/${(f.total || 0).toFixed(2)}</strong>
                    </div>
                </div>
            `).join('');
        } else {
            contenido += '<p style="color: #7f8c8d; text-align: center;">Sin historial de facturas</p>';
        }
        
        contenido += '</div>';
        
        // Mostrar en modal
        this.mostrarModalInfo(`<i class="fa-solid fa-list"></i> Historial Mesa ${mesaNumero}`, contenido);
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
        
        document.getElementById('modal-info-titulo').innerHTML = titulo;
        document.getElementById('modal-info-contenido').innerHTML = contenido;
        modal.classList.add('active');
    }

    async guardarMesa() {
        const btn = document.querySelector('#modal-mesa [type="submit"]');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

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
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async toggleMesa(id) {
        if (!this._mesasEnProceso) this._mesasEnProceso = new Set();
        if (this._mesasEnProceso.has(id)) return;
        this._mesasEnProceso.add(id);

        const mesa = this.mesas.find(m => m._id === id);
        const estadoAnterior = mesa.estado;
        mesa.estado = mesa.estado === 'disponible' ? 'ocupada' : 'disponible';

        try {
            await this.apiRequest(`/mesas/${id}`, 'PUT', mesa);
            await this.agregarActividad(`Mesa ${mesa.numero} ahora está ${mesa.estado}`);
            this.cargarMesas();
            this.cargarDashboard();
        } catch (error) {
            mesa.estado = estadoAnterior;
            this.cargarMesas();
            alert('Error al cambiar estado de la mesa');
        } finally {
            this._mesasEnProceso.delete(id);
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
                ${platillo.imagen ? `<img src="${platillo.imagen}" alt="${this.escapeHTML(platillo.nombre)}" class="menu-pedido-thumb">` : ''}
                <h4>${this.escapeHTML(platillo.nombre)}</h4>
                <div class="precio">S/${platillo.precio.toFixed(2)}</div>
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
                categoria: platillo.categoria,
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
                    <span>${this.escapeHTML(item.nombre)}</span>
                    <div class="item-cantidad">
                        <button onclick="app.cambiarCantidad(${index}, -1)">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="app.cambiarCantidad(${index}, 1)">+</button>
                        <span style="margin-left: 10px; font-weight: bold;">S/${(item.precio * item.cantidad).toFixed(2)}</span>
                    </div>
                </div>
                <div class="item-comentario">
                    <input type="text" 
                           placeholder="Ej: sin cebolla, extra picante..." 
                           value="${this.escapeHTML(item.comentario || '')}"
                           oninput="app.actualizarComentario(${index}, this.value)"
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
        const btn = document.querySelector('#modal-pedido [type="submit"]');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

        const mesaId = document.getElementById('pedido-mesa').value;
        
        if (!mesaId || this.pedidoActual.length === 0) {
            alert('Debes seleccionar una mesa y al menos un platillo');
            if (btn) btn.disabled = false;
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
            
            await this.agregarActividad(`Nuevo pedido para Mesa ${mesa.numero} - S/${total.toFixed(2)}`);
            
            document.getElementById('modal-pedido').classList.remove('active');
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar el pedido');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    cargarPedidos() {
        const container = document.getElementById('lista-pedidos');
        // Mostrar pedidos activos (no cancelados), aplicando filtro si existe
        let pedidosActivos = this.pedidos
            .filter(p => p.estado !== 'cancelado')
            .sort((a, b) => {
                // Ordenar: pendiente, en-preparacion, listo, entregado
                const orden = { 'pendiente': 0, 'en-preparacion': 1, 'listo': 2, 'entregado': 3 };
                if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
                return new Date(a.fecha) - new Date(b.fecha);
            });
        
        // Aplicar filtro de estado
        if (this.filtroPedidoEstado && this.filtroPedidoEstado !== 'todos') {
            pedidosActivos = pedidosActivos.filter(p => p.estado === this.filtroPedidoEstado);
        }
        
        this.actualizarBadgesPedidos();
        this.actualizarBadgeNavPedidos();

        if (pedidosActivos.length === 0) {
            const msg = this.filtroPedidoEstado !== 'todos' 
                ? `No hay pedidos con estado "${this.obtenerTextoEstado(this.filtroPedidoEstado)}"`
                : 'No hay pedidos activos';
            container.innerHTML = `<p style="text-align: center; color: #7f8c8d; padding: 40px 0;"><i class="fa-solid fa-inbox" style="font-size: 2em; display: block; margin-bottom: 10px; opacity: 0.4;"></i>${msg}</p>`;
            return;
        }

        container.innerHTML = pedidosActivos.map(pedido => this.renderPedidoCard(pedido)).join('');
    }

    // ============= FILTROS DE PEDIDOS =============
    setupFiltrosPedidos() {
        const container = document.getElementById('pedidos-filtros');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.filtro-estado-btn');
            if (!btn) return;

            container.querySelectorAll('.filtro-estado-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.filtroPedidoEstado = btn.dataset.estado;
            this.cargarPedidos();
        });
    }

    actualizarBadgesPedidos() {
        const activos = this.pedidos.filter(p => p.estado !== 'cancelado');
        const conteos = {
            todos: activos.length,
            pendiente: activos.filter(p => p.estado === 'pendiente').length,
            'en-preparacion': activos.filter(p => p.estado === 'en-preparacion').length,
            listo: activos.filter(p => p.estado === 'listo').length,
            entregado: activos.filter(p => p.estado === 'entregado').length
        };

        Object.entries(conteos).forEach(([estado, count]) => {
            const badge = document.getElementById(`badge-${estado}`);
            if (badge) {
                badge.textContent = count > 0 ? count : '';
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        });
    }

    actualizarBadgeNavPedidos() {
        const listos = this.pedidos.filter(p => p.estado === 'listo').length;
        const navBtn = document.querySelector('[data-page="pedidos"]');
        if (!navBtn) return;

        let badge = navBtn.querySelector('.nav-badge-listo');
        if (listos > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'nav-badge-listo';
                navBtn.appendChild(badge);
            }
            badge.textContent = listos;
        } else if (badge) {
            badge.remove();
        }
    }

    notificarPedidoListo(pedido) {
        const mesa = pedido.mesaNumero || 'N/A';
        // Notificación visual prominente
        this.mostrarNotificacionListo(mesa);
        // Sonido de alerta
        this.reproducirSonidoListo();
        // Notificación del navegador
        if (Notification.permission === 'granted') {
            new Notification('🍽️ ¡Pedido Listo!', {
                body: `Mesa ${mesa} - Listo para entregar`,
                icon: document.getElementById('favicon')?.href || '',
                tag: `pedido-listo-${pedido._id}`
            });
        }
    }

    mostrarNotificacionListo(mesa) {
        const toast = document.createElement('div');
        toast.className = 'toast-pedido-listo';
        toast.innerHTML = `
            <div class="toast-listo-icon"><i class="fa-solid fa-bell"></i></div>
            <div class="toast-listo-content">
                <strong>¡Pedido Listo!</strong>
                <span>Mesa ${mesa} - Listo para entregar</span>
            </div>
        `;
        document.body.appendChild(toast);
        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    reproducirSonidoListo() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Tono doble agradable: ding-ding
            [0, 0.2].forEach(delay => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = delay === 0 ? 880 : 1100;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.4);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.4);
            });
        } catch (e) {
            // Audio no disponible
        }
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
            'en-preparacion': 'En Preparación',
            'listo': 'Listo',
            'entregado': 'Entregado',
            'cobrado': 'Cobrado',
            'cancelado': 'Cancelado'
        };
        return estados[estado] || estado;
    }

    async cambiarEstadoPedido(pedidoId, nuevoEstado) {
        const pedido = this.pedidos.find(p => p._id === pedidoId);
        const estadoAnterior = pedido.estado;
        pedido.estado = nuevoEstado;
        
        try {
            await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', pedido);
            await this.agregarActividad(`Pedido Mesa ${pedido.mesaNumero} - ${this.obtenerTextoEstado(nuevoEstado)}`);
            this.cargarPedidos();
            this.cargarDashboard();
        } catch (error) {
            pedido.estado = estadoAnterior;
            this.cargarPedidos();
            alert('Error al cambiar estado del pedido');
        }
    }

    async entregarPedido(pedidoId) {
        const pedido = this.pedidos.find(p => p._id === pedidoId);
        const estadoAnterior = pedido.estado;
        pedido.estado = 'entregado';
        
        try {
            await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', pedido);
            
            await this.agregarActividad(`Pedido entregado - Mesa ${pedido.mesaNumero}`);
            
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
            this.cargarMesasParaCobrar();
        } catch (error) {
            pedido.estado = estadoAnterior;
            this.cargarPedidos();
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
            const mesaNum = pedido.mesaNumero;
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
                    <div class="icono"><i class="fa-solid fa-circle-check fa-2x" style="color:#27ae60"></i></div>
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
                        <span class="mesa-numero"><i class="fa-solid fa-chair"></i> Mesa ${mesa.mesaNumero}</span>
                        <span class="pedidos-count">${mesa.pedidos.length} pedido(s)</span>
                    </div>
                    <div class="items-preview">
                        ${todosItems.slice(0, 5).map(item => `
                            <div class="item-preview">
                                <span>${item.cantidad}x ${this.escapeHTML(item.nombre)}</span>
                                <span>S/${(item.precio * item.cantidad).toFixed(2)}</span>
                            </div>
                        `).join('')}
                        ${todosItems.length > 5 ? `<div class="item-preview"><span>... y ${todosItems.length - 5} más</span></div>` : ''}
                    </div>
                    <div class="total-mesa">Total: S/${total.toFixed(2)}</div>
                    <div class="mesa-cobrar-actions">
                        <button class="btn-cobrar-mesa" onclick="app.abrirModalCobrar(${mesa.mesaNumero})">
                            <i class="fa-solid fa-money-bill"></i> Cobrar
                        </button>
                        <button class="btn-dividir-mesa" onclick="app.abrirDivisionCuentaPorNumero(${mesa.mesaNumero})">
                            <i class="fa-solid fa-divide"></i> Dividir
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
            p.mesaNumero === mesaNumero && 
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
                <span class="item-nombre">${this.escapeHTML(item.nombre)}</span>
                <span class="item-precio">S/${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
            ${item.comentario ? `<div class="cuenta-item-comentario"><i class="fa-solid fa-comment"></i> ${this.escapeHTML(item.comentario)}</div>` : ''}
        `).join('');
        
        document.getElementById('cuenta-total').textContent = `S/${total.toFixed(2)}`
        
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
        let mesaNumero = pedido.mesaNumero;
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
                <span class="item-nombre">${this.escapeHTML(item.nombre)}</span>
                <span class="item-precio">S/${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
            ${item.comentario ? `<div class="cuenta-item-comentario"><i class="fa-solid fa-comment"></i> ${this.escapeHTML(item.comentario)}</div>` : ''}
        `).join('');
        
        document.getElementById('cuenta-total').textContent = `S/${total.toFixed(2)}`
        
        document.getElementById('modal-cobrar').classList.add('active');
    }

    async procesarPago() {
        if (!this.mesaACobrar) return;
        const btn = document.getElementById('btn-procesar-pago');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

        const metodoPago = document.getElementById('metodo-pago').value;
        const pedidos = this.mesaACobrar.pedidos;
        const total = pedidos.reduce((sum, p) => sum + p.total, 0);
        const mesa = this.mesas.find(m =>
            m.numero === this.mesaACobrar.mesaNumero ||
            m._id === pedidos[0]?.mesaId
        );

        try {
            const resultado = await this.apiRequest('/cobrar', 'POST', {
                mesaNumero: this.mesaACobrar.mesaNumero,
                mesaId: mesa?._id,
                metodoPago
            });

            this.facturas.push(resultado.factura);
            for (const pedido of pedidos) pedido.estado = 'cobrado';
            if (mesa) mesa.estado = 'disponible';

            await this.agregarActividad(`Cobro Mesa ${this.mesaACobrar.mesaNumero} - S/${total.toFixed(2)} (${metodoPago})`);

            document.getElementById('modal-cobrar').classList.remove('active');

            if (confirm(`Pago procesado exitosamente\n\nTotal: S/${total.toFixed(2)}\nMétodo: ${metodoPago}\n\n¿Desea imprimir el ticket?`)) {
                this.imprimirTicket(resultado.factura);
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
        } finally {
            if (btn) btn.disabled = false;
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
                    <h1>${this.escapeHTML(this.config?.nombre || 'RESTAURANTE')}</h1>
                    <p>${this.escapeHTML(this.config?.slogan || 'Sistema de Gestión')}</p>
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-info">
                    <p><span>Ticket:</span> <span>${factura.numeroFactura}</span></p>
                    <p><span>Fecha:</span> <span>${fecha}</span></p>
                    <p><span>Mesa:</span> <span>${factura.mesaNumero || 'N/A'}</span></p>
                    <p><span>Método:</span> <span>${factura.metodoPago}</span></p>
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-items">
                    ${items.map(item => `
                        <div class="ticket-item">
                            <span class="ticket-item-name">${item.cantidad}x ${this.escapeHTML(item.nombre)}</span>
                            <span>S/${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="ticket-divider"></div>
                <div class="ticket-total">
                    TOTAL: S/${(factura.total || 0).toFixed(2)}
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
        if (!ventana) {
            alert('El navegador bloqueó la ventana emergente. Permite popups para este sitio e intenta de nuevo.');
            return;
        }
        ventana.document.write(ticketHTML);
        ventana.document.close();
        
        setTimeout(() => {
            ventana.print();
        }, 250);
    }

    imprimirFactura(id) {
        const factura = this.facturas.find(f => f._id === id);
        if (factura) this.imprimirTicket(factura);
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
            (p.mesaId === mesaId || p.mesaNumero === mesa?.numero) && 
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
        if (nuevaCantidad >= 2 && nuevaCantidad <= 20) {
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
                <span>${item.cantidad}x ${this.escapeHTML(item.nombre)}</span>
                <span>S/${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
        `).join('');
        
        // Calcular totales
        const porPersona = total / numPersonas;
        
        document.getElementById('division-total').textContent = `S/${total.toFixed(2)}`;
        document.getElementById('division-por-persona').textContent = `S/${porPersona.toFixed(2)}`;
        
        // Mostrar desglose por persona
        const desgloseContainer = document.getElementById('division-desglose');
        let desgloseHTML = '';
        
        for (let i = 1; i <= numPersonas; i++) {
            const pagado = this.divisionData.pagosProcesados.includes(i);
            desgloseHTML += `
                <div class="persona-card ${pagado ? 'pagado' : ''}">
                    <h4><i class="fa-solid fa-user"></i> Persona ${i}</h4>
                    <div class="monto">S/${porPersona.toFixed(2)}</div>
                    ${pagado 
                        ? '<p style="color: green; margin-top: 10px;"><i class="fa-solid fa-circle-check"></i> Pagado</p>' 
                        : `<button class="btn-primary" onclick="app.pagarPersona(${i}, ${porPersona.toFixed(2)})"><i class="fa-solid fa-credit-card"></i> Pagar</button>`
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
            const total = this.divisionData.total;
            const numPersonas = this.divisionData.numPersonas;
            const porPersona = total / numPersonas;

            const resultado = await this.apiRequest('/cobrar', 'POST', {
                mesaNumero: mesa.numero,
                mesaId: mesa._id,
                metodoPago: 'efectivo',
                esDiv: true,
                numPersonas,
                porPersona: porPersona.toFixed(2)
            });

            for (const pedido of pedidos) pedido.estado = 'cobrado';
            mesa.estado = 'disponible';
            this.facturas.push(resultado.factura);

            await this.agregarActividad(`Cuenta dividida - Mesa ${mesa.numero} - ${numPersonas} personas - S/${total.toFixed(2)}`);

            this.cerrarModalDivision();

            alert(`Cuenta dividida exitosamente!\nTotal: S/${total.toFixed(2)}\nPor persona: S/${porPersona.toFixed(2)}`);

            if (confirm('¿Desea imprimir el ticket?')) {
                this.imprimirTicket(resultado.factura);
            }

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
                
                await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', { estado: 'cancelado' });
                pedido.estado = 'cancelado';
                
                // Solo liberar mesa si no tiene otros pedidos activos
                if (mesa) {
                    const otrosPedidosMesa = this.pedidos.filter(p => 
                        p.mesaId === mesa._id && p.estado !== 'cancelado' && p.estado !== 'cobrado'
                    );
                    if (otrosPedidosMesa.length === 0) {
                        mesa.estado = 'disponible';
                        await this.apiRequest(`/mesas/${mesa._id}`, 'PUT', mesa);
                    }
                }
                
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
        
        if (!this._reportesInit) {
            // Botones de período rápido
            document.querySelectorAll('.periodo-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    const periodo = btn.dataset.periodo;
                    const rangoContainer = document.getElementById('rango-fechas-container');
                    
                    if (periodo === 'personalizado') {
                        rangoContainer.style.display = 'block';
                        // Establecer fechas por defecto: inicio del mes → hoy
                        const hoy = new Date();
                        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                        document.getElementById('reporte-fecha-inicio').value = inicioMes.toISOString().slice(0, 10);
                        document.getElementById('reporte-fecha-fin').value = hoy.toISOString().slice(0, 10);
                        // Establecer max en fecha fin = hoy
                        document.getElementById('reporte-fecha-fin').max = hoy.toISOString().slice(0, 10);
                    } else {
                        rangoContainer.style.display = 'none';
                        this.generarReporte(periodo);
                    }
                });
            });
            
            // Botón generar reporte personalizado
            document.getElementById('btn-generar-reporte')?.addEventListener('click', () => {
                this.generarReportePersonalizado();
            });
            
            // Validación en tiempo real: fecha inicio no puede ser mayor a fecha fin
            const fechaInicio = document.getElementById('reporte-fecha-inicio');
            const fechaFin = document.getElementById('reporte-fecha-fin');
            
            fechaInicio?.addEventListener('change', () => {
                // Actualizar mínimo de fecha fin
                if (fechaInicio.value) {
                    fechaFin.min = fechaInicio.value;
                    // Si fecha fin es menor que fecha inicio, corregir
                    if (fechaFin.value && fechaFin.value < fechaInicio.value) {
                        fechaFin.value = fechaInicio.value;
                    }
                }
                this.validarRangoFechas();
            });
            
            fechaFin?.addEventListener('change', () => {
                // Actualizar máximo de fecha inicio
                if (fechaFin.value) {
                    fechaInicio.max = fechaFin.value;
                }
                this.validarRangoFechas();
            });
            
            this._reportesInit = true;
        }
        
        // Cargar reporte inicial (mes actual)
        this.generarReporte('mes');
    }
    
    validarRangoFechas() {
        const fechaInicio = document.getElementById('reporte-fecha-inicio').value;
        const fechaFin = document.getElementById('reporte-fecha-fin').value;
        const errorDiv = document.getElementById('fecha-error');
        const errorTexto = document.getElementById('fecha-error-texto');
        const inputInicio = document.getElementById('reporte-fecha-inicio');
        const inputFin = document.getElementById('reporte-fecha-fin');
        
        inputInicio.classList.remove('error');
        inputFin.classList.remove('error');
        errorDiv.style.display = 'none';
        
        if (!fechaInicio || !fechaFin) return true;
        
        if (fechaInicio > fechaFin) {
            errorTexto.textContent = 'La fecha de inicio no puede ser posterior a la fecha final.';
            errorDiv.style.display = 'flex';
            inputInicio.classList.add('error');
            inputFin.classList.add('error');
            return false;
        }
        
        // Advertencia si el rango es mayor a 1 año
        const diff = new Date(fechaFin) - new Date(fechaInicio);
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (dias > 365) {
            errorTexto.textContent = `El rango seleccionado abarca ${dias} días. Rangos muy amplios pueden ser lentos.`;
            errorDiv.style.display = 'flex';
            // No es error, solo advertencia — permitir continuar
        }
        
        return true;
    }
    
    generarReportePersonalizado() {
        const fechaInicio = document.getElementById('reporte-fecha-inicio').value;
        const fechaFin = document.getElementById('reporte-fecha-fin').value;
        
        if (!fechaInicio || !fechaFin) {
            const errorDiv = document.getElementById('fecha-error');
            const errorTexto = document.getElementById('fecha-error-texto');
            errorTexto.textContent = 'Selecciona ambas fechas para generar el reporte.';
            errorDiv.style.display = 'flex';
            return;
        }
        
        if (!this.validarRangoFechas()) return;
        
        this.generarReporte('personalizado');
    }
    
    generarReporte(periodo) {
        const { inicio, fin, textoInfo } = this.obtenerRangoFechas(periodo);
        
        // Mostrar info del período
        document.getElementById('reporte-periodo-texto').textContent = `Mostrando datos de: ${textoInfo}`;
        
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
        document.getElementById('reporte-total-ventas').textContent = `S/${totalVentas.toFixed(2)}`;
        document.getElementById('reporte-pedidos-completados').textContent = pedidosCompletados;
        document.getElementById('reporte-ticket-promedio').textContent = `S/${ticketPromedio.toFixed(2)}`;
        
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
        let inicio, fin, textoInfo;
        
        const formatFecha = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        
        switch(periodo) {
            case 'hoy':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
                fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
                textoInfo = `Hoy — ${formatFecha(ahora)}`;
                break;
            case 'semana':
                const diaSemana = ahora.getDay();
                const diasDesdelunes = diaSemana === 0 ? 6 : diaSemana - 1;
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasDesdelunes);
                inicio.setHours(0, 0, 0, 0);
                fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
                textoInfo = `Esta Semana — ${formatFecha(inicio)} al ${formatFecha(fin)}`;
                break;
            case 'mes':
                inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
                textoInfo = `Este Mes — ${ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
                break;
            case 'anio':
                inicio = new Date(ahora.getFullYear(), 0, 1);
                fin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
                textoInfo = `Este Año — ${ahora.getFullYear()}`;
                break;
            case 'personalizado':
                const fi = document.getElementById('reporte-fecha-inicio').value;
                const ff = document.getElementById('reporte-fecha-fin').value;
                inicio = new Date(fi + 'T00:00:00');
                fin = new Date(ff + 'T23:59:59');
                textoInfo = `Personalizado — ${formatFecha(inicio)} al ${formatFecha(fin)}`;
                break;
            default:
                inicio = new Date(0);
                fin = ahora;
                textoInfo = 'Todo el historial';
        }
        
        return { inicio, fin, textoInfo };
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
                        <small style="color: #666;">S/${data.total.toFixed(2)}</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarMesasTop(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            const mesa = f.mesaNumero || 'N/A';
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
                        <div class="reporte-item-value">S/${data.total.toFixed(2)}</div>
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
                    <span class="reporte-item-value">S/${data.total.toFixed(2)}</span>
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
                            <div class="reporte-item-name"><i class="fa-solid fa-clock"></i> ${hora}</div>
                            <div class="reporte-item-bar" style="width: ${(data.pedidos / maxPedidos * 100)}%"></div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">${data.pedidos} pedidos</div>
                        <small style="color: #666;">S/${data.total.toFixed(2)}</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }
    
    mostrarVentasPorCategoria(facturas) {
        const conteo = {};
        
        facturas.forEach(f => {
            (f.items || []).forEach(item => {
                // Buscar categoría: primero en el item guardado al crear el pedido, luego en menú actual
                const platillo = this.menu.find(p => p.nombre === item.nombre);
                const categoria = item.categoria || platillo?.categoria || 'Otros';
                if (!conteo[categoria]) {
                    conteo[categoria] = 0;
                }
                conteo[categoria] += (item.precio || 0) * (item.cantidad || 1);
            });
        });
        
        const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        const total = ordenado.reduce((sum, [_, v]) => sum + v, 0) || 1;
        
        const iconos = {
            'Entradas': '<i class="fa-solid fa-leaf"></i>',
            'Platos Fuertes': '<i class="fa-solid fa-drumstick-bite"></i>',
            'Postres': '<i class="fa-solid fa-cake-candles"></i>',
            'Bebidas': '<i class="fa-solid fa-glass-water"></i>',
            'Otros': '<i class="fa-solid fa-boxes-stacked"></i>'
        };
        
        document.getElementById('reporte-categorias').innerHTML = ordenado.length > 0
            ? ordenado.map(([categoria, valor]) => `
                <div class="reporte-item">
                    <span class="reporte-item-name">${iconos[categoria] || '<i class="fa-solid fa-boxes-stacked"></i>'} ${categoria}</span>
                    <div style="flex: 1; margin: 0 15px;">
                        <div class="reporte-item-bar" style="width: ${(valor / total * 100)}%"></div>
                    </div>
                    <div style="text-align: right;">
                        <div class="reporte-item-value">S/${valor.toFixed(2)}</div>
                        <small style="color: #666;">${(valor / total * 100).toFixed(1)}%</small>
                    </div>
                </div>
            `).join('')
            : '<p style="text-align: center; color: #7f8c8d;">Sin datos</p>';
    }

    // ===== INVENTARIO (Solo Admin) =====
    
    cargarInventario() {
        if (this.usuario.rol !== 'administrador') return;
        
        // Mostrar resumen y alertas
        this.mostrarResumenInventario();
        this.mostrarAlertasInventario();
        
        // Configurar filtros (solo una vez)
        if (!this._inventarioInit) {
            // Categoría pills
            document.getElementById('inventario-categorias')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.inv-cat-btn');
                if (!btn) return;
                document.querySelectorAll('.inv-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderizarInventario();
            });
            document.getElementById('buscar-inventario')?.addEventListener('input', () => this.renderizarInventario());
            this._inventarioInit = true;
        }
        
        this.renderizarInventario();
    }
    
    mostrarResumenInventario() {
        const container = document.getElementById('inventario-resumen');
        if (!container) return;
        
        const total = this.inventario.length;
        const stockBajo = this.inventario.filter(i => i.cantidad <= i.stockMinimo && i.cantidad > 0).length;
        const agotados = this.inventario.filter(i => i.cantidad <= 0).length;
        const valorTotal = this.inventario.reduce((sum, i) => sum + (i.cantidad * (i.costo || 0)), 0);
        
        container.innerHTML = `
            <div class="inv-stat">
                <i class="fa-solid fa-boxes-stacked"></i>
                <div>
                    <span class="inv-stat-num">${total}</span>
                    <span class="inv-stat-label">Total Items</span>
                </div>
            </div>
            <div class="inv-stat warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                    <span class="inv-stat-num">${stockBajo}</span>
                    <span class="inv-stat-label">Stock Bajo</span>
                </div>
            </div>
            <div class="inv-stat danger">
                <i class="fa-solid fa-xmark-circle"></i>
                <div>
                    <span class="inv-stat-num">${agotados}</span>
                    <span class="inv-stat-label">Agotados</span>
                </div>
            </div>
            <div class="inv-stat success">
                <i class="fa-solid fa-sack-dollar"></i>
                <div>
                    <span class="inv-stat-num">S/${valorTotal.toFixed(2)}</span>
                    <span class="inv-stat-label">Valor Inventario</span>
                </div>
            </div>
        `;
    }
    
    mostrarAlertasInventario() {
        const criticos = this.inventario.filter(item => item.cantidad <= 0);
        const bajos = this.inventario.filter(item => item.cantidad > 0 && item.cantidad <= item.stockMinimo);
        const container = document.getElementById('inventario-alertas');
        
        if (criticos.length === 0 && bajos.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        
        if (criticos.length > 0) {
            html += `
                <div class="alerta-stock alerta-critica">
                    <strong><i class="fa-solid fa-circle-xmark"></i> ¡Agotados! (${criticos.length})</strong>
                    <div class="alertas-items">
                        ${criticos.map(item => `
                            <span class="alerta-item critica">
                                <i class="fa-solid fa-ban"></i> ${item.nombre}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (bajos.length > 0) {
            html += `
                <div class="alerta-stock alerta-baja">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> Stock Bajo (${bajos.length})</strong>
                    <div class="alertas-items">
                        ${bajos.map(item => {
                            const pct = Math.round((item.cantidad / item.stockMinimo) * 100);
                            return `
                                <span class="alerta-item baja">
                                    ${item.nombre}: ${item.cantidad} ${item.unidad} <small>(${pct}%)</small>
                                </span>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    _getEstadoStock(item) {
        if (item.cantidad <= 0) return { texto: 'Agotado', clase: 'agotado', color: '#c0392b' };
        if (item.cantidad <= item.stockMinimo * 0.5) return { texto: 'Crítico', clase: 'critico', color: '#e74c3c' };
        if (item.cantidad <= item.stockMinimo) return { texto: 'Bajo', clase: 'bajo', color: '#f39c12' };
        if (item.cantidad >= item.stockMinimo * 2) return { texto: 'Óptimo', clase: 'optimo', color: '#27ae60' };
        return { texto: 'Normal', clase: 'normal', color: '#3498db' };
    }
    
    renderizarInventario() {
        const container = document.getElementById('lista-inventario');
        const catActiva = document.querySelector('.inv-cat-btn.active')?.dataset.cat || '';
        const busqueda = document.getElementById('buscar-inventario')?.value.toLowerCase() || '';
        
        let items = this.inventario;
        
        if (catActiva) {
            items = items.filter(i => i.categoria === catActiva);
        }
        
        if (busqueda) {
            items = items.filter(i => i.nombre.toLowerCase().includes(busqueda));
        }
        
        if (items.length === 0) {
            const mensaje = this.inventario.length === 0 
                ? { icon: 'fa-boxes-stacked', text: 'No hay items en el inventario', sub: 'Agrega tu primer item con el botón de arriba' }
                : { icon: 'fa-filter-circle-xmark', text: 'Sin resultados', sub: 'Prueba cambiando los filtros de búsqueda' };
            container.innerHTML = `
                <div class="inventario-empty">
                    <i class="fa-solid ${mensaje.icon}"></i>
                    <h3>${mensaje.text}</h3>
                    <p>${mensaje.sub}</p>
                </div>
            `;
            return;
        }
        
        const iconosCategoria = {
            'Carnes': '<i class="fa-solid fa-drumstick-bite"></i>',
            'Verduras': '<i class="fa-solid fa-leaf"></i>',
            'Frutas': '<i class="fa-solid fa-apple-whole"></i>',
            'Granos': '<i class="fa-solid fa-wheat-awn"></i>',
            'Lácteos': '<i class="fa-solid fa-cheese"></i>',
            'Bebidas': '<i class="fa-solid fa-glass-water"></i>',
            'Condimentos': '<i class="fa-solid fa-jar"></i>',
            'Otros': '<i class="fa-solid fa-boxes-stacked"></i>'
        };
        
        container.innerHTML = items.map(item => {
            const estado = this._getEstadoStock(item);
            const nivelOptimo = item.stockMinimo * 2;
            const porcentajeStock = Math.min(100, (item.cantidad / nivelOptimo) * 100);
            const valorItem = item.cantidad * (item.costo || 0);
            const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
            const tiempoStr = updatedAt ? this._tiempoRelativo(updatedAt) : '';
            
            // Calcular variación de costo
            let costoChangeHtml = '';
            if (item.costoAnterior && item.costoAnterior > 0 && item.costo !== item.costoAnterior) {
                const variacion = ((item.costo - item.costoAnterior) / item.costoAnterior) * 100;
                const subio = variacion > 0;
                costoChangeHtml = `
                    <span class="inv-costo-change ${subio ? 'subio' : 'bajo'}" title="Antes: S/${item.costoAnterior.toFixed(2)}">
                        <i class="fa-solid fa-arrow-${subio ? 'up' : 'down'}"></i> ${Math.abs(variacion).toFixed(1)}%
                    </span>
                `;
            }
            
            return `
                <div class="inventario-card ${estado.clase}">
                    <div class="inventario-header">
                        <span class="inventario-icono">${iconosCategoria[item.categoria] || '<i class="fa-solid fa-boxes-stacked"></i>'}</span>
                        <div class="inventario-info">
                            <h4>${item.nombre}</h4>
                            <small>${item.categoria}</small>
                        </div>
                        <span class="inv-estado-badge ${estado.clase}">${estado.texto}</span>
                    </div>
                    
                    <div class="inventario-stock">
                        <div class="stock-cantidad">
                            <strong>${item.cantidad}</strong> <span>${item.unidad}</span>
                            <small class="stock-minimo">mín: ${item.stockMinimo}</small>
                        </div>
                        <div class="stock-barra-container">
                            <div class="stock-barra ${estado.clase}" style="width: ${porcentajeStock}%"></div>
                        </div>
                    </div>
                    
                    <div class="inventario-detalles">
                        ${item.costo > 0 ? `
                            <div class="inv-detalle">
                                <span class="inv-detalle-label"><i class="fa-solid fa-tag"></i> Costo</span>
                                <span class="inv-detalle-valor">
                                    S/${item.costo.toFixed(2)}/${item.unidad} ${costoChangeHtml}
                                </span>
                            </div>
                            <div class="inv-detalle">
                                <span class="inv-detalle-label"><i class="fa-solid fa-coins"></i> Valor</span>
                                <span class="inv-detalle-valor">S/${valorItem.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${tiempoStr ? `
                            <div class="inv-detalle">
                                <span class="inv-detalle-label"><i class="fa-solid fa-clock"></i> Actualizado</span>
                                <span class="inv-detalle-valor">${tiempoStr}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="inventario-actions">
                        <div class="inv-stock-controls">
                            <button class="inv-btn-ajuste" onclick="app.ajustarStock('${item._id}', -1)" title="Restar 1">
                                <i class="fa-solid fa-minus"></i>
                            </button>
                            <button class="inv-btn-cantidad" onclick="app.ajustarStockPersonalizado('${item._id}')" title="Ajuste personalizado">
                                ${item.cantidad} ${item.unidad}
                            </button>
                            <button class="inv-btn-ajuste" onclick="app.ajustarStock('${item._id}', 1)" title="Sumar 1">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <div class="inv-item-actions">
                            <button class="inv-btn-edit" onclick="app.editarInventario('${item._id}')" title="Editar item">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="inv-btn-delete" onclick="app.eliminarInventario('${item._id}')" title="Eliminar item">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    _tiempoRelativo(fecha) {
        const ahora = new Date();
        const diff = ahora - fecha;
        const mins = Math.floor(diff / 60000);
        const horas = Math.floor(diff / 3600000);
        const dias = Math.floor(diff / 86400000);
        
        if (mins < 1) return 'Justo ahora';
        if (mins < 60) return `Hace ${mins} min`;
        if (horas < 24) return `Hace ${horas}h`;
        if (dias < 7) return `Hace ${dias}d`;
        return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }
    
    async ajustarStock(id, cantidad) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;
        
        const nuevaCantidad = Math.max(0, item.cantidad + cantidad);
        if (nuevaCantidad === item.cantidad) return;
        
        try {
            await this.apiRequest(`/inventario/${id}`, 'PUT', { cantidad: nuevaCantidad });
            const accion = cantidad > 0 ? `+${cantidad}` : `${cantidad}`;
            await this.agregarActividad(`Stock ajustado: ${item.nombre} ${accion} ${item.unidad} (${item.cantidad} → ${nuevaCantidad})`);
            item.cantidad = nuevaCantidad;
            this.renderizarInventario();
            this.mostrarAlertasInventario();
            this.mostrarResumenInventario();
        } catch (error) {
            alert('Error al ajustar stock');
        }
    }

    async ajustarStockPersonalizado(id) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;
        
        // Crear modal inline en vez de prompt()
        const existente = document.getElementById('modal-ajuste-stock');
        if (existente) existente.remove();
        
        const modal = document.createElement('div');
        modal.id = 'modal-ajuste-stock';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 420px;">
                <h2><i class="fa-solid fa-sliders"></i> Ajustar Stock</h2>
                <div style="text-align: center; margin: 15px 0;">
                    <div style="font-size: 1.1em; color: var(--dark-color); font-weight: 600;">${item.nombre}</div>
                    <div style="color: #7f8c8d; margin-top: 4px;">Stock actual: <strong>${item.cantidad}</strong> ${item.unidad}</div>
                    ${item.costo > 0 ? `<div style="color: #95a5a6; font-size: 0.85em; margin-top: 2px;">Costo actual: S/${item.costo.toFixed(2)}/${item.unidad}</div>` : ''}
                </div>
                <div class="form-group">
                    <label>Tipo de ajuste:</label>
                    <div class="ajuste-tipo-btns">
                        <button type="button" class="ajuste-tipo-btn active" data-tipo="agregar">
                            <i class="fa-solid fa-plus"></i> Agregar
                        </button>
                        <button type="button" class="ajuste-tipo-btn" data-tipo="restar">
                            <i class="fa-solid fa-minus"></i> Restar
                        </button>
                        <button type="button" class="ajuste-tipo-btn" data-tipo="establecer">
                            <i class="fa-solid fa-pen"></i> Establecer
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Cantidad (${item.unidad}):</label>
                    <input type="number" id="ajuste-stock-cantidad" min="0" step="0.01" value="1" style="font-size: 1.2em; text-align: center;">
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="ajuste-actualizar-costo" style="width: auto;">
                        <i class="fa-solid fa-money-bill-trend-up"></i> Actualizar costo unitario
                    </label>
                    <div id="ajuste-costo-container" style="display: none; margin-top: 8px;">
                        <div class="form-row">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.85em;">Nuevo costo (S/):</label>
                                <input type="number" id="ajuste-nuevo-costo" min="0" step="0.01" value="${item.costo || 0}" style="text-align: center;">
                            </div>
                            <div id="ajuste-costo-diff" style="display: flex; align-items: center; justify-content: center; font-size: 0.85em; color: #7f8c8d;">
                                Sin cambio
                            </div>
                        </div>
                    </div>
                </div>
                <div id="ajuste-stock-preview" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px;">
                    Resultado: <strong>${item.cantidad + 1}</strong> ${item.unidad}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-primary" id="btn-confirmar-ajuste">
                        <i class="fa-solid fa-check"></i> Confirmar
                    </button>
                    <button type="button" class="btn-secondary" id="btn-cancelar-ajuste">Cancelar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        let tipoAjuste = 'agregar';
        const inputCantidad = document.getElementById('ajuste-stock-cantidad');
        const preview = document.getElementById('ajuste-stock-preview');
        const checkCosto = document.getElementById('ajuste-actualizar-costo');
        const costoContainer = document.getElementById('ajuste-costo-container');
        const inputCosto = document.getElementById('ajuste-nuevo-costo');
        const costoDiff = document.getElementById('ajuste-costo-diff');
        
        const actualizarPreview = () => {
            const val = parseFloat(inputCantidad.value) || 0;
            let resultado;
            switch (tipoAjuste) {
                case 'agregar': resultado = item.cantidad + val; break;
                case 'restar': resultado = Math.max(0, item.cantidad - val); break;
                case 'establecer': resultado = Math.max(0, val); break;
            }
            preview.innerHTML = `Resultado: <strong>${resultado.toFixed(2)}</strong> ${item.unidad}`;
        };
        
        const actualizarDiffCosto = () => {
            const nuevoCosto = parseFloat(inputCosto.value) || 0;
            const costoActual = item.costo || 0;
            if (costoActual === 0 || nuevoCosto === costoActual) {
                costoDiff.innerHTML = '<span style="color: #7f8c8d;">Sin cambio</span>';
                return;
            }
            const variacion = ((nuevoCosto - costoActual) / costoActual) * 100;
            const subio = variacion > 0;
            costoDiff.innerHTML = `
                <span style="color: ${subio ? '#e74c3c' : '#27ae60'}; font-weight: 600;">
                    <i class="fa-solid fa-arrow-${subio ? 'up' : 'down'}"></i> ${Math.abs(variacion).toFixed(1)}%
                    <br><small style="font-weight: 400;">S/${costoActual.toFixed(2)} → S/${nuevoCosto.toFixed(2)}</small>
                </span>
            `;
        };
        
        checkCosto.addEventListener('change', () => {
            costoContainer.style.display = checkCosto.checked ? 'block' : 'none';
            if (checkCosto.checked) inputCosto.focus();
        });
        
        inputCosto.addEventListener('input', actualizarDiffCosto);
        
        inputCantidad.addEventListener('input', actualizarPreview);
        inputCantidad.focus();
        inputCantidad.select();
        
        modal.querySelectorAll('.ajuste-tipo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.ajuste-tipo-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tipoAjuste = btn.dataset.tipo;
                actualizarPreview();
            });
        });
        
        const cerrarModal = () => modal.remove();
        
        document.getElementById('btn-cancelar-ajuste').addEventListener('click', cerrarModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
        
        document.getElementById('btn-confirmar-ajuste').addEventListener('click', async () => {
            const val = parseFloat(inputCantidad.value) || 0;
            let nuevaCantidad;
            let descripcion;
            
            switch (tipoAjuste) {
                case 'agregar':
                    nuevaCantidad = item.cantidad + val;
                    descripcion = `+${val}`;
                    break;
                case 'restar':
                    nuevaCantidad = Math.max(0, item.cantidad - val);
                    descripcion = `-${val}`;
                    break;
                case 'establecer':
                    nuevaCantidad = Math.max(0, val);
                    descripcion = `→ ${val}`;
                    break;
            }
            
            const payload = { cantidad: nuevaCantidad };
            let costoMsg = '';
            
            if (checkCosto.checked) {
                const nuevoCosto = parseFloat(inputCosto.value) || 0;
                if (nuevoCosto !== item.costo) {
                    payload.costo = nuevoCosto;
                    costoMsg = ` | Costo: S/${(item.costo || 0).toFixed(2)} → S/${nuevoCosto.toFixed(2)}`;
                }
            }
            
            try {
                const actualizado = await this.apiRequest(`/inventario/${id}`, 'PUT', payload);
                await this.agregarActividad(`Stock ajustado: ${item.nombre} ${descripcion} ${item.unidad} (${item.cantidad} → ${nuevaCantidad})${costoMsg}`);
                // Actualizar objeto local con respuesta del server
                const index = this.inventario.findIndex(i => i._id === id);
                if (index >= 0) this.inventario[index] = actualizado;
                this.renderizarInventario();
                this.mostrarAlertasInventario();
                this.mostrarResumenInventario();
                cerrarModal();
            } catch (error) {
                alert('Error al ajustar stock');
            }
        });
    }
    
    editarInventario(id) {
        const item = this.inventario.find(i => i._id === id);
        if (!item) return;
        
        this.editandoInventarioId = id;
        document.getElementById('modal-inventario-titulo').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Item';
        document.getElementById('inventario-nombre').value = item.nombre;
        document.getElementById('inventario-categoria').value = item.categoria;
        document.getElementById('inventario-unidad').value = item.unidad;
        document.getElementById('inventario-cantidad').value = item.cantidad;
        document.getElementById('inventario-stock-minimo').value = item.stockMinimo;
        document.getElementById('inventario-costo').value = item.costo || 0;
        document.getElementById('modal-inventario').classList.add('active');
    }
    
    async guardarInventario() {
        const btn = document.querySelector('#modal-inventario [type="submit"]');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

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
                const anterior = this.inventario.find(i => i._id === this.editandoInventarioId);
                const actualizado = await this.apiRequest(`/inventario/${this.editandoInventarioId}`, 'PUT', item);
                const index = this.inventario.findIndex(i => i._id === this.editandoInventarioId);
                this.inventario[index] = actualizado;
                
                let actMsg = `Inventario actualizado: ${item.nombre}`;
                if (anterior && anterior.costo !== item.costo && anterior.costo > 0) {
                    const variacion = ((item.costo - anterior.costo) / anterior.costo * 100).toFixed(1);
                    actMsg += ` | Costo: S/${anterior.costo.toFixed(2)} → S/${item.costo.toFixed(2)} (${variacion > 0 ? '+' : ''}${variacion}%)`;
                }
                await this.agregarActividad(actMsg);
            } else {
                const nuevo = await this.apiRequest('/inventario', 'POST', item);
                this.inventario.push(nuevo);
                await this.agregarActividad(`Nuevo item de inventario: ${item.nombre}`);
            }
            
            document.getElementById('modal-inventario').classList.remove('active');
            this.renderizarInventario();
            this.mostrarAlertasInventario();
            this.mostrarResumenInventario();
            this.cargarDashboard();
        } catch (error) {
            alert('Error al guardar el item');
        } finally {
            if (btn) btn.disabled = false;
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
                this.mostrarResumenInventario();
            } catch (error) {
                alert('Error al eliminar el item');
            }
        }
    }

    // ===== FACTURACIÓN (Solo Admin) =====
    
    cargarFacturacion() {
        if (this.usuario.rol !== 'administrador') return;

        const ahora = new Date();
        const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const diaRef = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const inicioSemana = new Date(diaRef.setDate(diaRef.getDate() - diaRef.getDay()));
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const totalDia = this.facturas
            .filter(f => new Date(f.fecha) >= inicioDia)
            .reduce((sum, f) => sum + f.total, 0);

        const totalSemana = this.facturas
            .filter(f => new Date(f.fecha) >= inicioSemana)
            .reduce((sum, f) => sum + f.total, 0);

        const totalMes = this.facturas
            .filter(f => new Date(f.fecha) >= inicioMes)
            .reduce((sum, f) => sum + f.total, 0);

        document.getElementById('total-dia').textContent = `S/${totalDia.toFixed(2)}`;
        document.getElementById('total-semana').textContent = `S/${totalSemana.toFixed(2)}`;
        document.getElementById('total-mes').textContent = `S/${totalMes.toFixed(2)}`;

        const container = document.getElementById('lista-facturas');
        
        if (this.facturas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay facturas registradas</p>';
            return;
        }

        const facturasRecientes = [...this.facturas].reverse().slice(0, 50);
        
        container.innerHTML = facturasRecientes.map(factura => `
            <div class="factura-item">
                <div>
                    <strong>Mesa ${factura.mesaNumero}</strong> -
                    ${new Date(factura.fecha).toLocaleString('es-ES')}
                    <small style="color: #666; margin-left: 10px;">${this.escapeHTML(factura.metodoPago || '')}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: var(--success-color);">S/${factura.total.toFixed(2)}</span>
                    <button class="btn-info" onclick="app.imprimirFactura('${factura._id}')" style="padding: 5px 10px; font-size: 0.8em;"><i class="fa-solid fa-print"></i></button>
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
            'administrador': '<i class="fa-solid fa-crown"></i>',
            'mesero': '<i class="fa-solid fa-user"></i>',
            'cocinero': '<i class="fa-solid fa-kitchen-set"></i>'
        };

        const rolNombre = {
            'administrador': 'Administrador',
            'mesero': 'Mesero',
            'cocinero': 'Cocinero'
        };

        container.innerHTML = this.usuarios.map(usuario => `
            <div class="usuario-card ${!usuario.activo ? 'inactivo' : ''}">
                <div class="usuario-header">
                    <span class="usuario-icono">${rolIcono[usuario.rol] || '<i class="fa-solid fa-user"></i>'}</span>
                    <div class="usuario-info">
                        <h3>${this.escapeHTML(usuario.nombre)}</h3>
                        <span class="usuario-username">@${this.escapeHTML(usuario.username)}</span>
                    </div>
                </div>
                <div class="usuario-detalles">
                    <span class="usuario-rol ${usuario.rol}">${rolNombre[usuario.rol]}</span>
                    <span class="usuario-estado ${usuario.activo ? 'activo' : 'inactivo'}">
                        ${usuario.activo ? '<i class="fa-solid fa-circle-check"></i> Activo' : '<i class="fa-solid fa-circle-xmark"></i> Inactivo'}
                    </span>
                </div>
                <div class="usuario-acciones">
                    <button class="btn-secondary" onclick="app.editarUsuario('${usuario._id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    <button class="btn-danger" onclick="app.eliminarUsuario('${usuario._id}')" 
                        ${usuario._id === this.usuario.id ? 'disabled title="No puedes eliminarte a ti mismo"' : ''}>
                        <i class="fa-solid fa-trash"></i> Eliminar
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
        const btn = document.querySelector('#modal-usuario [type="submit"]');
        if (btn?.disabled) return;
        if (btn) btn.disabled = true;

        const nombre = document.getElementById('usuario-nombre').value.trim();
        const username = document.getElementById('usuario-username').value.trim();
        const password = document.getElementById('usuario-password').value;
        const rol = document.getElementById('usuario-rol').value;
        const activo = document.getElementById('usuario-activo').value === 'true';

        if (!nombre || !username || !rol) {
            alert('Por favor complete todos los campos requeridos');
            if (btn) btn.disabled = false;
            return;
        }

        if (!this.editandoUsuarioId && password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            if (btn) btn.disabled = false;
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
        } finally {
            if (btn) btn.disabled = false;
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

    // ============= LOGO DEL RESTAURANTE =============

    initLogo() {
        const inputLogo = document.getElementById('input-logo');
        const btnEliminar = document.getElementById('btn-eliminar-logo');
        
        if (inputLogo) {
            inputLogo.addEventListener('change', (e) => this.subirLogo(e));
        }
        if (btnEliminar) {
            btnEliminar.addEventListener('click', () => this.eliminarLogo());
        }
        
        this.cargarLogo();
    }

    async cargarLogo() {
        try {
            const baseUrl = this.API_URL.replace('/api', '');
            const res = await fetch(`${this.API_URL}/config/logo`);
            const data = await res.json();
            
            const preview = document.getElementById('logo-preview-actual');
            const placeholder = document.getElementById('logo-placeholder');
            const btnEliminar = document.getElementById('btn-eliminar-logo');
            
            if (data.logo) {
                const logoUrl = `${baseUrl}${data.logo}?t=${Date.now()}`;
                if (preview) {
                    preview.src = logoUrl;
                    preview.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';
                if (btnEliminar) btnEliminar.style.display = 'inline-block';

                // Mostrar logo en login y header
                const loginLogo = document.getElementById('login-logo');
                if (loginLogo) {
                    loginLogo.src = logoUrl;
                    loginLogo.style.display = 'block';
                }
                const headerLogo = document.getElementById('admin-header-logo');
                if (headerLogo) {
                    headerLogo.src = logoUrl;
                    headerLogo.style.display = 'inline';
                }
                // Favicon dinámico
                const favicon = document.getElementById('favicon');
                if (favicon) favicon.href = logoUrl;
            } else {
                if (preview) preview.style.display = 'none';
                if (placeholder) placeholder.style.display = 'flex';
                if (btnEliminar) btnEliminar.style.display = 'none';
            }
        } catch (error) {
            console.error('Error al cargar logo:', error);
        }
    }

    async subirLogo(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const mensaje = document.getElementById('logo-mensaje');
        
        // Validar tamaño
        if (file.size > 5 * 1024 * 1024) {
            this.mostrarMensajeLogo('La imagen no debe superar 5MB', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
            this.mostrarMensajeLogo('Subiendo logo...', 'info');
            
            const baseUrl = this.API_URL.replace('/api', '');
            const res = await fetch(`${this.API_URL}/config/logo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            const data = await res.json();
            
            if (res.ok) {
                this.mostrarMensajeLogo('Logo actualizado correctamente', 'success');
                this.cargarLogo();
                // Actualizar logo en el header
                this.actualizarLogoHeader(data.logo);
            } else {
                this.mostrarMensajeLogo(`${data.error}`, 'error');
            }
        } catch (error) {
            this.mostrarMensajeLogo('Error al subir el logo', 'error');
            console.error(error);
        }
        
        // Limpiar input
        e.target.value = '';
    }

    async eliminarLogo() {
        if (!confirm('¿Estás seguro de eliminar el logo?')) return;
        
        try {
            const res = await fetch(`${this.API_URL}/config/logo`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (res.ok) {
                this.mostrarMensajeLogo('Logo eliminado', 'success');
                this.cargarLogo();
                this.actualizarLogoHeader(null);
            } else {
                this.mostrarMensajeLogo('Error al eliminar el logo', 'error');
            }
        } catch (error) {
            this.mostrarMensajeLogo('Error al eliminar el logo', 'error');
            console.error(error);
        }
    }

    mostrarMensajeLogo(texto, tipo) {
        const el = document.getElementById('logo-mensaje');
        if (!el) return;
        el.textContent = texto;
        el.className = `logo-mensaje logo-mensaje-${tipo}`;
        el.style.display = 'block';
        if (tipo !== 'info') {
            setTimeout(() => { el.style.display = 'none'; }, 4000);
        }
    }

    actualizarLogoHeader(logoUrl) {
        const headerH1 = document.querySelector('#app-screen header h1');
        if (!headerH1) return;
        const baseUrl = this.API_URL.replace('/api', '');
        
        // Remover logo anterior si existe
        const oldLogo = headerH1.querySelector('.header-logo');
        if (oldLogo) oldLogo.remove();
        
        if (logoUrl) {
            const img = document.createElement('img');
            img.src = `${baseUrl}${logoUrl}?t=${Date.now()}`;
            img.alt = 'Logo';
            img.className = 'header-logo';
            headerH1.prepend(img);
            // Quitar emoji si hay logo
            headerH1.childNodes.forEach(n => {
                if (n.nodeType === 3 && n.textContent.includes('Restaurante')) {
                    n.textContent = n.textContent.trim();
                }
            });
        }
    }
}

// Inicializar
const app = new AdminApp();
