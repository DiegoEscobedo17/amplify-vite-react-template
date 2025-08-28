import { generateClient } from 'aws-amplify/data';
const client = generateClient({ authMode: 'userPool' });
function zfill(num, width) {
    const str = String(num);
    return str.length >= width ? str : '0'.repeat(width - str.length) + str;
}
export const handler = async (event) => {
    try {
        switch (event.info.fieldName) {
            case 'crearPOSVentaConDetalles':
                return await crearPOSVentaConDetalles(event.arguments);
            case 'anularPOSVenta':
                return await anularPOSVenta(event.arguments);
            case 'emitirComprobante':
                return await emitirComprobante(event.arguments);
            case 'abrirCaja':
                return await abrirCaja(event.arguments);
            case 'cerrarCaja':
                return await cerrarCaja(event.arguments);
            case 'upsertUserProfile':
                return await upsertUserProfile(event.arguments);
            case 'registerUser':
                return await registerUser(event.arguments);
            case 'loginUser':
                return await loginUser(event.arguments);
            default:
                throw new Error(`Unknown field ${event.info.fieldName}`);
        }
    }
    catch (err) {
        console.error('Error in handler', err);
        throw new Error(err?.message || 'Unhandled error');
    }
};
async function abrirCaja(args) {
    const { cajaId, usuarioId, monto_inicial = 0, observaciones = '' } = args;
    const caja = await client.models.Caja.get({ id: cajaId });
    if (!caja?.data)
        throw new Error('Caja no encontrada');
    if (caja.data.estado === 'APERTURA')
        return caja.data;
    await client.models.CajaRegistro.create({
        cajaId,
        usuario_responsable_userId: usuarioId,
        tipo_operacion: 'APERTURA',
        monto_inicial,
        observaciones,
        fecha_hora: new Date().toISOString(),
    });
    const updated = await client.models.Caja.update({
        id: cajaId,
        estado: 'APERTURA',
        fecha_apertura: new Date().toISOString(),
        ingresos_apertura: monto_inicial,
    });
    return updated.data;
}
async function cerrarCaja(args) {
    const { cajaId, usuarioId, observaciones = '' } = args;
    const caja = await client.models.Caja.get({ id: cajaId });
    if (!caja?.data)
        throw new Error('Caja no encontrada');
    if (caja.data.estado !== 'APERTURA')
        throw new Error('Caja no está en APERTURA');
    await client.models.CajaRegistro.create({
        cajaId,
        usuario_responsable_userId: usuarioId,
        tipo_operacion: 'CIERRE',
        observaciones,
        fecha_hora: new Date().toISOString(),
    });
    const updated = await client.models.Caja.update({
        id: cajaId,
        estado: 'CIERRE',
        fecha_cierre: new Date().toISOString(),
    });
    return updated.data;
}
async function crearPOSVentaConDetalles(args) {
    const { cajaId, usuarioVendedorUserId, metodo_pago, descuento = 0, observaciones = '', items } = args;
    const caja = await client.models.Caja.get({ id: cajaId });
    if (!caja?.data)
        throw new Error('Caja no encontrada');
    if (caja.data.estado !== 'APERTURA')
        throw new Error('Caja no está en APERTURA');
    let subtotal = 0;
    for (const item of items) {
        const line = item.cantidad * item.precio_unitario;
        subtotal += line;
        if (item.tipo_item === 'PRODUCTO' && item.productoId) {
            const prod = await client.models.Productos.get({ id: item.productoId });
            if (!prod?.data)
                throw new Error('Producto no encontrado');
            if (item.cantidad > (prod.data.stock ?? 0)) {
                throw new Error(`Stock insuficiente para producto ${prod.data.nombre_pruducto}`);
            }
        }
    }
    const igv = 0;
    const total = subtotal - (descuento || 0);
    // generar numero_ticket
    const ventasResp = await client.models.POSVenta.list({ filter: { cajaId: { eq: cajaId } }, limit: 1000 });
    let maxTicket = 0;
    for (const v of ventasResp.data) {
        const n = parseInt(String(v.numero_ticket || '0'), 10);
        if (!isNaN(n) && n > maxTicket)
            maxTicket = n;
    }
    const nextTicket = zfill(maxTicket + 1, 8);
    const ventaCreate = await client.models.POSVenta.create({
        numero_ticket: nextTicket,
        cajaId,
        usuario_vendedor_userId: usuarioVendedorUserId,
        subtotal,
        descuento,
        igv,
        total,
        metodo_pago,
        estado: 'COMPLETADA',
        observaciones,
        fecha_venta: new Date().toISOString(),
    });
    if (!ventaCreate?.data)
        throw new Error('No se pudo crear la venta');
    for (const item of items) {
        await client.models.POSVentaDetalle.create({
            ventaId: ventaCreate.data.id,
            tipo_item: item.tipo_item,
            productoId: item.productoId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.cantidad * item.precio_unitario,
        });
        if (item.tipo_item === 'PRODUCTO' && item.productoId) {
            const prod = await client.models.Productos.get({ id: item.productoId });
            if (prod?.data) {
                await client.models.Productos.update({
                    id: prod.data.id,
                    stock: (prod.data.stock || 0) - item.cantidad,
                });
            }
        }
    }
    const reloaded = await client.models.POSVenta.get({ id: ventaCreate.data.id });
    return reloaded.data;
}
async function anularPOSVenta(args) {
    const { ventaId } = args;
    const venta = await client.models.POSVenta.get({ id: ventaId });
    if (!venta?.data)
        throw new Error('Venta no encontrada');
    const detalles = await client.models.POSVentaDetalle.list({ filter: { ventaId: { eq: ventaId } }, limit: 1000 });
    for (const d of detalles.data) {
        if (d.tipo_item === 'PRODUCTO' && d.productoId) {
            const prod = await client.models.Productos.get({ id: d.productoId });
            if (prod?.data) {
                await client.models.Productos.update({
                    id: prod.data.id,
                    stock: (prod.data.stock || 0) + (d.cantidad || 0),
                });
            }
        }
    }
    const updated = await client.models.POSVenta.update({
        id: venta.data.id,
        estado: 'CANCELADA',
        fecha_modificacion: new Date().toISOString(),
    });
    return updated.data;
}
async function emitirComprobante(args) {
    const { ventaId, tipo_comprobante, receptor_tipo_documento, receptor_numero_documento, receptor_razon_social, receptor_direccion } = args;
    const venta = await client.models.POSVenta.get({ id: ventaId });
    if (!venta?.data)
        throw new Error('Venta no encontrada');
    const caja = await client.models.Caja.get({ id: venta.data.cajaId });
    if (!caja?.data)
        throw new Error('Caja no encontrada');
    const sedeId = caja.data.sedeId;
    const confResp = await client.models.ConfiguracionSUNAT.list({ filter: { sedeId: { eq: sedeId } }, limit: 1 });
    const conf = confResp.data[0];
    if (!conf)
        throw new Error('Configuración SUNAT no encontrada para la sede');
    if (conf.activo === false)
        throw new Error('Configuración SUNAT inactiva');
    let serie = '';
    let numero = 0;
    if (tipo_comprobante === '01') {
        serie = conf.serie_factura || 'F001';
        numero = (conf.ultimo_numero_factura || 0) + 1;
        await client.models.ConfiguracionSUNAT.update({ sedeId: conf.sedeId, ultimo_numero_factura: numero });
    }
    else if (tipo_comprobante === '03') {
        serie = conf.serie_boleta || 'B001';
        numero = (conf.ultimo_numero_boleta || 0) + 1;
        await client.models.ConfiguracionSUNAT.update({ sedeId: conf.sedeId, ultimo_numero_boleta: numero });
    }
    else {
        // permitir stub para otros tipos
        serie = conf.serie_boleta || 'B001';
        numero = (conf.ultimo_numero_boleta || 0) + 1;
    }
    const ce = await client.models.ComprobanteElectronico.create({
        tipo_comprobante,
        serie,
        numero,
        fecha_emision: new Date().toISOString(),
        emisor_ruc: conf.emisor_ruc,
        emisor_razon_social: conf.emisor_razon_social,
        emisor_direccion: conf.emisor_direccion,
        emisor_ubigeo: conf.emisor_ubigeo,
        receptor_tipo_documento,
        receptor_numero_documento,
        receptor_razon_social,
        receptor_direccion,
        subtotal: venta.data.subtotal || 0,
        igv: venta.data.igv || 0,
        total: venta.data.total || 0,
        estado_sunat: 'PENDIENTE',
        xml_generado: '<Invoice>...</Invoice>',
        xml_firmado: '<Signed>...</Signed>',
        cdr_sunat: '<CDR>...</CDR>',
        venta_posId: venta.data.id,
    });
    return ce.data;
}
async function upsertUserProfile(args) {
    const { sub, email, displayName } = args;
    if (!sub || !email)
        throw new Error('sub y email son requeridos');
    // Buscar por sub
    const existing = await client.models.User.list({ filter: { sub: { eq: sub } }, limit: 1 });
    const item = existing.data[0];
    if (item) {
        const updated = await client.models.User.update({ id: item.id, email, displayName });
        return updated.data;
    }
    const created = await client.models.User.create({ sub, email, displayName });
    return created.data;
}
function hashPassword(password, salt) {
    // NO CRIPTO FUERTE: placeholder. Para prod usar bcrypt/scrypt/argon2 en Lambda Layer.
    const data = password + '|' + salt;
    let hash = 0;
    for (let i = 0; i < data.length; i++)
        hash = (hash * 31 + data.charCodeAt(i)) >>> 0;
    return String(hash);
}
async function registerUser(args) {
    const { email, password, displayName } = args;
    if (!email || !password)
        throw new Error('email y password requeridos');
    const existing = await client.models.User.list({ filter: { email: { eq: email } }, limit: 1 });
    if (existing.data[0])
        throw new Error('Email ya registrado');
    const salt = String(Date.now());
    const password_hash = hashPassword(password, salt);
    const created = await client.models.User.create({ email, displayName, password_hash, password_salt: salt, role: 'USER' });
    return created.data;
}
async function loginUser(args) {
    const { email, password } = args;
    if (!email || !password)
        throw new Error('email y password requeridos');
    const existing = await client.models.User.list({ filter: { email: { eq: email } }, limit: 1 });
    const user = existing.data[0];
    if (!user)
        throw new Error('Credenciales inválidas');
    const computed = hashPassword(password, user.password_salt || '');
    if (computed !== user.password_hash)
        throw new Error('Credenciales inválidas');
    return user; // en prod emitir JWT propio o usar Amplify Auth
}
export default handler;
