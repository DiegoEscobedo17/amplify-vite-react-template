import React, { useEffect, useMemo, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import '../components/pos/pos.css';
import '../components/caja/caja.css';

const client = generateClient<Schema>();

type SelectOption = { value: string; label: string };

export const CajaPage: React.FC = () => {
  const { user } = useAuthenticator();
  const [sedes, setSedes] = useState<SelectOption[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [responsables, setResponsables] = useState<SelectOption[]>([]);
  const [selectedResponsableId, setSelectedResponsableId] = useState<string>('');
  const [montoInicial, setMontoInicial] = useState<string>('');
  const [cajas, setCajas] = useState<Array<Schema['Caja']['type']>>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const displayUser: SelectOption | null = useMemo(() => {
    const label = (user?.attributes?.email as string) || user?.username || 'Usuario actual';
    const value = (user?.username as string) || 'usuario-actual';
    return user ? { value, label } : null;
  }, [user]);

  useEffect(() => {
    // Cargar sedes
    (async () => {
      try {
        const resp = await client.models.Sede.list({ limit: 1000 });
        const opts: SelectOption[] = resp.data.map((s) => ({ value: s.id!, label: s.nombre || 'Sin nombre' }));
        setSedes(opts);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Error cargando sedes');
      }
    })();

    // Cargar responsables (por ahora solo el usuario autenticado)
    if (displayUser) {
      setResponsables([displayUser]);
      setSelectedResponsableId(displayUser.value);
    }
  }, [displayUser]);

  const cargarCajas = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await client.models.Caja.list({ limit: pageSize });
      setCajas(resp.data);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error cargando cajas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCajas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const abrirCaja = async () => {
    if (!selectedSedeId) {
      alert('Selecciona una sede');
      return;
    }
    try {
      // Paso 1: crear registro de Caja
      const created = await client.models.Caja.create({
        sedeId: selectedSedeId,
        asignadoUserId: selectedResponsableId || displayUser?.value,
        estado: 'APERTURA',
        fecha_apertura: new Date().toISOString(),
        ingresos_apertura: parseFloat(montoInicial || '0') || 0,
      });
      if (!created.data) throw new Error('No se pudo crear la caja');

      // Paso 2 (opcional): invocar mutación para dejar registro de apertura
      const mutations: any = (client as any).mutations;
      if (mutations?.abrirCaja) {
        await mutations.abrirCaja({
          cajaId: created.data.id,
          usuarioId: displayUser?.value,
          monto_inicial: parseFloat(montoInicial || '0') || 0,
          observaciones: 'Apertura desde UI',
        });
      }

      setSelectedSedeId('');
      setMontoInicial('');
      await cargarCajas();
      alert('Caja abierta');
    } catch (e: any) {
      alert(e?.message || 'Error al abrir caja');
    }
  };

  const cerrarCaja = async (cajaId: string) => {
    try {
      const mutations: any = (client as any).mutations;
      if (!mutations?.cerrarCaja) throw new Error('Mutación cerrarCaja no disponible');
      await mutations.cerrarCaja({ cajaId, usuarioId: displayUser?.value, observaciones: 'Cierre desde UI' });
      await cargarCajas();
    } catch (e: any) {
      alert(e?.message || 'Error al cerrar caja');
    }
  };

  const calcularIngresosPOS = async (cajaId: string): Promise<number> => {
    try {
      const res = await client.models.POSVenta.list({ filter: { cajaId: { eq: cajaId } }, limit: 1000 });
      return res.data.reduce((acc, v) => acc + (v.total || 0), 0);
    } catch {
      return 0;
    }
  };

  return (
    <div className="caja-grid">
      <section className="caja-col">
        <div className="caja-col-header">
          <h2>Estado de Cajas</h2>
          <div className="caja-col-controls">
            <span>Ver:</span>
            <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {loading && <div className="caja-info">Cargando...</div>}
        {errorMsg && <div className="caja-error">{errorMsg}</div>}

        <div className="caja-list">
          {cajas.map((c) => (
            <article key={c.id} className={`caja-card ${c.estado === 'APERTURA' ? 'open' : 'closed'}`}>
              <div className="caja-card-header">
                <span className={`badge ${c.estado === 'APERTURA' ? 'badge-open' : 'badge-closed'}`}>
                  {c.estado === 'APERTURA' ? 'Abierta' : 'Cerrada'}
                </span>
                <div className="caja-card-actions">
                  {c.estado === 'APERTURA' ? (
                    <button className="btn-danger" onClick={() => cerrarCaja(c.id!)}>Cerrar</button>
                  ) : (
                    <span className="btn-muted" aria-disabled>
                      Cerrada
                    </span>
                  )}
                  <button className="btn" onClick={() => alert('Reporte no implementado')}>Reporte</button>
                </div>
              </div>
              <div className="caja-card-body">
                <div className="caja-title">{c.sedeId}</div>
                <div className="caja-meta">Responsable: {c.asignadoUserId || 'N/D'}</div>
                <div className="caja-meta">
                  Apertura: {c.fecha_apertura ? new Date(c.fecha_apertura).toLocaleString() : '—'}
                </div>
                <div className="caja-totals">
                  <span>
                    Ingresos POS: S/.
                    <AsyncValue valuePromise={calcularIngresosPOS(c.id!)} />
                  </span>
                  <span>Total: S/. {(c.ingresos_apertura || 0).toFixed(2)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="caja-col">
        <h2>+ Abrir Nueva Caja</h2>
        <div className="form-field">
          <label>Sede</label>
          <select value={selectedSedeId} onChange={(e) => setSelectedSedeId(e.target.value)}>
            <option value="">Seleccionar sede</option>
            {sedes.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Monto Inicial</label>
          <input
            type="number"
            placeholder="S/. 0.00"
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
        <div className="form-field">
          <label>Responsable (Asignado)</label>
          <select value={selectedResponsableId} onChange={(e) => setSelectedResponsableId(e.target.value)}>
            {responsables.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-success full" onClick={abrirCaja}>Abrir Caja</button>
      </aside>
    </div>
  );
};

const AsyncValue: React.FC<{ valuePromise: Promise<number> }> = ({ valuePromise }) => {
  const [value, setValue] = useState<string>('0.00');
  useEffect(() => {
    let mounted = true;
    valuePromise.then((n) => {
      if (mounted) setValue((n || 0).toFixed(2));
    });
    return () => {
      mounted = false;
    };
  }, [valuePromise]);
  return <>{value}</>;
};

export default CajaPage;


