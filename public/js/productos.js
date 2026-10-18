import { api, getToken, getUsuario, logout } from './api.js';
import { exportarPDF, exportarExcel } from './reportes.js';

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

const modalMovimiento = $('modalMovimiento');
const formMovimiento = $('formMovimiento');
const movimientoAviso = $('movimientoAviso');
const botonRegistrarMovimiento = $('btnRegistrarMovimiento');

let productos = [];
let editandoId = null;

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
const formatoMoneda = (valor) => moneda.format(Number(valor));

const escapar = (texto) =>
    String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const etiqueta = (texto, clase) =>
    texto ? `<span class="badge ${clase}">${escapar(texto)}</span>` : '-';

function pintar(lista) {
    const termino = buscador.value.trim().toLowerCase();
    const filtrados = termino
        ? lista.filter((p) =>
              p.nombre.toLowerCase().includes(termino) ||
              (p.codigo_barras || '').toLowerCase().includes(termino) ||
              (p.marca_nombre || '').toLowerCase().includes(termino) ||
              (p.categoria_nombre || '').toLowerCase().includes(termino)
          )
        : lista;

    if (filtrados.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="11" class="celda-vacia">No hay productos que coincidan.</td></tr>';
        return;
    }

    tablaBody.innerHTML = filtrados.map((p) => {
        const stockBajo = p.stock < 10 || p.stock <= (p.stock_minimo ?? 5);
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
            <td>${etiqueta(p.marca_nombre, 'badge-marca')}</td>
            <td>${etiqueta(p.categoria_nombre, 'badge-categoria')}</td>
            <td>${formatoMoneda(p.precio_compra)}</td>
            <td>${formatoMoneda(p.precio_venta)}</td>
            <td>
              <span class="badge ${stockBajo ? 'badge-peligro' : 'badge-ok'}">${p.stock}</span>
              ${stockBajo ? '<small class="stock-bajo">Stock Bajo</small>' : ''}
            </td>
            <td><span class="badge ${activo ? 'badge-ok' : 'badge-inactivo'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="acciones">
              <button class="btn btn-mini" data-accion="entrada" data-id="${p.id}" title="Registrar entrada">+ Entrada</button>
              <button class="btn btn-mini" data-accion="salida" data-id="${p.id}" title="Registrar salida">− Salida</button>
              <button class="btn btn-mini" data-accion="editar" data-id="${p.id}">Editar</button>
              <button class="btn btn-mini btn-peligro" data-accion="eliminar" data-id="${p.id}">Eliminar</button>
            </td>
        </tr>`;
    }).join('');
}

function actualizarKpis(lista) {
    const totalProductos = lista.length;
    const stockTotal = lista.reduce((s, p) => s + Number(p.stock), 0);
    const valorInventario = lista.reduce((s, p) => s + Number(p.precio_venta) * Number(p.stock), 0);
    const alertas = lista.filter((p) => p.stock < 10 || p.stock <= (p.stock_minimo ?? 5)).length;

    $('kpiProductos').textContent = totalProductos;
    $('kpiStock').textContent = stockTotal;
    $('kpiValor').textContent = formatoMoneda(valorInventario);
    $('kpiAlertas').textContent = alertas;
}

async function cargarProductos() {
    try {
        aviso.textContent = '';
        tablaBody.innerHTML = '<tr><td colspan="11" class="celda-vacia">Cargando productos...</td></tr>';
        productos = await api('/productos');
        if (!Array.isArray(productos)) {
            throw new Error('El backend devolvió una respuesta inesperada. Verifique que API_URL termine en /api.');
        }
        actualizarKpis(productos);
        pintar(productos);
    } catch (error) {
        if (getToken()) {
            tablaBody.innerHTML = `<tr><td colspan="11" class="celda-vacia">${error.message}</td></tr>`;
        }
    }
}

function actualizarPreview() {
    const url = $('imagen_url').value.trim();
    const preview = $('imagenPreview');
    if (url) {
        preview.src = url;
        preview.classList.remove('oculto');
    } else {
        preview.classList.add('oculto');
        preview.removeAttribute('src');
    }
}

function abrirModal(producto = null) {
    editandoId = producto ? producto.id : null;
    modalTitulo.textContent = producto ? `Editar producto #${producto.id}` : 'Nuevo producto';
    avisoForm.textContent = '';

    formProducto.reset();
    $('productoId').value = producto ? producto.id : '';
    $('codigo_barras').value = producto ? producto.codigo_barras : '';
    $('nombre').value = producto ? producto.nombre : '';
    $('descripcion').value = producto ? (producto.descripcion || '') : '';
    $('imagen_url').value = producto?.imagen_url ?? '';
    actualizarPreview();
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
        imagen_url: $('imagen_url').value.trim() || null,
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

    if (accion === 'entrada' || accion === 'salida') {
        abrirMovimiento(producto, accion);
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

function abrirMovimiento(producto, tipo) {
    if (!producto) return;

    movimientoAviso.textContent = '';
    formMovimiento.reset();
    $('movimientoProductoId').value = producto.id;
    $('movimientoTipo').value = tipo;
    $('movimientoTitulo').textContent = tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida';
    $('movimientoProducto').textContent = `${producto.nombre} (ID ${producto.id})`;
    $('movimientoStockActual').textContent = producto.stock;
    $('movimientoCantidad').focus();

    modalMovimiento.classList.remove('oculto');
    modalMovimiento.classList.add('visible');
}

function cerrarMovimiento() {
    modalMovimiento.classList.add('oculto');
    modalMovimiento.classList.remove('visible');
}

formMovimiento.addEventListener('submit', async (e) => {
    e.preventDefault();
    movimientoAviso.textContent = '';
    botonRegistrarMovimiento.disabled = true;

    try {
        const datos = {
            producto_id: Number($('movimientoProductoId').value),
            tipo: $('movimientoTipo').value,
            cantidad: Number($('movimientoCantidad').value),
            motivo: $('movimientoMotivo').value.trim() || null
        };

        const respuesta = await api('/movimientos', { method: 'POST', body: datos });
        cerrarMovimiento();
        aviso.textContent = `Movimiento registrado: ${respuesta.tipo === 'entrada' ? '+' : '-'}${respuesta.cantidad} → stock de "${respuesta.producto_nombre}" ahora es ${respuesta.stock_despues}.`;
        await cargarProductos();
    } catch (error) {
        movimientoAviso.textContent = error.message;
    } finally {
        botonRegistrarMovimiento.disabled = false;
    }
});

$('btnCancelarMovimiento').addEventListener('click', cerrarMovimiento);
$('btnCerrarMovimiento').addEventListener('click', cerrarMovimiento);
modalMovimiento.addEventListener('click', (e) => {
    if (e.target === modalMovimiento) cerrarMovimiento();
});

$('btnExportarPdf').addEventListener('click', () => {
    if (!Array.isArray(productos) || productos.length === 0) {
        aviso.textContent = 'No hay productos para exportar.';
        return;
    }
    exportarPDF(productos);
    aviso.textContent = 'PDF generado correctamente.';
});

$('btnExportarExcel').addEventListener('click', () => {
    if (!Array.isArray(productos) || productos.length === 0) {
        aviso.textContent = 'No hay productos para exportar.';
        return;
    }
    exportarExcel(productos);
    aviso.textContent = 'Excel generado correctamente.';
});

botonNuevo.addEventListener('click', () => abrirModal());
botonCancelar.addEventListener('click', cerrarModal);
botonCerrarModal.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
});
botonLogout.addEventListener('click', logout);
buscador.addEventListener('input', () => pintar(productos));
$('imagen_url').addEventListener('input', actualizarPreview);
$('imagenPreview').addEventListener('error', () => $('imagenPreview').classList.add('oculto'));

$('usuarioLabel').textContent = getUsuario() ? `Usuario: ${getUsuario()}` : '';
cargarProductos();
