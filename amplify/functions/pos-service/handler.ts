import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';

type AppSyncResolverEvent = {
	arguments: any;
	info: { fieldName: string };
};

const client = generateClient<Schema>({ authMode: 'userPool' });

function zfill(num: number, width: number): string {
	const str = String(num);
	return str.length >= width ? str : '0'.repeat(width - str.length) + str;
}

export const handler = async (event: AppSyncResolverEvent) => {
	try {
		switch (event.info.fieldName) {
			case 'crearPOSVentaConDetalles':
				return await crearPOSVentaConDetalles(event.arguments);
			case 'anularPOSVenta':
				return await anularPOSVenta(event.arguments);
			case 'emitirComprobante':
				return await emitirComprobante(event.arguments);
			default:
				throw new Error(`Unknown field ${event.info.fieldName}`);
		}
	} catch (err: any) {
		console.error('Error in handler', err);
		throw new Error(err?.message || 'Unhandled error');
	}
};

async function crearPOSVentaConDetalles(args: any) {
	const { cajaId, usuarioVendedorUserId, metodo_pago, descuento = 0, observaciones = '', items } = args;

	const caja = await client.models.Caja.get({ id: cajaId });
	if (!caja?.data) throw new Error('Caja no encontrada');
	if (caja.data.estado !== 'APERTURA') throw new Error('Caja no está en APERTURA');

	let subtotal = 0;
	for (const item of items) {
		const line = item.cantidad * item.precio_unitario;
		subtotal += line;
		if (item.tipo_item === 'PRODUCTO' && item.productoId) {
			const prod = await client.models.Productos.get({ id: item.productoId });
			if (!prod?.data) throw new Error('Producto no encontrado');
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
		if (!isNaN(n) && n > maxTicket) maxTicket = n;
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
	if (!ventaCreate?.data) throw new Error('No se pudo crear la venta');

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

async function anularPOSVenta(args: any) {
	const { ventaId } = args;
	const venta = await client.models.POSVenta.get({ id: ventaId });
	if (!venta?.data) throw new Error('Venta no encontrada');
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

async function emitirComprobante(args: any) {
	const { ventaId, tipo_comprobante, receptor_tipo_documento, receptor_numero_documento, receptor_razon_social, receptor_direccion } = args;
	const venta = await client.models.POSVenta.get({ id: ventaId });
	if (!venta?.data) throw new Error('Venta no encontrada');
	const caja = await client.models.Caja.get({ id: venta.data.cajaId! });
	if (!caja?.data) throw new Error('Caja no encontrada');
	const sedeId = caja.data.sedeId!;
	const confResp = await client.models.ConfiguracionSUNAT.list({ filter: { sedeId: { eq: sedeId } }, limit: 1 });
	const conf = confResp.data[0];
	if (!conf) throw new Error('Configuración SUNAT no encontrada para la sede');
	if (conf.activo === false) throw new Error('Configuración SUNAT inactiva');

	let serie = '';
	let numero = 0;
	if (tipo_comprobante === '01') {
		serie = conf.serie_factura || 'F001';
		numero = (conf.ultimo_numero_factura || 0) + 1;
		await client.models.ConfiguracionSUNAT.update({ sedeId: conf.sedeId, ultimo_numero_factura: numero });
	} else if (tipo_comprobante === '03') {
		serie = conf.serie_boleta || 'B001';
		numero = (conf.ultimo_numero_boleta || 0) + 1;
		await client.models.ConfiguracionSUNAT.update({ sedeId: conf.sedeId, ultimo_numero_boleta: numero });
	} else {
		// permitir stub para otros tipos
		serie = conf.serie_boleta || 'B001';
		numero = (conf.ultimo_numero_boleta || 0) + 1;
	}

	const ce = await client.models.ComprobanteElectronico.create({
		tipo_comprobante,
		serie,
		numero,
		fecha_emision: new Date().toISOString(),
		emisor_ruc: conf.emisor_ruc!,
		emisor_razon_social: conf.emisor_razon_social!,
		emisor_direccion: conf.emisor_direccion!,
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

export default handler;


