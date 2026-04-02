// Botón flotante de ubicación — solo visible cuando el footer NO está en pantalla
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
            btn.className = 'btn-ubicacion-maps-floating';
            btn.setAttribute('aria-label', 'Ver ubicación en Google Maps');
            btn.innerHTML = '<i class="fa-solid fa-location-dot"></i><span class="ubicacion-label">Ubícanos</span>';
            document.body.appendChild(btn);

            // Ocultar el botón cuando el footer es visible — ya muestra la dirección ahí
            // Evita que tape el contenido del menú Y que duplique info con el footer
            const footer = document.querySelector('.cliente-footer');
            if (footer && 'IntersectionObserver' in window) {
                const observer = new IntersectionObserver(
                    ([entry]) => {
                        // footer visible → ocultar botón (el usuario ya ve la dirección)
                        // footer oculto  → mostrar botón (el usuario está en el menú)
                        btn.classList.toggle('ubicacion-btn-oculto', entry.isIntersecting);
                    },
                    { threshold: 0.05 } // se activa apenas el 5% del footer entra en vista
                );
                observer.observe(footer);
            }
        } catch (e) {
            // No mostrar botón si falla la carga
        }
    }

    document.addEventListener('DOMContentLoaded', addUbicacionBtn);
})();
