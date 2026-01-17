// Panel de Administración con Control de Acceso
class AdminApp {
    constructor() {
        this.API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
            ? API_CONFIG.url
            : 'http://localhost:3000/api';
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
        
        this.verificarSesion();
    }

    verificarSesion() {
        const usuarioGuardado = localStorage.getItem('usuario');
        if (usuarioGuardado) {
            this.usuario = JSON.parse(usuarioGuardado);
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
                localStorage.setItem('usuario', JSON.stringify(this.usuario));
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
        this.usuario = null;
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
                <button class="nav-btn" data-page="facturacion">
                    <span class="icon">💰</span>
                    Facturación
                </button>
                <button class="nav-btn" data-page="usuarios">
                    <span class="icon">👥</span>
                    Usuarios
                </button>
            `;
        } else {
            // Mesero: solo dashboard, mesas y pedidos
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
    }

    async cargarDatos() {
        try {
            const promesas = [
                fetch(`${this.API_URL}/menu`).then(r => r.json()),
                fetch(`${this.API_URL}/mesas`).then(r => r.json()),
                fetch(`${this.API_URL}/pedidos`).then(r => r.json()),
                fetch(`${this.API_URL}/facturas`).then(r => r.json()),
                fetch(`${this.API_URL}/actividad`).then(r => r.json())
            ];
            
            // Solo cargar usuarios si es administrador
            if (this.usuario.rol === 'administrador') {
                promesas.push(fetch(`${this.API_URL}/usuarios`).then(r => r.json()));
            }
            
            const resultados = await Promise.all(promesas);
            
            this.menu = resultados[0];
            this.mesas = resultados[1];
            this.pedidos = resultados[2];
            this.facturas = resultados[3];
            this.actividad = resultados[4];
            
            if (this.usuario.rol === 'administrador') {
                this.usuarios = resultados[5] || [];
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    async apiRequest(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (data) options.body = JSON.stringify(data);
            
            const response = await fetch(`${this.API_URL}${endpoint}`, options);
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
        if (page === 'facturacion' && this.usuario.rol === 'administrador') this.cargarFacturacion();
        if (page === 'usuarios' && this.usuario.rol === 'administrador') this.cargarUsuarios();
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
        const pedidosActivos = this.pedidos.filter(p => p.estado !== 'entregado').length;
        
        document.getElementById('mesas-ocupadas').textContent = mesasOcupadas;
        document.getElementById('pedidos-activos').textContent = pedidosActivos;
        document.getElementById('total-platillos').textContent = this.menu.length;
        
        if (this.usuario.rol === 'administrador') {
            const hoy = new Date().toDateString();
            const ventasHoy = this.facturas
                .filter(f => new Date(f.fecha).toDateString() === hoy)
                .reduce((sum, f) => sum + f.total, 0);
            document.getElementById('ventas-hoy').textContent = `$${ventasHoy.toFixed(2)}`;
        }

        this.mostrarActividadReciente();
    }

    mostrarActividadReciente() {
        const container = document.getElementById('actividad-reciente');
        const actividadReciente = this.actividad.slice(-10).reverse();
        
        if (actividadReciente.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay actividad reciente</p>';
            return;
        }

        container.innerHTML = actividadReciente.map(act => `
            <div class="activity-item">
                <div><strong>${act.accion}</strong></div>
                <div class="time">${new Date(act.fecha).toLocaleString('es-ES')}</div>
            </div>
        `).join('');
    }

    async agregarActividad(accion) {
        try {
            const nuevaActividad = await this.apiRequest('/actividad', 'POST', { 
                accion: `${this.usuario.nombre}: ${accion}` 
            });
            this.actividad.push(nuevaActividad);
        } catch (error) {
            console.error('Error agregando actividad:', error);
        }
    }

    setupModals() {
        if (this.usuario.rol === 'administrador') {
            document.getElementById('btn-agregar-platillo')?.addEventListener('click', () => {
                this.editandoPlatilloId = null;
                document.getElementById('modal-platillo-titulo').textContent = 'Agregar Platillo';
                document.getElementById('form-platillo').reset();
                document.getElementById('modal-platillo').classList.add('active');
            });

            document.getElementById('btn-cancelar-platillo')?.addEventListener('click', () => {
                document.getElementById('modal-platillo').classList.remove('active');
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
        }

        document.getElementById('btn-nuevo-pedido').addEventListener('click', () => {
            this.pedidoActual = [];
            this.cargarModalPedido();
            document.getElementById('modal-pedido').classList.add('active');
        });

        document.getElementById('btn-cancelar-pedido').addEventListener('click', () => {
            document.getElementById('modal-pedido').classList.remove('active');
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

            document.getElementById('filtro-categoria')?.addEventListener('change', () => this.cargarMenu());
            document.getElementById('buscar-platillo')?.addEventListener('input', () => this.cargarMenu());
        }

        document.getElementById('form-pedido').addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarPedido();
        });
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
        
        document.getElementById('modal-platillo-titulo').textContent = 'Editar Platillo';
        document.getElementById('platillo-nombre').value = platillo.nombre;
        document.getElementById('platillo-categoria').value = platillo.categoria;
        document.getElementById('platillo-precio').value = platillo.precio;
        document.getElementById('platillo-descripcion').value = platillo.descripcion || '';
        
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
            <div class="mesa-card ${mesa.estado}" onclick="app.toggleMesa('${mesa._id}')">
                <div class="mesa-numero">Mesa ${mesa.numero}</div>
                <span class="mesa-estado ${mesa.estado}">${mesa.estado === 'disponible' ? 'Disponible' : 'Ocupada'}</span>
                <p>Capacidad: ${mesa.capacidad} personas</p>
                ${puedeEliminar ? `<button class="btn-danger" onclick="event.stopPropagation(); app.eliminarMesa('${mesa._id}')" style="margin-top: 10px; width: 100%;">Eliminar</button>` : ''}
            </div>
        `).join('');
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
        const mesasDisponibles = this.mesas.filter(m => m.estado === 'disponible');
        
        selectMesa.innerHTML = mesasDisponibles.length > 0 
            ? mesasDisponibles.map(m => `<option value="${m._id}">Mesa ${m.numero}</option>`).join('')
            : '<option value="">No hay mesas disponibles</option>';

        const menuContainer = document.getElementById('menu-pedido');
        menuContainer.innerHTML = this.menu.map(platillo => `
            <div class="menu-pedido-item" onclick="app.agregarItemPedido('${platillo._id}')">
                <h4>${platillo.nombre}</h4>
                <div class="precio">$${platillo.precio.toFixed(2)}</div>
            </div>
        `).join('');

        this.actualizarItemsSeleccionados();
    }

    agregarItemPedido(platilloId) {
        const platillo = this.menu.find(p => p._id === platilloId);
        const itemExistente = this.pedidoActual.find(i => i.platilloId === platilloId);

        if (itemExistente) {
            itemExistente.cantidad++;
        } else {
            this.pedidoActual.push({
                platilloId,
                nombre: platillo.nombre,
                precio: platillo.precio,
                cantidad: 1
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
                <span>${item.nombre}</span>
                <div class="item-cantidad">
                    <button onclick="app.cambiarCantidad(${index}, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button onclick="app.cambiarCantidad(${index}, 1)">+</button>
                    <span style="margin-left: 10px; font-weight: bold;">$${(item.precio * item.cantidad).toFixed(2)}</span>
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
            this.pedidos.push(nuevo);
            
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
        const pedidosActivos = this.pedidos.filter(p => p.estado !== 'entregado');
        
        if (pedidosActivos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay pedidos activos</p>';
            return;
        }

        container.innerHTML = pedidosActivos.map(pedido => `
            <div class="pedido-card">
                <div class="pedido-header">
                    <span class="pedido-mesa">Mesa ${pedido.mesaNumero}</span>
                    <span class="pedido-estado ${pedido.estado}">${this.obtenerTextoEstado(pedido.estado)}</span>
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.cantidad}x ${item.nombre}</span>
                            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="pedido-total">Total: $${pedido.total.toFixed(2)}</div>
                <div class="pedido-actions">
                    ${this.puedePreparar() && pedido.estado === 'pendiente' ? `<button class="btn-primary" onclick="app.cambiarEstadoPedido('${pedido._id}', 'preparando')">🔥 Preparar</button>` : ''}
                    ${this.puedePreparar() && pedido.estado === 'preparando' ? `<button class="btn-success" onclick="app.cambiarEstadoPedido('${pedido._id}', 'listo')">✅ Marcar Listo</button>` : ''}
                    ${this.puedeEntregar() && pedido.estado === 'listo' ? `<button class="btn-success" onclick="app.entregarPedido('${pedido._id}')">🍽️ Entregar</button>` : ''}
                    ${this.usuario.rol === 'administrador' ? `<button class="btn-danger" onclick="app.cancelarPedido('${pedido._id}')">❌ Cancelar</button>` : ''}
                </div>
            </div>
        `).join('');
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
        
        const factura = {
            pedidoId: pedido._id,
            mesaNumero: pedido.mesaNumero,
            items: pedido.items,
            total: pedido.total,
            fecha: new Date().toISOString()
        };
        
        try {
            await this.apiRequest(`/pedidos/${pedidoId}`, 'PUT', pedido);
            const nuevaFactura = await this.apiRequest('/facturas', 'POST', factura);
            this.facturas.push(nuevaFactura);
            
            const mesa = this.mesas.find(m => m._id === pedido.mesaId);
            if (mesa) {
                mesa.estado = 'disponible';
                await this.apiRequest(`/mesas/${mesa._id}`, 'PUT', mesa);
            }
            
            await this.agregarActividad(`Pedido entregado - Mesa ${pedido.mesaNumero} - $${pedido.total.toFixed(2)}`);
            
            this.cargarPedidos();
            this.cargarMesas();
            this.cargarDashboard();
            if (this.usuario.rol === 'administrador') this.cargarFacturacion();
        } catch (error) {
            alert('Error al entregar el pedido');
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
                    <strong>Mesa ${factura.mesaNumero}</strong> - 
                    ${new Date(factura.fecha).toLocaleString('es-ES')}
                </div>
                <div style="font-weight: bold; color: var(--success-color);">
                    $${factura.total.toFixed(2)}
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
