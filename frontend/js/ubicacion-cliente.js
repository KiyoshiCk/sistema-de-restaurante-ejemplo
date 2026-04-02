// Botón flotante de ubicación — visible siempre excepto cuando el footer está en pantalla
// (el footer ya muestra la dirección; en el hero el botón está posicionado para no tapar "Explorar Menú")
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

            // Ocultar solo cuando el footer es visible — ya muestra la dirección ahí
            const footerEl = document.querySelector('.cliente-footer');
            if (footerEl && 'IntersectionObserver' in window) {
                new IntersectionObserver(
                    ([entry]) => {
                        btn.classList.toggle('ubicacion-btn-oculto', entry.isIntersecting);
                    },
                    { threshold: 0.05 }
                ).observe(footerEl);
            }

        } catch (e) {
            // No mostrar botón si falla la carga
        }
    }

    document.addEventListener('DOMContentLoaded', addUbicacionBtn);
})();
