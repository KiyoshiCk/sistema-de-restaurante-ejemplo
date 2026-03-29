// Carga dinámica de Leaflet solo cuando se usa el mapa
function loadLeafletAssets(callback) {
    if (window.L && window.L.map) {
        callback();
        return;
    }
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCss);
    const leafletJs = document.createElement('script');
    leafletJs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletJs.onload = callback;
    document.body.appendChild(leafletJs);
}

window.loadLeafletAssets = loadLeafletAssets;
