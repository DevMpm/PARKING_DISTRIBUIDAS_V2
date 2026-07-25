import { useEffect, useState, useCallback } from 'react';
import { zonasApi, espaciosApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useEspaciosSSE } from '../hooks/useEspaciosSSE';
import type { Zona, Espacio, TipoZona, CreateZonaRequest, CreateEspacioRequest, TipoEspacio } from '../types';

const TIPO_ZONA_OPTIONS: TipoZona[] = ['VIP', 'REGULAR', 'INTERNA', 'EXTERNA', 'PREFERENCIAL'];
const TIPO_ESPACIO_OPTIONS: TipoEspacio[] = ['AUTO', 'MOTO', 'BUSETA'];

export default function ZonasPage() {
  const { hasPermission } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [selectedZona, setSelectedZona] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [showEspacioModal, setShowEspacioModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [z, e] = await Promise.all([zonasApi.getAll(), espaciosApi.getAll()]);
      setZonas(z);
      setEspacios(e);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error cargando datos', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Monitoreo en vivo del estado de espacios (SSE)
  useEspaciosSSE(setEspacios);

  const zonasEspacios = selectedZona
    ? espacios.filter(e => e.idZona === selectedZona)
    : espacios;

  const selectedZonaData = zonas.find(z => z.id === selectedZona);

  const [zonaForm, setZonaForm] = useState<CreateZonaRequest>({ nombre: '', tipo: 'REGULAR', capacidad: 10 });

  const handleCreateZona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zonaForm.nombre.trim().length < 2) { addToast('Nombre demasiado corto', 'error'); return; }
    try {
      await zonasApi.create({ ...zonaForm, nombre: zonaForm.nombre.trim() });
      addToast('Zona creada exitosamente', 'success');
      setShowZonaModal(false);
      setZonaForm({ nombre: '', tipo: 'REGULAR', capacidad: 10 });
      loadData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const [espacioForm, setEspacioForm] = useState<CreateEspacioRequest>({ idZona: '', tipo: 'AUTO' });

  const handleCreateEspacio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await espaciosApi.create({ ...espacioForm, idZona: selectedZona || espacioForm.idZona });
      addToast('Espacio creado exitosamente', 'success');
      setShowEspacioModal(false);
      loadData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando zonas...</span></div>;

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Zonas & Espacios</h1>
          <p className="page-subtitle">
            {selectedZona ? `Viendo: ${selectedZonaData?.nombre}` : 'Gestión de zonas de parqueo'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {selectedZona && (
            <button className="btn btn-ghost" onClick={() => setSelectedZona(null)}>← Todas</button>
          )}
          {hasPermission('ZONAS_CREATE') && (
            <>
              <button className="btn btn-primary" onClick={() => setShowZonaModal(true)}>+ Zona</button>
              {selectedZona && (
                <button className="btn btn-success" onClick={() => setShowEspacioModal(true)}>+ Espacio</button>
              )}
            </>
          )}
        </div>
      </div>

      {!selectedZona && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {zonas.map(z => {
            const espZona = espacios.filter(e => e.idZona === z.id);
            const disp = espZona.filter(e => e.estado === 'DISPONIBLE').length;
            const ocup = espZona.filter(e => e.estado === 'OCUPADO').length;
            const pct = espZona.length > 0 ? Math.round((ocup / espZona.length) * 100) : 0;
            return (
              <div key={z.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedZona(z.id)}>
                <div className="card-header">
                  <span className="card-title">{z.nombre}</span>
                  <span className={`badge ${z.estado === 1 ? 'badge-success' : 'badge-danger'}`}>
                    {z.estado === 1 ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-info">{z.tipo}</span>
                  <span className="badge badge-neutral">{z.codigo}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Cap: {z.capacidad}</span>
                  <span style={{ color: 'var(--success)' }}>✅ {disp}</span>
                  <span style={{ color: 'var(--danger)' }}>🚗 {ocup}</span>
                  <span>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedZona && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Espacios de {selectedZonaData?.nombre} ({zonasEspacios.length})
            </span>
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--success)' }}>✅ {zonasEspacios.filter(e => e.estado === 'DISPONIBLE').length}</span>
              <span style={{ color: 'var(--danger)' }}>🚗 {zonasEspacios.filter(e => e.estado === 'OCUPADO').length}</span>
            </div>
          </div>
          <div className="espacios-grid">
            {zonasEspacios.map(e => (
              <div key={e.id} className={`espacio-slot ${e.estado.toLowerCase()}`} title={`${e.codigo} · ${e.tipo} · ${e.estado}`}>
                <span className="espacio-code">{e.codigo}</span>
                <span className="espacio-type">{e.tipo}</span>
                <span className="espacio-status">{e.estado}</span>
              </div>
            ))}
            {zonasEspacios.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state-icon">🅿️</div>
                <div className="empty-state-text">No hay espacios. Usa "+ Espacio" para crear uno.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showZonaModal && (
        <div className="modal-overlay" onClick={() => setShowZonaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🅿️ Crear Zona</h2>
            <form onSubmit={handleCreateZona}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input value={zonaForm.nombre} onChange={e => setZonaForm({ ...zonaForm, nombre: e.target.value })} maxLength={50} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input value={zonaForm.descripcion || ''} onChange={e => setZonaForm({ ...zonaForm, descripcion: e.target.value })} maxLength={200} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select value={zonaForm.tipo} onChange={e => setZonaForm({ ...zonaForm, tipo: e.target.value as TipoZona })}>
                    {TIPO_ZONA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Capacidad</label>
                  <input type="number" min={1} max={200} value={zonaForm.capacidad} onChange={e => setZonaForm({ ...zonaForm, capacidad: +e.target.value })} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowZonaModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Zona</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEspacioModal && (
        <div className="modal-overlay" onClick={() => setShowEspacioModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🅿️ Crear Espacio</h2>
            <form onSubmit={handleCreateEspacio}>
              <div className="form-group">
                <label className="form-label">Zona</label>
                <input value={selectedZonaData?.nombre || ''} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select value={espacioForm.tipo} onChange={e => setEspacioForm({ ...espacioForm, tipo: e.target.value as TipoEspacio })}>
                  {TIPO_ESPACIO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input value={espacioForm.descripcion || ''} onChange={e => setEspacioForm({ ...espacioForm, descripcion: e.target.value })} maxLength={100} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEspacioModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Espacio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
