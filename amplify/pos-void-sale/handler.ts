import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';

type AppSyncResolverEvent = {
  arguments: any;
  info: { fieldName: string };
};

const client = generateClient<Schema>({ authMode: 'userPool' });

export const handler = async (event: AppSyncResolverEvent) => {
  try {
    switch (event.info.fieldName) {
      case 'anularPOSVenta':
        return await anularPOSVenta(event.arguments);
      default:
        throw new Error(`Unknown field ${event.info.fieldName}`);
    }
  } catch (err: any) {
    console.error('Error in pos-void-sale handler', err);
    throw new Error(err?.message || 'Unhandled error in pos-void-sale');
  }
};

async function anularPOSVenta(args: any) {
  const { ventaId, motivo = 'Anulación solicitada' } = args;
  
  // Cargar venta y sus detalles
  const venta = await client.models.POSVenta.get({ id: ventaId });
  if (!venta?.data) throw new Error('Venta no encontrada');
  
  const detalles = await client.models.POSVentaDetalle.list({ 
    filter: { ventaId: { eq: ventaId } }, 
    limit: 1000 
  });
  
  // Reponer stock para cada detalle de tipo PRODUCTO
  for (const d of detalles.data) {
    if (d.tipo_item === 'PRODUCTO' && d.productoId) {
      const prod = await client.models.Productos.get({ id: d.productoId });
      if (prod?.data) {
        await client.models.Productos.update({
          id: prod.data.id,
          _version: prod.data._version,
          stock: (prod.data.stock || 0) + (d.cantidad || 0),
        });
      }
    }
  }
  
  // Actualizar venta a estado CANCELADA
  const updated = await client.models.POSVenta.update({
    id: venta.data.id,
    _version: venta.data._version,
    estado: 'CANCELADA',
    fecha_modificacion: new Date().toISOString(),
    observaciones: motivo,
  });
  
  return updated.data;
}

export default handler;
