import { Router } from 'express';

const router = Router();

// Página principal - Login
router.get('/', (req, res) => {
    res.render('login');
});

// Pantalla productos
router.get('/productos', (req, res) => {
    res.render('productos');
});

export default router;