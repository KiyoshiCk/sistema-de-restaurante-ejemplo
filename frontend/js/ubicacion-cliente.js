// Botón y lógica para mostrar ubicación en Google Maps desde cliente
(function() {
    const API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
        ? API_CONFIG.url : 'http://localhost:3000/api';
    async function addUbicacionBtn() {
        try {
            const res = await fetch(`${API_URL}/config`);
            const data = await res.json();
            let label = 'Ubícanos';
            let url = '';
            if (data.lat && data.lng) {
                url = `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;
            } else if (data.direccion) {
                url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.direccion + ', ' + (data.ciudad||''))}`;
            } else {
                url = 'https://www.google.com/maps';
            }
            const btn = document.createElement('a');
            btn.href = url;
            btn.target = '_blank';
            btn.rel = 'noopener';
            btn.className = 'btn-ubicacion-maps-floating';
            btn.innerHTML = '<i class="fa-solid fa-location-dot"></i><span class="ubicacion-label">' + label + '</span>';
            document.body.appendChild(btn);
        } catch (e) {
            // No mostrar botón si falla
        }
    }
    document.addEventListener('DOMContentLoaded', addUbicacionBtn);
})();
