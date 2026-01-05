// config.js - Configuración dinámica de API
const getAPIURL = () => {
    // En desarrollo
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // En producción:
    // - si defines window.__API_URL__ (por ejemplo, inyectándolo), se usa eso
    // - caso contrario, usa /api (y Netlify hará proxy con netlify.toml)
    return window.__API_URL__ || '/api';
};

const API_CONFIG = {
    url: getAPIURL()
};
