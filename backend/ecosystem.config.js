module.exports = {
    apps: [{
        name: 'restaurante-backend',
        script: 'server.js',
        cwd: __dirname,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '300M',
        restart_delay: 2000,
        max_restarts: 20,
        min_uptime: '5s',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: '../logs/backend-error.log',
        out_file: '../logs/backend-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true
    }]
};
