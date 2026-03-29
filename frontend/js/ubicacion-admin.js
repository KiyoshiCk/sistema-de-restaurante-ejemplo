// Script para formulario y mapa de ubicación en admin
(function() {
    const API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
        ? API_CONFIG.url : 'http://localhost:3000/api';
    let marker, map;
    let ubicacion = {
        ciudad: '', barrio: '', direccion: '', region: '', codigoPostal: '', lat: -8.1713, lng: -78.5143
    };

    async function cargarUbicacion() {
        try {
            const res = await fetch(`${API_URL}/config`);
            const data = await res.json();
            ubicacion = data;
            // Ubicación
            document.getElementById('ciudad').value = data.ciudad || '';
            document.getElementById('barrio').value = data.barrio || '';
            document.getElementById('direccion').value = data.direccion || '';
            document.getElementById('region').value = data.region || '';
            document.getElementById('codigoPostal').value = data.codigoPostal || '';
            document.getElementById('lat').value = data.lat || '';
            document.getElementById('lng').value = data.lng || '';

            // Datos del restaurante
            const campos = [
                'nombre', 'slogan', 'descripcion', 'telefono', 'email', 'whatsapp',
                'horarioSemana', 'horarioDomingo', 'horaAbre', 'horaCierra',
                'horaAbreDom', 'horaCierraDom', 'metodosPago', 'moneda', 'monedaCodigo', 'cocinas'
            ];
            for (const c of campos) {
                const el = document.getElementById(`cfg-${c}`);
                if (el && data[c] !== undefined) el.value = data[c];
            }
        } catch (e) {
            console.error('Error cargando configuración', e);
        }
    }

    // Exponer globalmente para que admin.js la llame al navegar a la sección
    window.cargarUbicacionAdmin = cargarUbicacion;

    function mostrarExito(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 2500);
    }

    async function guardarConfig(datos, exitoId) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(datos)
            });
            if (res.ok) {
                mostrarExito(exitoId);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || `Error al guardar (${res.status}). Verifica que estés logueado como admin.`);
            }
        } catch (e) {
            alert('Error de conexión al guardar. Verifica que el servidor esté activo.');
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        cargarUbicacion();

        // === FORM: Datos del Restaurante ===
        const formDatos = document.getElementById('form-datos-restaurante');
        if (formDatos) {
            formDatos.addEventListener('submit', function(e) {
                e.preventDefault();
                const campos = [
                    'nombre', 'slogan', 'descripcion', 'telefono', 'email', 'whatsapp',
                    'horarioSemana', 'horarioDomingo', 'horaAbre', 'horaCierra',
                    'horaAbreDom', 'horaCierraDom', 'metodosPago', 'moneda', 'monedaCodigo', 'cocinas'
                ];
                const datos = {};
                for (const c of campos) {
                    const el = document.getElementById(`cfg-${c}`);
                    if (el) datos[c] = el.value;
                }
                guardarConfig(datos, 'datos-restaurante-guardado');
            });
        }

        // === FORM: Ubicación ===
        document.getElementById('form-ubicacion').addEventListener('submit', function(e) {
            e.preventDefault();
            const datos = {
                ciudad: document.getElementById('ciudad').value,
                barrio: document.getElementById('barrio').value,
                direccion: document.getElementById('direccion').value,
                region: document.getElementById('region').value,
                codigoPostal: document.getElementById('codigoPostal').value,
                lat: parseFloat(document.getElementById('lat').value),
                lng: parseFloat(document.getElementById('lng').value)
            };
            guardarConfig(datos, 'ubicacion-guardada');
        });

        // === MAPA ===
        document.getElementById('btn-mapa').addEventListener('click', function() {
            const mapaEl = document.getElementById('mapa-ubicacion');
            if (mapaEl.style.display === 'block') {
                mapaEl.style.display = 'none';
                return;
            }
            mapaEl.style.display = 'block';
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
