// Vista del Cliente - Solo visualización del menú
class ClienteApp {
    constructor() {
        this.API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
            ? API_CONFIG.url
            : 'http://localhost:3000/api';
        this.menu = [];
        this.init();
    }

    async init() {
        await this.cargarMenu();
        this.setupFiltros();
        this.mostrarMenu();
        this.setupParallax();
        this.setupSmoothScroll();
    }

    // ============= PARALLAX EFFECT =============
    setupParallax() {
        const parallaxContent = document.querySelector('.parallax-content');
        const floatingElements = document.querySelectorAll('.float-item');
        const parallaxHero = document.querySelector('.parallax-hero');
        
        if (!parallaxHero) return;

        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    const heroHeight = parallaxHero.offsetHeight;
                    
                    // Solo aplicar cuando el hero es visible
                    if (scrolled < heroHeight) {
                        // Parallax en el contenido (se mueve más rápido hacia arriba)
                        if (parallaxContent) {
                            parallaxContent.style.transform = `translateY(${scrolled * 0.4}px)`;
                            parallaxContent.style.opacity = 1 - (scrolled / heroHeight);
                        }
                        
                        // Parallax en elementos flotantes (diferentes velocidades)
                        floatingElements.forEach((el, index) => {
                            const speed = 0.2 + (index * 0.1);
                            el.style.transform = `translateY(${scrolled * speed}px)`;
                        });
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = anchor.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    async cargarMenu() {
        try {
            const response = await fetch(`${this.API_URL}/menu`);
            this.menu = await response.json();
        } catch (error) {
            console.error('Error cargando menú:', error);
            document.getElementById('menu-cliente-grid').innerHTML = 
                '<p style="text-align: center; color: #e74c3c; grid-column: 1/-1; padding: 40px;">Error al cargar el menú. Por favor, intenta nuevamente.</p>';
        }
    }

    setupFiltros() {
        document.querySelectorAll('.categoria-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mostrarMenu(e.target.dataset.categoria);
            });
        });
    }

    mostrarMenu(categoriaFiltro = '') {
        let menuFiltrado = this.menu;
        
        // Filtrar solo disponibles
        menuFiltrado = menuFiltrado.filter(p => p.disponible !== false);
        
        if (categoriaFiltro) {
            menuFiltrado = menuFiltrado.filter(p => p.categoria === categoriaFiltro);
        }

        const container = document.getElementById('menu-cliente-grid');
        
        if (menuFiltrado.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1; padding: 40px;">No hay platillos disponibles en esta categoría</p>';
            return;
        }

        const iconos = {
            'Entradas': '🥗',
            'Platos Fuertes': '🍽️',
            'Postres': '🍰',
            'Bebidas': '🥤'
        };

        container.innerHTML = menuFiltrado.map(platillo => `
            <div class="menu-cliente-item">
                <div class="menu-cliente-item-header">
                    <div class="menu-cliente-item-icono">${iconos[platillo.categoria] || '🍴'}</div>
                    <div class="menu-cliente-item-nombre">${platillo.nombre}</div>
                    <span class="menu-cliente-item-categoria">${platillo.categoria}</span>
                </div>
                <div class="menu-cliente-item-body">
                    <p class="menu-cliente-item-descripcion">
                        ${platillo.descripcion || 'Delicioso platillo preparado con los mejores ingredientes.'}
                    </p>
                    <div class="menu-cliente-item-footer">
                        <div class="menu-cliente-item-precio">
                            <span class="menu-cliente-item-precio-label">Precio</span>
                            $${platillo.precio.toFixed(2)}
                        </div>
                        <span class="menu-disponible">✓ Disponible</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// Inicializar
new ClienteApp();
