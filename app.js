import express from 'express';
import routes from './routes/routes.views.js';

const app = express();

// Detrás del proxy de Railway/Render
app.set('trust proxy', 1);

// Configuración EJS
app.set('view engine', 'ejs');

// URL del backend (en Railway se define con la variable de entorno API_URL)
const API_URL = process.env.API_URL || 'https://backend-almacen-multimarca.onrender.com/api';
app.locals.apiUrl = API_URL;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Archivos públicos (CSS, imágenes, JS)
app.use(express.static('public'));

// Healthcheck para Railway
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Rutas
app.use('/', routes);

// Puerto (Railway inyecta la variable PORT)
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});