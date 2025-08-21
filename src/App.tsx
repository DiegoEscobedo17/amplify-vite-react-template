import { useEffect, useMemo, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

type CartItem = {
  id?: string;
  descripcion: string;
  precio_unitario: number;
  cantidad: number;
  tipo_item: 'PRODUCTO' | 'SERVICIO';
  productoId?: string;
};

function App() {
  const { user, signOut } = useAuthenticator();
  const [productos, setProductos] = useState<Array<Schema["Productos"]["type"]>>([]);
  const [cajaAbierta, setCajaAbierta] = useState<Schema["Caja"]["type"] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'YAPE'|'PLIN'>("EFECTIVO");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const modelos: any = (client as any).models;
    if (!modelos?.Productos) {
      setErrorMsg('Backend no sincronizado con el nuevo esquema (model Productos no disponible). Despliega el backend y actualiza amplify_outputs.json.');
      return;
    }
    const sub = modelos.Productos.observeQuery({
      selectionSet: ["id","nombre_pruducto","precio","stock","sedeId","createdAt","updatedAt"]
    }).subscribe({
      next: (data: any) => setProductos([...data.items] as any),
      error: (e: any) => setErrorMsg(e?.message || 'Error cargando productos')
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const modelos: any = (client as any).models;
    if (!modelos?.Caja) return;
    modelos.Caja.list({ filter: { estado: { eq: 'APERTURA' } }, limit: 1 })
      .then((res: any) => setCajaAbierta(res.data?.[0] ?? null))
      .catch((e: any) => setErrorMsg(e?.message || 'Error buscando caja'));
  }, []);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(p => (p.nombre_pruducto || '').toLowerCase().includes(q));
  }, [busqueda, productos]);

  function agregarProducto(p: Schema["Productos"]["type"]) {
    setCarrito(prev => {
      const ex = prev.find(i => i.productoId === p.id);
      if (ex) {
        return prev.map(i => i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { productoId: p.id, descripcion: p.nombre_pruducto!, precio_unitario: p.precio!, cantidad: 1, tipo_item: 'PRODUCTO' }];
    });
  }

  function inc(idx: number) {
    setCarrito(prev => prev.map((i, j) => j === idx ? { ...i, cantidad: i.cantidad + 1 } : i));
  }
  function dec(idx: number) {
    setCarrito(prev => prev.map((i, j) => j === idx ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i));
  }
  function del(idx: number) {
    setCarrito(prev => prev.filter((_, j) => j !== idx));
  }

  const total = useMemo(() => carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0), [carrito]);

  async function cobrar() {
    if (!cajaAbierta) { alert('No hay caja en APERTURA'); return; }
    if (carrito.length === 0) { alert('Carrito vacío'); return; }
    const mutaciones: any = (client as any).mutations;
    if (!mutaciones?.crearPOSVentaConDetalles) {
      alert('Mutación crearPOSVentaConDetalles no disponible. Despliega backend.');
      return;
    }
    const args = {
      cajaId: cajaAbierta.id!,
      usuarioVendedorUserId: user?.username || user?.userId || 'desconocido',
      metodo_pago: metodoPago,
      descuento: 0,
      observaciones: "",
      items: carrito.map(i => ({
        tipo_item: i.tipo_item,
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    } as any;
    try {
      const res = await mutaciones.crearPOSVentaConDetalles(args);
      if ((res as any).data) {
        const venta = (res as any).data as Schema["POSVenta"]["type"];
        setCarrito([]);
        alert(`Venta ${venta.numero_ticket} creada. Total S/. ${venta.total?.toFixed(2)}`);
      } else {
        alert('Error creando venta');
      }
    } catch (e: any) {
      alert(e?.message || 'Error creando venta');
    }
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f5f5f5' }}>
        <div>POS Mínimo</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{user?.username}</span>
          <button onClick={signOut}>Salir</button>
        </div>
      </header>

      {errorMsg && (
        <div style={{ background: '#fff2cc', padding: 8, margin: 8, borderRadius: 4, color: '#7a5b00' }}>
          {errorMsg}
        </div>
      )}

      {!errorMsg && !cajaAbierta && (
        <div style={{ background: '#d6ffd6', padding: 8, margin: 8, borderRadius: 4 }}>
          No hay una Caja en APERTURA. Ábrela en Data Manager.
        </div>
      )}

      <section style={{ display: 'flex', flex: 1, gap: 12, padding: 12 }}>
        <div style={{ flex: 2, border: '1px solid #ddd', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column' }}>
          <input
            placeholder="Buscar producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: 8, marginBottom: 8 }}
          />
          <div style={{ overflow: 'auto' }}>
            {productosFiltrados.map(p => (
              <div key={p.id} onClick={() => agregarProducto(p)} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <span>{p.nombre_pruducto}</span>
                <span>S/. {p.precio?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>TOTAL: S/. {total.toFixed(2)}</div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {carrito.map((i, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 6, borderBottom: '1px solid #eee' }}>
                <div>
                  <div>{i.descripcion}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>S/. {i.precio_unitario.toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => dec(idx)}>-</button>
                  <span>{i.cantidad}</span>
                  <button onClick={() => inc(idx)}>+</button>
                  <button onClick={() => del(idx)}>x</button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label>Método de pago:&nbsp;</label>
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as any)}>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TARJETA">TARJETA</option>
              <option value="YAPE">YAPE</option>
              <option value="PLIN">PLIN</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cobrar}>COBRAR</button>
            <button onClick={() => setCarrito([])}>LIMPIAR</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
