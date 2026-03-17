// Script para formulario y mapa de ubicación en admin
(function() {
    const API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
        ? API_CONFIG.url : 'http://localhost:3000/api';
    let marker, map;
    let ubicacion = {
        ciudad: '', barrio: '', direccion: '', lat: -8.1713, lng: -78.5143
    };

    async function cargarUbicacion() {
        try {
            const res = await fetch(`${API_URL}/config`);
            const data = await res.json();
            ubicacion = data;
            document.getElementById('ciudad').value = data.ciudad || '';
            document.getElementById('barrio').value = data.barrio || '';
            document.getElementById('direccion').value = data.direccion || '';
            document.getElementById('lat').value = data.lat || '';
            document.getElementById('lng').value = data.lng || '';
        } catch (e) {
            console.error('Error cargando ubicación', e);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        cargarUbicacion();
        document.getElementById('form-ubicacion').addEventListener('submit', async function(e) {
            e.preventDefault();
            const ciudad = document.getElementById('ciudad').value;
            const barrio = document.getElementById('barrio').value;
            const direccion = document.getElementById('direccion').value;
            const lat = parseFloat(document.getElementById('lat').value);
            const lng = parseFloat(document.getElementById('lng').value);
            try {
                const res = await fetch(`${API_URL}/config`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ciudad, barrio, direccion, lat, lng })
                });
                if (res.ok) {
                    document.getElementById('ubicacion-guardada').style.display = 'block';
                    setTimeout(()=>{
                        document.getElementById('ubicacion-guardada').style.display = 'none';
                    }, 2000);
                }
            } catch (e) {
                alert('Error guardando ubicación');
            }
        });
        document.getElementById('btn-mapa').addEventListener('click', function() {
            document.getElementById('mapa-ubicacion').style.display = 'block';
            window.loadLeafletAssets(() => {
                if (!map) {
                    map = L.map('mapa-ubicacion').setView([
                        parseFloat(document.getElementById('lat').value) || -8.1713,
                        parseFloat(document.getElementById('lng').value) || -78.5143
                    ], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap'
                    }).addTo(map);
                    marker = L.marker([
                        parseFloat(document.getElementById('lat').value) || -8.1713,
                        parseFloat(document.getElementById('lng').value) || -78.5143
                    ], { draggable: true }).addTo(map);
                    marker.on('dragend', function(e) {
                        const pos = marker.getLatLng();
                        document.getElementById('lat').value = pos.lat.toFixed(6);
                        document.getElementById('lng').value = pos.lng.toFixed(6);
                    });
                    map.on('click', function(e) {
                        marker.setLatLng(e.latlng);
                        document.getElementById('lat').value = e.latlng.lat.toFixed(6);
                        document.getElementById('lng').value = e.latlng.lng.toFixed(6);
                    });
                } else {
                    map.invalidateSize();
                }
            });
        });
    });
})();
