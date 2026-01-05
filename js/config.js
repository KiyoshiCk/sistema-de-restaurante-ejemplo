// config.js - Configuración dinámica de API
const getAPIURL = () => {
    // En desarrollo
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // En producción - obtener del localStorage o variable global
    return window.__API_URL__ || 'https://tu-backend-url.com/api';
};

const API_CONFIG = {
    url: getAPIURL()
};
