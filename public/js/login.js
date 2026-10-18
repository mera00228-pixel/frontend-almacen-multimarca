import { api, setToken, getToken } from './api.js';

if (getToken()) {
    window.location.replace('/productos');
}

const formulario = document.getElementById('formLogin');
const mensaje = document.getElementById('mensaje');
const boton = document.getElementById('btnIngresar');

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const contraseña = document.getElementById('contraseña').value;

    if (!usuario || !contraseña) {
        mensaje.textContent = 'Ingrese usuario y contraseña';
        return;
    }

    mensaje.textContent = '';
    boton.disabled = true;
    boton.textContent = 'Ingresando...';

    try {
        const datos = await api('/login', {
            method: 'POST',
            body: { usuario, contraseña },
            auth: false
        });

        setToken(datos.token);
        window.location.href = '/productos';
    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        boton.disabled = false;
        boton.textContent = 'Ingresar';
    }
});