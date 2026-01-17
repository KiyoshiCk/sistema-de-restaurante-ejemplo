// Panel de Cocina - Sistema de Restaurante
class CocinaApp {
    constructor() {
        this.API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
            ? API_CONFIG.url
            : 'http://localhost:3000/api';
        this.usuario = null;
        this.pedidos = [];
        this.filtroActual = 'todos';
        this.ultimoConteo = 0;
        this.sonidoHabilitado = true;
        
        this.verificarSesion();
    }

    verificarSesion() {
        const usuarioGuardado = localStorage.getItem('usuario_cocina');
        if (usuarioGuardado) {
            this.usuario = JSON.parse(usuarioGuardado);
            if (this.usuario.rol === 'cocinero') {
                this.mostrarPanel();
            } else {
                this.mostrarLogin();
            }
        } else {
            this.mostrarLogin();
        }
    }

    mostrarLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('cocina-screen').style.display = 'none';
        
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

            if (data.success && data.usuario.rol === 'cocinero') {
                this.usuario = data.usuario;
                localStorage.setItem('usuario_cocina', JSON.stringify(this.usuario));
                this.mostrarPanel();
            } else if (data.success && data.usuario.rol !== 'cocinero') {
                alert('⚠️ Este panel es solo para cocineros. Use el panel de administración para otros roles.');
            } else {
                alert('❌ Usuario o contraseña incorrectos');
            }
        } catch (error) {
            alert('Error al conectar con el servidor');
            console.error(error);
        }
    }

    logout() {
        localStorage.removeItem('usuario_cocina');
        this.usuario = null;
        location.reload();
    }

    async mostrarPanel() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('cocina-screen').style.display = 'block';
        
        document.getElementById('user-name').textContent = `👨‍🍳 ${this.usuario.nombre}`;
        
        this.actualizarFechaHora();
        setInterval(() => this.actualizarFechaHora(), 1000);
        
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        
        this.setupFiltros();
        
        // Cargar pedidos inicial
        await this.cargarPedidos();
        
        // Actualizar pedidos cada 5 segundos
        setInterval(() => this.cargarPedidos(), 5000);
    }

    actualizarFechaHora() {
        const now = new Date();
        const opciones = { 
            weekday: 'short', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        };
        document.getElementById('fecha-hora').textContent = now.toLocaleDateString('es-ES', opciones);
    }

    setupFiltros() {
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filtroActual = btn.dataset.filtro;
                this.renderizarPedidos();
            });
        });
    }

    async cargarPedidos() {
        try {
            const response = await fetch(`${this.API_URL}/pedidos`);
            const pedidos = await response.json();
            
            // Filtrar solo pedidos activos (no entregados ni cancelados)
            const pedidosAnteriores = this.pedidos.length;
            this.pedidos = pedidos.filter(p => 
                p.estado !== 'entregado' && p.estado !== 'cancelado'
            );
            
            // Verificar si hay nuevos pedidos pendientes
            const pendientesActuales = this.pedidos.filter(p => p.estado === 'pendiente').length;
            if (pendientesActuales > this.ultimoConteo && this.ultimoConteo > 0) {
                this.mostrarNotificacion();
            }
            this.ultimoConteo = pendientesActuales;
            
            this.actualizarEstadisticas();
            this.renderizarPedidos();
        } catch (error) {
            console.error('Error cargando pedidos:', error);
        }
    }

    actualizarEstadisticas() {
        const pendientes = this.pedidos.filter(p => p.estado === 'pendiente').length;
        const enPreparacion = this.pedidos.filter(p => p.estado === 'en-preparacion').length;
        const listos = this.pedidos.filter(p => p.estado === 'listo').length;
        
        document.getElementById('stat-pendientes').textContent = pendientes;
        document.getElementById('stat-preparacion').textContent = enPreparacion;
        document.getElementById('stat-listos').textContent = listos;
    }

    renderizarPedidos() {
        const container = document.getElementById('pedidos-cocina');
        
        let pedidosFiltrados = this.pedidos;
        if (this.filtroActual !== 'todos') {
            pedidosFiltrados = this.pedidos.filter(p => p.estado === this.filtroActual);
        }
        
        // Ordenar: pendientes primero, luego por fecha (más antiguos primero)
        pedidosFiltrados.sort((a, b) => {
            const ordenEstado = { 'pendiente': 0, 'en-preparacion': 1, 'listo': 2 };
            if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
                return ordenEstado[a.estado] - ordenEstado[b.estado];
            }
            return new Date(a.fecha) - new Date(b.fecha);
        });
        
        if (pedidosFiltrados.length === 0) {
            container.innerHTML = `
                <div class="sin-pedidos" style="grid-column: 1/-1;">
                    <div class="icono">✅</div>
                    <h2>¡Todo al día!</h2>
                    <p>No hay pedidos ${this.filtroActual !== 'todos' ? 'con este estado' : 'pendientes'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pedidosFiltrados.map(pedido => this.renderPedidoCard(pedido)).join('');
    }

    renderPedidoCard(pedido) {
        const tiempoTranscurrido = this.calcularTiempo(pedido.fecha);
        const esUrgente = tiempoTranscurrido.minutos > 15 && pedido.estado === 'pendiente';
        
        const estadoTexto = {
            'pendiente': '🔴 PENDIENTE',
            'en-preparacion': '🟡 EN PREPARACIÓN',
            'listo': '🟢 LISTO'
        };
        
        let botonesHTML = '';
        if (pedido.estado === 'pendiente') {
            botonesHTML = `
                <button class="btn-cocina btn-preparar" onclick="app.cambiarEstado('${pedido._id}', 'en-preparacion')">
                    🍳 Comenzar a Preparar
                </button>
            `;
        } else if (pedido.estado === 'en-preparacion') {
            botonesHTML = `
                <button class="btn-cocina btn-listo" onclick="app.cambiarEstado('${pedido._id}', 'listo')">
                    ✅ Marcar como Listo
                </button>
            `;
        } else if (pedido.estado === 'listo') {
            botonesHTML = `
                <button class="btn-cocina" style="background: #95a5a6; color: white;" disabled>
                    ⏳ Esperando entrega al cliente
                </button>
            `;
        }
        
        return `
            <div class="pedido-cocina-card ${pedido.estado}">
                <div class="pedido-cocina-header">
                    <div class="mesa-numero-cocina">🪑 Mesa ${pedido.numeroMesa}</div>
                    <div class="tiempo-pedido ${esUrgente ? 'urgente' : ''}">
                        ⏱️ ${tiempoTranscurrido.texto}
                    </div>
                </div>
                
                <span class="estado-badge ${pedido.estado}">${estadoTexto[pedido.estado]}</span>
                
                <div class="items-cocina-lista">
                    ${pedido.items.map(item => `
                        <div class="item-cocina">
                            <span class="cantidad">${item.cantidad}x</span>
                            <span class="nombre">${item.nombre}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="acciones-cocina">
                    ${botonesHTML}
                </div>
            </div>
        `;
    }

    calcularTiempo(fecha) {
        const ahora = new Date();
        const fechaPedido = new Date(fecha);
        const diffMs = ahora - fechaPedido;
        const diffMinutos = Math.floor(diffMs / 60000);
        const diffHoras = Math.floor(diffMinutos / 60);
        
        let texto;
        if (diffMinutos < 1) {
            texto = 'Hace un momento';
        } else if (diffMinutos < 60) {
            texto = `Hace ${diffMinutos} min`;
        } else {
            texto = `Hace ${diffHoras}h ${diffMinutos % 60}min`;
        }
        
        return { minutos: diffMinutos, texto };
    }

    async cambiarEstado(pedidoId, nuevoEstado) {
        try {
            const response = await fetch(`${this.API_URL}/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            
            if (response.ok) {
                // Registrar actividad
                const pedido = this.pedidos.find(p => p._id === pedidoId);
                const mensajeEstado = nuevoEstado === 'en-preparacion' 
                    ? `Cocina comenzó a preparar pedido de Mesa ${pedido?.numeroMesa}`
                    : `Pedido de Mesa ${pedido?.numeroMesa} está LISTO para servir`;
                
                await this.registrarActividad(mensajeEstado);
                
                // Recargar pedidos
                await this.cargarPedidos();
            } else {
                alert('Error al actualizar el estado del pedido');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al conectar con el servidor');
        }
    }

    async registrarActividad(accion) {
        try {
            await fetch(`${this.API_URL}/actividad`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    accion: `🍳 ${this.usuario.nombre}: ${accion}` 
                })
            });
        } catch (error) {
            console.error('Error registrando actividad:', error);
        }
    }

    mostrarNotificacion() {
        const notificacion = document.getElementById('notificacion');
        notificacion.classList.add('show');
        
        // Intentar reproducir sonido (si está disponible)
        this.reproducirSonido();
        
        setTimeout(() => {
            notificacion.classList.remove('show');
        }, 3000);
    }

    reproducirSonido() {
        // Crear un beep simple usando Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Audio no disponible, ignorar
        }
    }
}

// Inicializar aplicación
const app = new CocinaApp();
