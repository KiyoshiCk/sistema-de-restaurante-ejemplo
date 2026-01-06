// config.js - Configuración dinámica de API
const getAPIURL = () => {
    // En desarrollo local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // En Netlify: usa /api (redirige a Netlify Functions)
    return '/api';
};

const API_CONFIG = {
    url: getAPIURL()
};
