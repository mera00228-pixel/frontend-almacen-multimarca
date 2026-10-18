import { api, getToken, getUsuario, logout } from './api.js';

if (!getToken()) {
    window.location.replace('/');
}

const $ = (id) => document.getElementById(id);

const tablaBody = $('tablaBody');
const aviso = $('aviso');
const botonNuevo = $('btnNuevo');
const botonLogout = $('btnLogout');
const buscador = $('buscador');

const modal = $('modalProducto');
const modalTitulo = $('modalTitulo');
const formProducto = $('formProducto');
const avisoForm = $('avisoForm');
const botonGuardar = $('btnGuardar');
const botonCancelar = $('btnCancelar');
const botonCerrarModal = $('btnCerrarModal');

let productos = [];
let editandoId = null;
let imagenEditando = null;

const moneda = (valor) => `S/ ${Number(valor).toFixed(2)}`;

const escapar = (texto) =>
    String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

function pintar(lista) {
    const termino = buscador.value.trim().toLowerCase();
    const filtrados = termino
        ? lista.filter((p) =>
              p.nombre.toLowerCase().includes(termino) ||
              (p.codigo_barras || '').toLowerCase().includes(termino)
          )
        : lista;

    if (filtrados.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="11" class="celda-vacia">No hay productos que coincidan.</td></tr>';
        $('totalProductos').textContent = '';
        $('valorInventario').textContent = '';
        return;
    }

    tablaBody.innerHTML = filtrados.map((p) => {
        const stockBajo = p.stock <= (p.stock_minimo ?? 5);
        const activo = Number(p.estado) === 1;
        return `
        <tr>
            <td><img class="thumb" src="${escapar(p.imagen_url) || '/img/producto-default.svg'}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/img/producto-default.svg'"></td>
            <td>${p.id}</td>
            <td class="mono">${escapar(p.codigo_barras) || '-'}</td>
            <td>
              <strong>${escapar(p.nombre)}</strong>
              ${p.descripcion ? `<small class="descripcion">${escapar(p.descripcion)}</small>` : ''}
            </td>
            <td>${p.marca_id ?? '-'}</td>
            <td>${p.categoria_id ?? '-'}</td>
            <td>${moneda(p.precio_compra)}</td>
            <td>${moneda(p.precio_venta)}</td>
            <td>
              <span class="badge ${stockBajo ? 'badge-peligro' : 'badge-ok'}">${p.stock}</span>
              ${stockBajo ? '<small class="stock-bajo">stock bajo</small>' : ''}
            </td>
            <td><span class="badge ${activo ? 'badge-ok' : 'badge-inactivo'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="acciones">
              <button class="btn btn-mini" data-accion="editar" data-id="${p.id}">Editar</button>
              <button class="btn btn-mini btn-peligro" data-accion="eliminar" data-id="${p.id}">Eliminar</button>
            </td>
        </tr>`;
    }).join('');

    const total = filtrados.reduce((s, p) => s + p.stock, 0);
    const valor = filtrados.reduce((s, p) => s + Number(p.precio_venta) * p.stock, 0);
    $('totalProductos').textContent = `${filtrados.length} producto(s) · ${total} unidades`;
    $('valorInventario').textContent = `Valor de inventario: ${moneda(valor)}`;
}

async function cargarProductos() {
    try {
        aviso.textContent = '';
        tablaBody.innerHTML = '<tr><td colspan="11" class="celda-vacia">Cargando productos...</td></tr>';
        productos = await api('/productos');
        if (!Array.isArray(productos)) {
            throw new Error('El backend devolvió una respuesta inesperada. Verifique que API_URL termine en /api.');
        }
        pintar(productos);
    } catch (error) {
        if (getToken()) {
            tablaBody.innerHTML = `<tr><td colspan="10" class="celda-vacia">${error.message}</td></tr>`;
        }
    }
}

function abrirModal(producto = null) {
    editandoId = producto ? producto.id : null;
    imagenEditando = producto?.imagen_url ?? null;
    modalTitulo.textContent = producto ? `Editar producto #${producto.id}` : 'Nuevo producto';
    avisoForm.textContent = '';

    formProducto.reset();
    $('productoId').value = producto ? producto.id : '';
    $('codigo_barras').value = producto ? producto.codigo_barras : '';
    $('nombre').value = producto ? producto.nombre : '';
    $('descripcion').value = producto ? (producto.descripcion || '') : '';
    $('precio_compra').value = producto ? producto.precio_compra : '';
    $('precio_venta').value = producto ? producto.precio_venta : '';
    $('stock').value = producto ? producto.stock : '';
    $('stock_minimo').value = producto ? producto.stock_minimo : 5;
    $('marca_id').value = producto?.marca_id ?? '';
    $('categoria_id').value = producto?.categoria_id ?? '';
    $('estado').value = producto ? producto.estado : 1;

    modal.classList.remove('oculto');
    modal.classList.add('visible');
}

function cerrarModal() {
    modal.classList.add('oculto');
    modal.classList.remove('visible');
}

function leerFormulario() {
    return {
        codigo_barras: $('codigo_barras').value.trim(),
        nombre: $('nombre').value.trim(),
        descripcion: $('descripcion').value.trim(),
        imagen_url: imagenEditando,
        precio_compra: Number($('precio_compra').value),
        precio_venta: Number($('precio_venta').value),
        stock: Number($('stock').value),
        stock_minimo: Number($('stock_minimo').value),
        marca_id: $('marca_id').value ? Number($('marca_id').value) : null,
        categoria_id: $('categoria_id').value ? Number($('categoria_id').value) : null,
        estado: Number($('estado').value)
    };
}

formProducto.addEventListener('submit', async (e) => {
    e.preventDefault();
    avisoForm.textContent = '';
    botonGuardar.disabled = true;

    const producto = leerFormulario();
    const ruta = editandoId ? `/productos/${editandoId}` : '/productos';
    const metodo = editandoId ? 'PUT' : 'POST';

    try {
        await api(ruta, { method: metodo, body: producto });
        cerrarModal();
        await cargarProductos();
    } catch (error) {
        avisoForm.textContent = error.message;
    } finally {
        botonGuardar.disabled = false;
    }
});

tablaBody.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;

    const id = Number(boton.dataset.id);
    const accion = boton.dataset.accion;
    const producto = productos.find((p) => p.id === id);

    if (accion === 'editar') {
        abrirModal(producto);
        return;
    }

    if (accion === 'eliminar') {
        if (!confirm(`¿Eliminar el producto "${producto.nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            await api(`/productos/${id}`, { method: 'DELETE' });
            await cargarProductos();
        } catch (error) {
            aviso.textContent = error.message;
        }
    }
});

botonNuevo.addEventListener('click', () => abrirModal());
botonCancelar.addEventListener('click', cerrarModal);
botonCerrarModal.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
});
botonLogout.addEventListener('click', logout);
buscador.addEventListener('input', () => pintar(productos));

$('usuarioLabel').textContent = getUsuario() ? `Usuario: ${getUsuario()}` : '';
cargarProductos();
