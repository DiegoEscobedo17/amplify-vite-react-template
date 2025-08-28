import React, { useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import '../components/ce/ce.css';

const client = generateClient<Schema>();

type TipoComprobante = 'Todos' | '01' | '03' | '07' | '08';
type EstadoSUNAT = 'Todos' | 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'OBSERVADO';

export const CEPage: React.FC = () => {
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');
  const [tipo, setTipo] = useState<TipoComprobante>('Todos');
  const [estado, setEstado] = useState<EstadoSUNAT>('Todos');
  const [serie, setSerie] = useState<string>('');
  const [numero, setNumero] = useState<string>('');
  const [clienteQuery, setClienteQuery] = useState<string>('');
  const [items, setItems] = useState<Array<Schema['ComprobanteElectronico']['type']>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const filtro = useMemo(() => {
    const cond: any = {};
    if (tipo !== 'Todos') cond.tipo_comprobante = { eq: tipo };
    if (estado !== 'Todos') cond.estado_sunat = { eq: estado };
    if (serie) cond.serie = { eq: serie };
    if (numero) cond.numero = { eq: parseInt(numero, 10) || 0 };
    if (desde) cond.fecha_emision = { ...(cond.fecha_emision || {}), ge: new Date(desde).toISOString() };
    if (hasta) cond.fecha_emision = { ...(cond.fecha_emision || {}), le: new Date(hasta).toISOString() };
    if (clienteQuery) cond.receptor_razon_social = { contains: clienteQuery };
    return cond;
  }, [tipo, estado, serie, numero, desde, hasta, clienteQuery]);

  const cargar = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await client.models.ComprobanteElectronico.list({
        filter: Object.keys(filtro).length ? filtro : undefined,
        limit: 1000,
      });
      const arr = resp.data.sort((a, b) => (b.fecha_emision || '').localeCompare(a.fecha_emision || ''));
      setItems(arr);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error cargando comprobantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const procesar = async () => {
    // Placeholder: en una implementación real, aquí llamarías a una Function que envíe a SUNAT
    alert('Procesamiento a SUNAT no implementado todavía');
  };

  const labelTipo = (t?: string | null) => {
    switch (t) {
      case '01': return 'Factura';
      case '03': return 'Boleta';
      case '07': return 'Nota de Crédito';
      case '08': return 'Nota de Débito';
      default: return '—';
    }
  };

  const badgeEstado = (e?: string | null) => {
    const text = e || 'PENDIENTE';
    const cls = text === 'PENDIENTE' ? 'pill-yellow' : text === 'ACEPTADO' ? 'pill-green' : 'pill-red';
    return <span className={`pill ${cls}`}>{text}</span>;
  };

  return (
    <div className="ce-page">
      <h2>Comprobantes Electrónicos</h2>

      <div className="ce-filtros">
        <div className="filtro"><label>Fecha Inicio</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="filtro"><label>Fecha Fin</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="filtro"><label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoComprobante)}>
            <option value="Todos">Todos</option>
            <option value="01">Factura</option>
            <option value="03">Boleta</option>
            <option value="07">Nota de Crédito</option>
            <option value="08">Nota de Débito</option>
          </select>
        </div>
        <div className="filtro"><label>Estado SUNAT</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoSUNAT)}>
            <option value="Todos">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ACEPTADO">Aceptado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="OBSERVADO">Observado</option>
          </select>
        </div>
        <div className="filtro"><label>Serie</label><input placeholder="B001 / F001" value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} /></div>
        <div className="filtro"><label>Número</label><input placeholder="000123" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
        <div className="filtro filtro-wide"><label>Cliente (Razón Social / Doc.)</label><input placeholder="Buscar cliente" value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)} /></div>
        <div className="filtro acciones">
          <button className="btn" onClick={cargar}>Filtrar</button>
          <button className="btn-refresh" onClick={procesar}>Procesar</button>
        </div>
      </div>

      {loading && <div className="caja-info">Cargando...</div>}
      {errorMsg && <div className="caja-error">{errorMsg}</div>}

      <div className="ce-table-wrap">
        <table className="ce-table">
          <thead>
            <tr>
              <th>COMPROBANTE</th>
              <th>FECHA</th>
              <th>CLIENTE</th>
              <th>ESTADO SUNAT</th>
              <th>TOTAL</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={`${i.serie}-${i.numero}`}>
                <td>{labelTipo(i.tipo_comprobante)} {i.serie}-{String(i.numero).padStart(8, '0')}</td>
                <td>{i.fecha_emision ? new Date(i.fecha_emision).toLocaleString() : '—'}</td>
                <td>
                  <div className="cliente">
                    <div className="cliente-rs">{i.receptor_razon_social}</div>
                    <div className="cliente-doc">{i.receptor_tipo_documento} {i.receptor_numero_documento}</div>
                  </div>
                </td>
                <td>{badgeEstado(i.estado_sunat)}</td>
                <td>S/. {(i.total || 0).toFixed(2)}</td>
                <td>
                  <div className="acciones">
                    <button className="btn" onClick={() => alert('Ver no implementado')}>Ver</button>
                    <button className="btn" onClick={() => alert('PDF no implementado')}>PDF</button>
                    <button className="btn-danger" onClick={() => alert('Anular no implementado')}>Anular</button>
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

export default CEPage;


