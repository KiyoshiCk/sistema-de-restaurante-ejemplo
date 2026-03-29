// config.js - Configuración dinámica de API
const getAPIURL = () => {
    const hostname = window.location.hostname;
    
    // En desarrollo local (localhost o 127.0.0.1)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // En red local (IPs privadas como 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
        return `http://${hostname}:3000/api`;
    }
    
    // En producción: usa /api
    return '/api';
};

const getSocketURL = () => {
    const hostname = window.location.hostname;
    
    // En desarrollo local (localhost o 127.0.0.1)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // En red local (IPs privadas)
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
        return `http://${hostname}:3000`;
    }
    
    // En producción
    return window.location.origin;
};

const API_CONFIG = {
    url: getAPIURL(),
    socketUrl: getSocketURL()
};
