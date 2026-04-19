// Vista del Cliente - Solo visualización del menú
class ClienteApp {
    constructor() {
        this.API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
            ? API_CONFIG.url
            : 'http://localhost:3000/api';
        this.menu = [];
        this.config = {};
        this.init();
    }

    async init() {
        await Promise.all([
            this.cargarConfig(),
            this.cargarMenu()
        ]);
        this.aplicarConfig();
        this.buildCategoriaBtns();
        this.mostrarMenu();
        this.setupParallax();
        this.setupSmoothScroll();
        this.cargarLogo();
    }

    escapeHTML(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ============= CONFIGURACIÓN DINÁMICA =============
    async cargarConfig() {
        try {
            const res = await fetch(`${this.API_URL}/config`);
            this.config = await res.json();
        } catch (error) {
            console.error('Error cargando configuración:', error);
            this.config = {};
        }
    }

    aplicarConfig() {
        const c = this.config;
        const nombre = c.nombre || 'Restaurante';
        const ciudad = c.ciudad || '';
        const barrio = c.barrio || '';
        const region = c.region || '';
        const direccion = c.direccion || '';
        const descripcion = c.descripcion || `Menú digital de ${nombre}. Descubre nuestros platos, bebidas, postres y más.`;
        const slogan = c.slogan || `Disfruta de nuestros deliciosos platillos`;
        const moneda = c.moneda || 'S/';

        // === Title y Meta ===
        document.title = `Menú Digital ${nombre}${ciudad ? ' en ' + ciudad : ''} | Carta Online`;
        
        const setMeta = (id, content) => {
            const el = document.getElementById(id);
            if (el) el.setAttribute('content', content);
        };
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setHTML = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        setMeta('meta-description', descripcion);
        setMeta('meta-author', nombre);
        setMeta('og-title', `Menú Digital - ${nombre}${ciudad ? ' en ' + ciudad : ''}`);
        setMeta('og-description', descripcion);
        setMeta('og-site-name', nombre);
        setMeta('og-image-alt', `Menú de ${nombre}`);
        setMeta('tw-title', `Menú Digital - ${nombre}`);
        setMeta('tw-description', descripcion);

        // === Geo Meta Tags ===
        if (c.lat && c.lng) {
            setMeta('geo-position', `${c.lat};${c.lng}`);
            setMeta('geo-icbm', `${c.lat}, ${c.lng}`);
        }
        if (ciudad || barrio) {
            const placename = [barrio, ciudad, region].filter(Boolean).join(', ');
            setMeta('geo-placename', placename);
        }

        // === Schema.org JSON-LD ===
        const cocinas = c.cocinas ? c.cocinas.split(',').map(s => s.trim()) : ['Local'];
        const schema = {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": nombre,
            "description": descripcion,
            "servesCuisine": cocinas,
            "priceRange": moneda,
            "currenciesAccepted": c.monedaCodigo || "PEN",
            "paymentAccepted": c.metodosPago || "Efectivo"
        };

        if (c.telefono) schema.telephone = c.telefono;
        if (c.email) schema.email = c.email;

        if (direccion || ciudad) {
            schema.address = {
                "@type": "PostalAddress",
                "streetAddress": direccion,
                "addressLocality": barrio || ciudad,
                "addressRegion": region,
                "postalCode": c.codigoPostal || "",
                "addressCountry": "PE"
            };
        }

        if (c.lat && c.lng) {
            schema.geo = {
                "@type": "GeoCoordinates",
                "latitude": c.lat,
                "longitude": c.lng
            };
        }

        // Horarios estructurados para Schema.org
        const horaAbre = c.horaAbre || '11:00';
        const horaCierra = c.horaCierra || '22:00';
        const horaAbreDom = c.horaAbreDom || '11:00';
        const horaCierraDom = c.horaCierraDom || '20:00';
        schema.openingHoursSpecification = [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": horaAbre,
                "closes": horaCierra
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": "Sunday",
                "opens": horaAbreDom,
                "closes": horaCierraDom
            }
        ];

        // Secciones del menú generadas dinámicamente desde los datos reales
        const categoriasSchema = [...new Set((this.menu || []).map(p => p.categoria).filter(Boolean))];
        if (categoriasSchema.length > 0) {
            schema.hasMenu = {
                "@type": "Menu",
                "name": "Menú Digital",
                "hasMenuSection": categoriasSchema.map(c => ({ "@type": "MenuSection", "name": c }))
            };
        }

        const schemaEl = document.getElementById('schema-jsonld');
        if (schemaEl) schemaEl.textContent = JSON.stringify(schema, null, 2);

        // === Hero ===
        const subtitleEl = document.getElementById('parallax-subtitle');
        if (subtitleEl) {
            const ubicTxt = ciudad ? ` en ${ciudad}` : '';
            subtitleEl.textContent = slogan + ubicTxt;
        }

        // === Footer ===
        setHTML('footer-nombre', `<i class="fa-solid fa-utensils"></i> <span>${this.escapeHTML(nombre)}</span>`);
        setText('footer-slogan', slogan);
        setText('footer-copyright-nombre', nombre);
        setText('footer-horario-semana', c.horarioSemana || '');
        setText('footer-horario-domingo', c.horarioDomingo || '');

        // Ubicación
        const dirParts = [direccion].filter(Boolean);
        const ciudadParts = [barrio, ciudad, region].filter(Boolean).join(', ');
        setText('footer-direccion', dirParts.join(', ') || '');
        setText('footer-ciudad', ciudadParts || '');

        // Contacto
        const footerTelEl = document.getElementById('footer-telefono');
        const footerEmailEl = document.getElementById('footer-email');
        const footerColContacto = document.getElementById('footer-col-contacto');
        
        if (c.telefono || c.email || c.whatsapp) {
            if (footerTelEl) {
                if (c.whatsapp) {
                    const waLink = document.createElement('a');
                    waLink.href = `https://wa.me/${encodeURIComponent(String(c.whatsapp).replace(/\D/g, ''))}`;
                    waLink.target = '_blank';
                    waLink.rel = 'noopener';
                    waLink.style.cssText = 'color:inherit;text-decoration:none;';
                    waLink.innerHTML = '<i class="fa-brands fa-whatsapp"></i> ';
                    waLink.appendChild(document.createTextNode(c.telefono || c.whatsapp));
                    footerTelEl.innerHTML = '';
                    footerTelEl.appendChild(waLink);
                } else {
                    footerTelEl.textContent = c.telefono || '';
                }
            }
            if (footerEmailEl) footerEmailEl.textContent = c.email || '';
        } else if (footerColContacto) {
            footerColContacto.style.display = 'none';
        }

        // Pagos
        const pagosEl = document.getElementById('footer-pagos');
        if (pagosEl && c.metodosPago) {
            pagosEl.textContent = c.metodosPago.split(',').map(s => s.trim()).join(' • ');
        }
    }

    // ============= LOGO =============
    async cargarLogo() {
        try {
            const baseUrl = this.API_URL.replace('/api', '');
            const res = await fetch(`${this.API_URL}/config/logo`);
            const data = await res.json();
            if (data.logo) {
                const logoUrl = `${baseUrl}${data.logo}?t=${Date.now()}`;
                // Logo en hero
                const logoContainer = document.getElementById('logo-restaurante');
                const logoImg = document.getElementById('logo-restaurante-img');
                if (logoContainer && logoImg) {
                    logoImg.src = logoUrl;
                    logoContainer.style.display = 'block';
                }
                // Logo en footer
                const footerLogo = document.getElementById('footer-logo');
                if (footerLogo) {
                    footerLogo.src = logoUrl;
                    footerLogo.style.display = 'block';
                }
                // Favicon dinámico
                const favicon = document.getElementById('favicon');
                if (favicon) favicon.href = logoUrl;
            }
        } catch (error) {
            console.error('Error al cargar logo:', error);
        }
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
                `<div class="menu-empty">
                    <i class="fa-solid fa-triangle-exclamation" style="color: #e74c3c;"></i>
                    <p style="color: #e74c3c;">Error al cargar el menú. Por favor, intenta nuevamente.</p>
                </div>`;
        }
    }

    buildCategoriaBtns() {
        const nav = document.querySelector('.menu-cliente-categorias');
        if (!nav) return;

        // Extraer categorías únicas del menú real, en orden de aparición
        const categorias = [...new Set((this.menu || []).map(p => p.categoria).filter(Boolean))];

        // Iconos para categorías conocidas; fa-tag como fallback para cualquier otra
        const iconoMap = {
            'Entradas':       'fa-leaf',
            'Platos Fuertes': 'fa-utensils',
            'Postres':        'fa-cake-candles',
            'Bebidas':        'fa-glass-water'
        };

        // Limpiar botones dinámicos previos (re-renderizado seguro)
        nav.querySelectorAll('.categoria-btn[data-dinamico]').forEach(b => b.remove());

        // Crear un botón por cada categoría encontrada en el menú
        for (const cat of categorias) {
            const icono = iconoMap[cat] || 'fa-tag';
            const btn = document.createElement('button');
            btn.className = 'categoria-btn';
            btn.dataset.categoria = cat;
            btn.dataset.dinamico = '1';
            btn.innerHTML = `<i class="fa-solid ${icono}"></i>`;
            const catSpan = document.createElement('span');
            catSpan.textContent = cat;
            btn.appendChild(catSpan);
            nav.appendChild(btn);
        }

        // Configurar listeners en todos los botones (incluido "Todos")
        nav.querySelectorAll('.categoria-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const boton = e.target.closest('.categoria-btn');
                if (!boton || boton.classList.contains('active')) return;

                nav.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
                boton.classList.add('active');

                const grid = document.getElementById('menu-cliente-grid');
                grid.style.opacity = '0';
                grid.style.transform = 'translateY(10px)';
                grid.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

                setTimeout(() => {
                    this.mostrarMenu(boton.dataset.categoria);
                    grid.style.opacity = '1';
                    grid.style.transform = 'translateY(0)';
                }, 200);
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

        // Ordenar: por categoría y luego alfabéticamente dentro de cada una
        const ordenCategorias = { 'Entradas': 0, 'Platos Fuertes': 1, 'Postres': 2, 'Bebidas': 3 };
        menuFiltrado.sort((a, b) => {
            const catA = ordenCategorias[a.categoria] ?? 99;
            const catB = ordenCategorias[b.categoria] ?? 99;
            if (catA !== catB) return catA - catB;
            return a.nombre.localeCompare(b.nombre, 'es');
        });

        const container = document.getElementById('menu-cliente-grid');
        
        if (menuFiltrado.length === 0) {
            container.innerHTML = `
                <div class="menu-empty">
                    <i class="fa-solid fa-bowl-rice"></i>
                    <p>No hay platillos disponibles en esta categoría</p>
                </div>`;
            return;
        }

        const iconos = {
            'Entradas': '<i class="fa-solid fa-leaf"></i>',
            'Platos Fuertes': '<i class="fa-solid fa-utensils"></i>',
            'Postres': '<i class="fa-solid fa-cake-candles"></i>',
            'Bebidas': '<i class="fa-solid fa-glass-water"></i>'
        };

        const gradientes = {
            'Entradas': 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            'Platos Fuertes': 'linear-gradient(135deg, #e17055 0%, #d63031 100%)',
            'Postres': 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
            'Bebidas': 'linear-gradient(135deg, #0984e3 0%, #74b9ff 100%)'
        };

        container.innerHTML = menuFiltrado.map((platillo, index) => `
            <div class="menu-cliente-item card-hidden" data-index="${index}" data-id="${platillo._id || index}" role="button" tabindex="0" aria-label="Ver detalle de ${this.escapeHTML(platillo.nombre)}">
                <div class="menu-cliente-item-header" style="${!platillo.imagen ? 'background:' + (gradientes[platillo.categoria] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)') : ''}">
                    ${platillo.imagen 
                        ? `<div class="menu-cliente-item-foto"><img src="${platillo.imagen}" alt="${this.escapeHTML(platillo.nombre)}" loading="lazy"></div>` 
                        : `<div class="menu-cliente-item-icono">${iconos[platillo.categoria] || '<i class="fa-solid fa-utensils"></i>'}</div>`
                    }
                    <span class="menu-cliente-item-categoria">
                        ${iconos[platillo.categoria] || '<i class="fa-solid fa-utensils"></i>'}
                        ${this.escapeHTML(platillo.categoria)}
                    </span>
                </div>
                <div class="menu-cliente-item-body">
                    <div class="menu-cliente-item-nombre">${this.escapeHTML(platillo.nombre)}</div>
                    <p class="menu-cliente-item-descripcion">
                        ${this.escapeHTML(platillo.descripcion || 'Delicioso platillo preparado con los mejores ingredientes.')}
                    </p>
                    <div class="menu-cliente-item-footer">
                        <div class="menu-cliente-item-precio">
                            <span class="menu-cliente-item-precio-label">Precio</span>
                            ${this.config.moneda || 'S/'}${platillo.precio.toFixed(2)}
                        </div>
                        <span class="menu-disponible"><i class="fa-solid fa-circle-check"></i> Disponible</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Evento de expansión al hacer click en cualquier tarjeta
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.menu-cliente-item');
            if (card) this._expandirTarjeta(card, menuFiltrado);
        });
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.menu-cliente-item');
                if (card) { e.preventDefault(); this._expandirTarjeta(card, menuFiltrado); }
            }
        });

        // Revelar tarjetas con animación progresiva
        this.revealCards();
    }

    revealCards() {
        const cards = document.querySelectorAll('.menu-cliente-item.card-hidden');
        
        if (!cards.length) return;

        // Usar IntersectionObserver para animar al entrar en viewport
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                // Recoger todas las tarjetas visibles de esta tanda
                const visibleCards = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => {
                        const ai = parseInt(a.target.dataset.index) || 0;
                        const bi = parseInt(b.target.dataset.index) || 0;
                        return ai - bi;
                    });

                visibleCards.forEach((entry, i) => {
                    const card = entry.target;
                    // Stagger máximo de 60ms, tope en 300ms para que no haya esperas largas
                    const delay = Math.min(i * 60, 300);
                    
                    setTimeout(() => {
                        card.classList.remove('card-hidden');
                        card.classList.add('card-visible');
                    }, delay);
                    
                    observer.unobserve(card);
                });
            }, { 
                threshold: 0.05,       // Se activa al ver apenas un 5%
                rootMargin: '50px 0px'  // Empieza 50px antes de llegar al viewport
            });

            cards.forEach(card => observer.observe(card));

            // Fallback de seguridad: si después de 1.5s alguna tarjeta sigue oculta, mostrarla
            setTimeout(() => {
                document.querySelectorAll('.menu-cliente-item.card-hidden').forEach(card => {
                    card.classList.remove('card-hidden');
                    card.classList.add('card-visible');
                });
            }, 1500);
        } else {
            // Navegador sin soporte: mostrar todo directamente
            cards.forEach(card => {
                card.classList.remove('card-hidden');
                card.classList.add('card-visible');
            });
        }
    }

    _expandirTarjeta(cardEl, menuFiltrado) {
        // Evitar doble apertura
        if (document.querySelector('.card-expandida-overlay')) return;

        // Datos del platillo a partir del índice de la tarjeta
        const index = parseInt(cardEl.dataset.index);
        const platillo = menuFiltrado[index];
        if (!platillo) return;

        const iconos = {
            'Entradas':      '<i class="fa-solid fa-leaf"></i>',
            'Platos Fuertes':'<i class="fa-solid fa-utensils"></i>',
            'Postres':       '<i class="fa-solid fa-cake-candles"></i>',
            'Bebidas':       '<i class="fa-solid fa-glass-water"></i>'
        };
        const gradientes = {
            'Entradas':      'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            'Platos Fuertes':'linear-gradient(135deg, #e17055 0%, #d63031 100%)',
            'Postres':       'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
            'Bebidas':       'linear-gradient(135deg, #0984e3 0%, #74b9ff 100%)'
        };

        // ── 1. Capturar posición de origen ──────────────────────────────
        const origen = cardEl.getBoundingClientRect();

        // ── 2. Overlay oscuro ────────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.className = 'card-expandida-overlay';
        document.body.appendChild(overlay);
        // Forzar reflow para que la transición arranque
        overlay.getBoundingClientRect();
        overlay.classList.add('card-expandida-overlay--visible');

        // ── 3. Clonar la tarjeta con descripción completa ────────────────
        const clone = document.createElement('div');
        clone.className = 'menu-cliente-item card-expandida-clone';
        clone.setAttribute('role', 'dialog');
        clone.setAttribute('aria-modal', 'true');
        clone.setAttribute('aria-label', platillo.nombre);
        clone.innerHTML = `
            <button class="card-expandida-cerrar" aria-label="Cerrar">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="menu-cliente-item-header" style="${!platillo.imagen ? 'background:' + (gradientes[platillo.categoria] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)') : ''}">
                ${platillo.imagen
                    ? `<div class="menu-cliente-item-foto"><img src="${platillo.imagen}" alt="${this.escapeHTML(platillo.nombre)}"></div>`
                    : `<div class="menu-cliente-item-icono">${iconos[platillo.categoria] || '<i class="fa-solid fa-utensils"></i>'}</div>`
                }
                <span class="menu-cliente-item-categoria">
                    ${iconos[platillo.categoria] || '<i class="fa-solid fa-utensils"></i>'}
                    ${this.escapeHTML(platillo.categoria)}
                </span>
            </div>
            <div class="menu-cliente-item-body">
                <div class="menu-cliente-item-nombre">${this.escapeHTML(platillo.nombre)}</div>
                <p class="menu-cliente-item-descripcion card-expandida-desc">
                    ${this.escapeHTML(platillo.descripcion || 'Delicioso platillo preparado con los mejores ingredientes.')}
                </p>
                <div class="menu-cliente-item-footer">
                    <div class="menu-cliente-item-precio">
                        <span class="menu-cliente-item-precio-label">Precio</span>
                        ${this.config.moneda || 'S/'}${platillo.precio.toFixed(2)}
                    </div>
                    <span class="menu-disponible"><i class="fa-solid fa-circle-check"></i> Disponible</span>
                </div>
            </div>
        `;
        document.body.appendChild(clone);

        // ── 4. Posición destino: centrado en viewport ────────────────────
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const targetW = Math.min(420, vw * 0.92);
        const targetH = clone.offsetHeight; // altura natural con desc completa
        const targetX = (vw - targetW) / 2;
        const targetY = Math.max(20, (vh - targetH) / 2);

        // ── 5. Posición inicial = encima de la tarjeta original ──────────
        clone.style.cssText = `
            position: fixed;
            width: ${origen.width}px;
            left: ${origen.left}px;
            top: ${origen.top}px;
            transform-origin: center center;
            z-index: 10001;
            transition: none;
            will-change: left, top, width;
        `;

        // Forzar reflow antes de aplicar la transición
        clone.getBoundingClientRect();

        // ── 6. Animar hacia el centro ────────────────────────────────────
        clone.style.transition = 'left 0.38s cubic-bezier(0.4,0,0.2,1), top 0.38s cubic-bezier(0.4,0,0.2,1), width 0.38s cubic-bezier(0.4,0,0.2,1), box-shadow 0.38s ease';
        clone.style.left      = `${targetX}px`;
        clone.style.top       = `${targetY}px`;
        clone.style.width     = `${targetW}px`;
        clone.style.boxShadow = '0 32px 80px rgba(0,0,0,0.35)';

        // ── 7. Cerrar ────────────────────────────────────────────────────
        const cerrar = () => {
            // Animar de vuelta al origen
            clone.style.transition = 'left 0.3s cubic-bezier(0.4,0,0.2,1), top 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, box-shadow 0.3s ease';
            clone.style.left      = `${origen.left}px`;
            clone.style.top       = `${origen.top}px`;
            clone.style.width     = `${origen.width}px`;
            clone.style.opacity   = '0';
            clone.style.boxShadow = 'none';

            overlay.classList.remove('card-expandida-overlay--visible');

            clone.addEventListener('transitionend', () => {
                clone.remove();
                overlay.remove();
            }, { once: true });
        };

        clone.querySelector('.card-expandida-cerrar').addEventListener('click', (e) => {
            e.stopPropagation();
            cerrar();
        });
        overlay.addEventListener('click', cerrar);
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
        });
    }
}

// Inicializar
new ClienteApp();
