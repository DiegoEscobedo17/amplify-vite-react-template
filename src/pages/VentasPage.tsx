import React, { useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import '../components/pos/pos.css';
import '../components/ventas/ventas.css';

const client = generateClient<Schema>();

type EstadoVenta = 'Todas' | 'COMPLETADA' | 'CANCELADA';

export const VentasPage: React.FC = () => {
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');
  const [estado, setEstado] = useState<EstadoVenta>('Todas');
  const [ventas, setVentas] = useState<Array<Schema['POSVenta']['type']>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const filtro = useMemo(() => {
    const cond: any = {};
    if (estado !== 'Todas') cond.estado = { eq: estado };
    // Solo fecha_venta >= desde y <= hasta si están definidos
    if (desde) cond.fecha_venta = { ...(cond.fecha_venta || {}), ge: new Date(desde).toISOString() };
    if (hasta) cond.fecha_venta = { ...(cond.fecha_venta || {}), le: new Date(hasta).toISOString() };
    return cond;
  }, [desde, hasta, estado]);

  const cargar = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await client.models.POSVenta.list({ filter: Object.keys(filtro).length ? filtro : undefined, limit: 1000 });
      // Ordenar desc por fecha
      const items = resp.data.sort((a, b) => (b.fecha_venta || '').localeCompare(a.fecha_venta || ''));
      setVentas(items);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error cargando ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ventas-page">
      <h2>Historial de Ventas</h2>
      <div className="ventas-filtros">
        <div className="filtro">
          <label>Fecha Inicio</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="filtro">
          <label>Fecha Fin</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="filtro">
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoVenta)}>
            <option value="Todas">Todos</option>
            <option value="COMPLETADA">Completada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
        <button className="btn" onClick={cargar}>Filtrar</button>
      </div>

      {loading && <div className="caja-info">Cargando...</div>}
      {errorMsg && <div className="caja-error">{errorMsg}</div>}

      <div className="ventas-table-wrap">
        <table className="ventas-table">
          <thead>
            <tr>
              <th>TICKET</th>
              <th>FECHA</th>
              <th>CLIENTE</th>
              <th>MÉTODO PAGO</th>
              <th>TOTAL</th>
              <th>ESTADO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td>{v.numero_ticket}</td>
                <td>{v.fecha_venta ? new Date(v.fecha_venta).toLocaleString() : '—'}</td>
                <td>{v.cliente_nombre || 'Sin cliente'}</td>
                <td>
                  <span className="pill pill-green">{v.metodo_pago || 'Efectivo'}</span>
                </td>
                <td> S/. {(v.total || 0).toFixed(2)} </td>
                <td>
                  <span className={`pill ${v.estado === 'COMPLETADA' ? 'pill-green' : 'pill-red'}`}>
                    {v.estado}
                  </span>
                </td>
                <td>
                  <div className="acciones">
                    <button className="btn" onClick={() => window.print()}>Imprimir</button>
                    <button className="btn" onClick={() => alert(`Venta ${v.numero_ticket}`)}>Ver</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VentasPage;


