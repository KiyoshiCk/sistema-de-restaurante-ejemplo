// Botón flotante de ubicación — solo visible mientras el usuario está navegando el menú
// Se oculta en la portada (hero) y en el footer para no estorbar ni duplicar info
(function() {
    const API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
        ? API_CONFIG.url : 'http://localhost:3000/api';

    async function addUbicacionBtn() {
        try {
            const res = await fetch(`${API_URL}/config`);
            const data = await res.json();

            // No mostrar si no hay datos de ubicación configurados
            const tieneUbicacion = (data.lat && data.lng) || data.direccion;
            if (!tieneUbicacion) return;

            let url = '';
            if (data.lat && data.lng) {
                url = `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;
            } else {
                url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.direccion + ', ' + (data.ciudad || ''))}`;
            }

            const btn = document.createElement('a');
            btn.href = url;
            btn.target = '_blank';
            btn.rel = 'noopener';
            // Empieza oculto — el observer decide cuando mostrarlo
            btn.className = 'btn-ubicacion-maps-floating ubicacion-btn-oculto';
            btn.setAttribute('aria-label', 'Ver ubicación en Google Maps');
            btn.innerHTML = '<i class="fa-solid fa-location-dot"></i><span class="ubicacion-label">Ubícanos</span>';
            document.body.appendChild(btn);

            if (!('IntersectionObserver' in window)) {
                // Sin soporte → mostrar siempre
                btn.classList.remove('ubicacion-btn-oculto');
                return;
            }

            // Ocultar cuando el hero O el footer están en pantalla
            // Hero:   el usuario ve la portada — ahí está "Explorar Menú", el botón molestaría
            // Footer: el usuario ya ve la dirección — el botón duplicaría info
            // Visible solo en el tramo del menú, donde es realmente útil
            let heroVisible   = true; // empieza en el hero
            let footerVisible = false;

            const update = () => {
                btn.classList.toggle('ubicacion-btn-oculto', heroVisible || footerVisible);
            };

            const heroEl   = document.querySelector('.parallax-hero');
            const footerEl = document.querySelector('.cliente-footer');

            if (heroEl) {
                new IntersectionObserver(
                    ([entry]) => { heroVisible = entry.isIntersecting; update(); },
                    { threshold: 0.05 }
                ).observe(heroEl);
            }

            if (footerEl) {
                new IntersectionObserver(
                    ([entry]) => { footerVisible = entry.isIntersecting; update(); },
                    { threshold: 0.05 }
                ).observe(footerEl);
            }

        } catch (e) {
            // No mostrar botón si falla la carga
        }
    }

    document.addEventListener('DOMContentLoaded', addUbicacionBtn);
})();
