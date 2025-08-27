import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { posService } from '../functions/pos-service/resource';

// Nota dinero: usamos a.float(). Si necesitas precisión exacta, modela valores en centavos con a.integer().
export const schema = a.schema({

  // ============== Organización ==============
  Sede: a.model({
    nombre: a.string().required(),
    direccion: a.string(),
    telefono: a.string(),
    ruc: a.string(),

    productos: a.hasMany('Productos', 'sedeId'),
    cajas: a.hasMany('Caja', 'sedeId'),
    configuracionSunat: a.hasMany('ConfiguracionSUNAT', 'sedeId'),
  }),


  // ============== Inventario ==============
  Productos: a.model({
    nombre_pruducto: a.string().required(),
    tipo_producto: a.enum(['INSUMO', 'ABARROTE']),
    stock: a.integer().required(),
    precio: a.float().required(),
    sedeId: a.id().required(),
    sede: a.belongsTo('Sede', 'sedeId'),

    posDetalles: a.hasMany('POSVentaDetalle', 'productoId'),
  }),

  // ============== POS ==============
  Caja: a.model({
    estado: a.string().default('APERTURA'),
    fecha_apertura: a.datetime(),
    fecha_cierre: a.datetime(),
    ingresos_apertura: a.float().default(0),
    egresos: a.float().default(0),
    asignadoUserId: a.string(), // usuario responsable (Cognito)
    sedeId: a.id().required(),
    sede: a.belongsTo('Sede', 'sedeId'),

    registros: a.hasMany('CajaRegistro', 'cajaId'),
    ventas_pos: a.hasMany('POSVenta', 'cajaId'),
  }),

  CajaRegistro: a.model({
    cajaId: a.id().required(),
    usuario_responsable_userId: a.string(), // Cognito
    tipo_operacion: a.enum(['APERTURA', 'CIERRE', 'PAUSA', 'REANUDACION']),
    monto_inicial: a.float().default(0),
    monto_final: a.float().default(0),
    observaciones: a.string(),
    fecha_hora: a.datetime(),

    caja: a.belongsTo('Caja', 'cajaId'),
  }),

  POSVenta: a.model({
    numero_ticket: a.string().required(),  // generarlo en Function (zfill 8)
    cajaId: a.id().required(),
    usuario_vendedor_userId: a.string().required(), // Cognito
    cliente_nombre: a.string(),
    cliente_dni: a.string(),
    subtotal: a.float().default(0),
    descuento: a.float().default(0),
    igv: a.float().default(0),
    total: a.float().default(0),
    metodo_pago: a.string().default('EFECTIVO'),
    estado: a.string().default('COMPLETADA'),
    observaciones: a.string(),
    fecha_venta: a.datetime(),
    fecha_modificacion: a.datetime(),

    caja: a.belongsTo('Caja', 'cajaId'),
    detalles: a.hasMany('POSVentaDetalle', 'ventaId'),
    comprobantes_electronicos: a.hasMany('ComprobanteElectronico', 'venta_posId'),
  }),

  POSVentaDetalle: a.model({
    ventaId: a.id().required(),
    tipo_item: a.string().required(), // PRODUCTO | SERVICIO
    productoId: a.id(), // null si es SERVICIO
    descripcion: a.string().required(),
    cantidad: a.integer().default(1),
    precio_unitario: a.float().required(),
    subtotal: a.float().required(),

    venta: a.belongsTo('POSVenta', 'ventaId'),
    producto: a.belongsTo('Productos', 'productoId'),
  }),

  // ============== SUNAT ==============
  ConfiguracionSUNAT: a.model({
    sedeId: a.id().required(),

    // Cert/credenciales: sugiere guardar archivo en S3/Secrets y referenciar aquí.
    certificado_digital_s3key: a.string(),
    password_certificado: a.string(),

    serie_boleta: a.string().default('B001'),
    serie_factura: a.string().default('F001'),
    ultimo_numero_boleta: a.integer().default(0),
    ultimo_numero_factura: a.integer().default(0),

    ambiente_sunat: a.string().default('CERTIFICACION'),

    emisor_ruc: a.string(),
    emisor_razon_social: a.string(),
    emisor_direccion: a.string(),
    emisor_ubigeo: a.string(),

    url_sunat: a.string(),
    usuario_sunat: a.string(),
    password_sunat: a.string(),
    activo: a.boolean().default(true),

    fecha_creacion: a.datetime(),
    fecha_modificacion: a.datetime(),

    sede: a.belongsTo('Sede', 'sedeId'),
  }).identifier(['sedeId']), // 1-1 por sede

  ComprobanteElectronico: a.model({
    // '01','03','07','08' -> valida en Function/UI
    tipo_comprobante: a.string().required(),
    serie: a.string().required(),
    numero: a.integer().required(),
    fecha_emision: a.datetime(),
    fecha_vencimiento: a.date(),

    // Emisor
    emisor_ruc: a.string().required(),
    emisor_razon_social: a.string().required(),
    emisor_direccion: a.string().required(),
    emisor_ubigeo: a.string(),

    // Receptor
    receptor_tipo_documento: a.string().required(), // '1','6','0'
    receptor_numero_documento: a.string().required(),
    receptor_razon_social: a.string().required(),
    receptor_direccion: a.string(),

    // Totales
    subtotal: a.float().default(0),
    igv: a.float().default(0),
    total: a.float().default(0),

    // Estado SUNAT
    estado_sunat: a.string().default('PENDIENTE'),
    respuesta_sunat: a.string(),
    codigo_respuesta_sunat: a.string(),
    fecha_respuesta_sunat: a.datetime(),

    // XML/CDR
    xml_generado: a.string(),
    xml_firmado: a.string(),
    cdr_sunat: a.string(),

    // Relación POS
    venta_posId: a.id(),
    venta_pos: a.belongsTo('POSVenta', 'venta_posId'),

    // Otros
    moneda: a.string().default('PEN'),
    tipo_cambio: a.float().default(1.0),
    observaciones: a.string(),

    // Detalles
    detalles: a.hasMany('DetalleComprobanteElectronico', 'comprobanteId'),
  }),

  DetalleComprobanteElectronico: a.model({
    comprobanteId: a.id().required(),
    descripcion: a.string().required(),
    cantidad: a.float().default(1),
    unidad_medida: a.string().default('NIU'),
    precio_unitario: a.float().required(),
    subtotal: a.float().required(),
    igv: a.float().default(0),
    tipo_igv: a.string().default('10'),

    // opcional: enlazar al detalle POS
    detalle_posId: a.id(),
    detalle_pos: a.belongsTo('POSVentaDetalle', 'detalle_posId'),

    comprobante: a.belongsTo('ComprobanteElectronico', 'comprobanteId'),
  }),

  SUNATEnvioQueue: a.model({
    comprobanteId: a.id(), // puede ser null si se encola antes de persistir CE
    cbc_id: a.string().required(), // SERIE-NUMERO
    emisor_ruc: a.string().required(),
    tipo: a.string().required(), // '01','03'
    serie: a.string().required(),
    numero: a.integer().required(),

    zip_nombre: a.string().required(),
    zip_base64: a.string().required(),
    xml_sha1: a.string().required(),

    estado: a.string().default('PENDIENTE'),
    intentos: a.integer().default(0),
    max_intentos: a.integer().default(5),
    next_retry_at: a.datetime(),

    fault_code: a.string(),
    fault_string: a.string(),
    last_response_snippet: a.string(),

    comprobante: a.belongsTo('ComprobanteElectronico', 'comprobanteId'),
  }),

  // ============== Mutations (Functions) ==============
  crearPOSVentaConDetalles: a.mutation()
    .arguments({
      cajaId: a.id().required(),
      usuarioVendedorUserId: a.string().required(),
      metodo_pago: a.string().required(),
      descuento: a.float(),
      observaciones: a.string(),
      items: a.json().required(),
    })
    .returns(a.ref('POSVenta'))
    .handler(a.handler.function(posService)),

  anularPOSVenta: a.mutation()
    .arguments({
      ventaId: a.id().required(),
      motivo: a.string(),
    })
    .returns(a.ref('POSVenta'))
    .handler(a.handler.function(posService)),

  emitirComprobante: a.mutation()
    .arguments({
      ventaId: a.id().required(),
      tipo_comprobante: a.string().required(), // '01'|'03'|'07'|'08'
      receptor_tipo_documento: a.string().required(), // '1'|'6'|'0'
      receptor_numero_documento: a.string().required(),
      receptor_razon_social: a.string().required(),
      receptor_direccion: a.string(),
    })
    .returns(a.ref('ComprobanteElectronico'))
    .handler(a.handler.function(posService)),

})
.authorization((allow) => [allow.authenticated()]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});

/*
Siguientes pasos (sugeridos):
- crearPOSVentaConDetalles (Function):
  * valida Caja.estado === 'APERTURA'
  * genera numero_ticket (zfill 8)
  * crea POSVenta + detalles
  * recalcula subtotal/igv/total
  * descuenta stock si detalle.tipo_item === 'PRODUCTO'
- anularPOSVenta (Function):
  * cambia estado a 'CANCELADA'/'DEVUELTA'
  * repone stock
- emitirComprobante (Function):
  * reserva correlativo desde ConfiguracionSUNAT
  * genera/firma/envía XML a SUNAT
  * guarda CDR y actualiza estado_sunat
- retrySUNAT (Function):
  * maneja SUNATEnvioQueue con backoff
*/
