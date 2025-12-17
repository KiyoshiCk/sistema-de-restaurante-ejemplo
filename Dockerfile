# Usar imagen oficial de nginx
FROM nginx:alpine

# Copiar archivos de la aplicación al directorio de nginx
COPY index.html /usr/share/nginx/html/
COPY cliente.html /usr/share/nginx/html/
COPY admin.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Exponer el puerto 80
EXPOSE 80

# nginx se ejecuta automáticamente con la imagen base
CMD ["nginx", "-g", "daemon off;"]
