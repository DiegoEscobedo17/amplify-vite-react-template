import React, { useEffect, useState } from 'react';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export const AdminPage: React.FC = () => {
  const { isAdmin, loading } = useIsAdmin();
  const [nombreProducto, setNombreProducto] = useState('');
  const [precioProducto, setPrecioProducto] = useState('');
  const [stockProducto, setStockProducto] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [sedes, setSedes] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      const s = await client.models.Sede.list({ limit: 1000 });
      setSedes(s.data.map((x) => ({ value: x.id!, label: x.nombre || 'Sin nombre' })));
    })();
  }, []);

  if (!loading && !isAdmin) return <Navigate to="/" replace />;

  const crearProducto = async () => {
    if (!sedeId) return alert('Selecciona una sede');
    try {
      const res = await client.models.Productos.create({
        nombre_pruducto: nombreProducto,
        precio: parseFloat(precioProducto || '0') || 0,
        stock: parseInt(stockProducto || '0', 10) || 0,
        sedeId,
      });
      if (!res.data) throw new Error('No se pudo crear');
      alert('Producto creado');
      setNombreProducto(''); setPrecioProducto(''); setStockProducto('');
    } catch (e: any) {
      alert(e?.message || 'Error');
    }
  };

  const eliminarVenta = async (ventaId: string) => {
    try {
      const res = await client.models.POSVenta.delete({ id: ventaId });
      if (!res.data) throw new Error('No se eliminó');
      alert('Venta eliminada');
    } catch (e: any) {
      alert(e?.message || 'Error');
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>Panel de Administración</h2>

      <section style={{ marginTop: '1rem', background: 'white', padding: '1rem', borderRadius: 8 }}>
        <h3>Crear Producto</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr auto' }}>
          <input placeholder="Nombre" value={nombreProducto} onChange={(e) => setNombreProducto(e.target.value)} />
          <input type="number" placeholder="Precio" value={precioProducto} onChange={(e) => setPrecioProducto(e.target.value)} />
          <input type="number" placeholder="Stock" value={stockProducto} onChange={(e) => setStockProducto(e.target.value)} />
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Sede</option>
            {sedes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn" onClick={crearProducto}>Añadir</button>
        </div>
      </section>

      <section style={{ marginTop: '1rem', background: 'white', padding: '1rem', borderRadius: 8 }}>
        <h3>Ventas POS (acciones)</h3>
        <button className="btn" onClick={() => alert('Listar/Filtrar ventas en esta sección (pendiente)')}>Refrescar</button>
        <div style={{ marginTop: 8, fontSize: 14, color: '#7f8c8d' }}>
          Puedes agregar controles para anular/eliminar ventas específicas. Ejemplo:
          <button className="btn-danger" style={{ marginLeft: 8 }} onClick={() => eliminarVenta(prompt('ID de venta a eliminar') || '')}>Eliminar por ID</button>
        </div>
      </section>
    </div>
  );
};

export default AdminPage;


