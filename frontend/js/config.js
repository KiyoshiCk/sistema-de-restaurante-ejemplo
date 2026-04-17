// config.js - Configuración dinámica de API
// El frontend es servido por el mismo servidor Express en el puerto 3000,
// por lo que siempre usamos la misma origen para la API y el socket.
const getAPIURL = () => `${window.location.protocol}//${window.location.host}/api`;
const getSocketURL = () => `${window.location.protocol}//${window.location.host}`;

const API_CONFIG = {
    url: getAPIURL(),
    socketUrl: getSocketURL()
};
