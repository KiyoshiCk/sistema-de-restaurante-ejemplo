// Script para formulario y mapa de ubicación en admin
(function() {
    const API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.url)
        ? API_CONFIG.url : 'http://localhost:3000/api';
    let marker, map;
    let ubicacion = {
        ciudad: '', barrio: '', direccion: '', region: '', codigoPostal: '', lat: null, lng: null
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
                    const latGuardada = parseFloat(document.getElementById('lat').value);
                    const lngGuardada = parseFloat(document.getElementById('lng').value);
                    const tieneCoords = !isNaN(latGuardada) && !isNaN(lngGuardada);

                    const iniciarMapa = (lat, lng, zoom) => {
                        map = L.map('mapa-ubicacion').setView([lat, lng], zoom);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '\u00a9 OpenStreetMap'
                        }).addTo(map);
                        if (tieneCoords) {
                            marker = L.marker([latGuardada, lngGuardada], { draggable: true }).addTo(map);
                        } else {
                            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
                            document.getElementById('lat').value = lat.toFixed(6);
                            document.getElementById('lng').value = lng.toFixed(6);
                        }
                        marker.on('dragend', function() {
                            const pos = marker.getLatLng();
                            document.getElementById('lat').value = pos.lat.toFixed(6);
                            document.getElementById('lng').value = pos.lng.toFixed(6);
                        });
                        map.on('click', function(e) {
                            marker.setLatLng(e.latlng);
                            document.getElementById('lat').value = e.latlng.lat.toFixed(6);
                            document.getElementById('lng').value = e.latlng.lng.toFixed(6);
                        });
                    };

                    if (tieneCoords) {
                        // Coords ya guardadas — centrar en ellas
                        iniciarMapa(latGuardada, lngGuardada, 15);
                    } else if (navigator.geolocation) {
                        // Sin coords — usar ubicación real del navegador
                        navigator.geolocation.getCurrentPosition(
                            pos => iniciarMapa(pos.coords.latitude, pos.coords.longitude, 15),
                            ()  => iniciarMapa(20, 0, 2)  // permiso denegado — vista mundial
                        );
                    } else {
                        iniciarMapa(20, 0, 2); // sin geolocation API — vista mundial
                    }
                } else {
                    map.invalidateSize();
                }
            });
        });
    });
})();
