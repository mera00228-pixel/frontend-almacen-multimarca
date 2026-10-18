const API_URL = (window.__API_URL__ || 'https://backend-almacen-multimarca-production-b0d5.up.railway.app/api').replace(/\/+$/, '');
const TOKEN_KEY = 'token';
const TIMEOUT_MS = 15000;

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function getUsuario() {
    const token = getToken();
    if (!token) return '';
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload)).usuario || '';
    } catch {
        return '';
    }
}

export function logout() {
    clearToken();
    window.location.href = '/';
}

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export async function api(endpoint, { method = 'GET', body = null, auth = true } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth) {
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const controlador = new AbortController();
    const reloj = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            signal: controlador.signal
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new ApiError('El servidor tardó demasiado en responder. El backend puede estar iniciando, intente de nuevo.', 0);
        }
        throw new ApiError(`No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_URL}.`, 0);
    } finally {
        clearTimeout(reloj);
    }

    let datos = null;
    try {
        datos = await respuesta.json();
    } catch {
        datos = null;
    }

    if (respuesta.status === 401 && auth) {
        logout();
    }

    if (!respuesta.ok) {
        throw new ApiError(datos?.error || `Error del servidor (${respuesta.status})`, respuesta.status);
    }

    return datos;
}