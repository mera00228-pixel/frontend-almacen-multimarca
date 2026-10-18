const cop = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const fechaGeneracion = () =>
    new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });

const archivoConFecha = (ext) => `inventario-${new Date().toISOString().slice(0, 10)}.${ext}`;

const valorTotalInventario = (lista) =>
    lista.reduce((suma, p) => suma + Number(p.precio_venta) * p.stock, 0);

function filasTabla(lista) {
    return lista.map((p) => [
        p.id,
        p.codigo_barras || '-',
        p.nombre,
        p.marca_nombre || '-',
        p.categoria_nombre || '-',
        cop.format(p.precio_compra),
        cop.format(p.precio_venta),
        p.stock,
        p.stock_minimo,
        Number(p.estado) === 1 ? 'Activo' : 'Inactivo'
    ]);
}

export function exportarPDF(lista) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(15);
    doc.setTextColor(29, 78, 216);
    doc.text('Reporte de Inventario - Almacen Multimarca', 40, 40);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Fecha de generacion: ${fechaGeneracion()}`, 40, 58);
    doc.text(
        `Productos: ${lista.length}    ·    Valor total del inventario: ${cop.format(valorTotalInventario(lista))}`,
        40, 72
    );

    doc.autoTable({
        startY: 84,
        head: [['ID', 'Codigo', 'Producto', 'Marca', 'Categoria', 'Compra', 'Venta', 'Stock', 'Minimo', 'Estado']],
        body: filasTabla(lista),
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [29, 78, 216], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 }
    });

    doc.save(archivoConFecha('pdf'));
}

export function exportarExcel(lista) {
    const datos = lista.map((p) => ({
        ID: p.id,
        Codigo: p.codigo_barras || '',
        Producto: p.nombre,
        Marca: p.marca_nombre || '',
        Categoria: p.categoria_nombre || '',
        'Precio Compra': Number(p.precio_compra),
        'Precio Venta': Number(p.precio_venta),
        Stock: p.stock,
        'Stock Minimo': p.stock_minimo,
        'Valor Inventario': Number(p.precio_venta) * p.stock,
        Estado: Number(p.estado) === 1 ? 'Activo' : 'Inactivo'
    }));

    datos.push({
        ID: '',
        Codigo: '',
        Producto: `TOTAL (${lista.length} productos)`,
        Marca: '',
        Categoria: '',
        'Precio Compra': '',
        'Precio Venta': '',
        Stock: lista.reduce((s, p) => s + p.stock, 0),
        'Stock Minimo': '',
        'Valor Inventario': valorTotalInventario(lista),
        Estado: ''
    });

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja['!cols'] = [
        { wch: 6 }, { wch: 16 }, { wch: 34 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 10 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Inventario');
    XLSX.writeFile(libro, archivoConFecha('xlsx'));
}
