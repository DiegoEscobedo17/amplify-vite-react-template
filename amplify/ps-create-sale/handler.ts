import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../data/resource';

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
      default:
        throw new Error(`Unknown field ${event.info.fieldName}`);
    }
  } catch (err: any) {
    console.error('Error in ps-create-sale handler', err);
    throw new Error(err?.message || 'Unhandled error in ps-create-sale');
  }
};

async function crearPOSVentaConDetalles(args: any) {
  const { cajaId, usuarioVendedorUserId, metodo_pago, descuento = 0, observaciones = '', items } = args;

  // Validar caja en estado APERTURA
  const caja = await client.models.Caja.get({ id: cajaId });
  if (!caja?.data) throw new Error('Caja no encontrada');
  if (caja.data.estado !== 'APERTURA') throw new Error('Caja no está en APERTURA');

  // Calcular totales
  let subtotal = 0;
  for (const item of items) {
    const line = item.cantidad * item.precio_unitario;
    subtotal += line;
    
    // Validar stock si es PRODUCTO
    if (item.tipo_item === 'PRODUCTO' && item.productoId) {
      const prod = await client.models.Productos.get({ id: item.productoId });
      if (!prod?.data) throw new Error('Producto no encontrado');
      if (item.cantidad > (prod.data.stock ?? 0)) {
        throw new Error(`Stock insuficiente para producto ${prod.data.nombre_pruducto}`);
      }
    }
  }
  
  const igv = 0; // Los precios ya incluyen IGV
  const total = subtotal - (descuento || 0);

  // Generar numero_ticket (zfill 8)
  const ventasResp = await client.models.POSVenta.list({ 
    filter: { cajaId: { eq: cajaId } }, 
    limit: 1000 
  });
  
  let maxTicket = 0;
  for (const v of ventasResp.data) {
    const n = parseInt(String(v.numero_ticket || '0'), 10);
    if (!isNaN(n) && n > maxTicket) maxTicket = n;
  }
  const nextTicket = zfill(maxTicket + 1, 8);

  // Crear POSVenta
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

  // Crear detalles y descontar stock
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
    
    // Descontar stock si es PRODUCTO
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

  // Retornar venta recargada
  const reloaded = await client.models.POSVenta.get({ id: ventaCreate.data.id });
  return reloaded.data;
}

export default handler;
