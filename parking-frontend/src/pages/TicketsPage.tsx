import { useState, useEffect } from 'react';
import { ticketsApi, espaciosApi, zonasApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useEspaciosSSE } from '../hooks/useEspaciosSSE';
import type { Ticket, Espacio, Zona } from '../types';

export default function TicketsPage() {
  const { hasPermission } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [createView, setCreateView] = useState<'visual' | 'manual'>('visual');

  // Create form
  const [selectedEspacio, setSelectedEspacio] = useState('');
  const [selectedZonaFilter, setSelectedZonaFilter] = useState('');
  const [placa, setPlaca] = useState('');
  const [creating, setCreating] = useState(false);

  // Búsqueda de tickets activos por cédula del propietario
  const [searchCedula, setSearchCedula] = useState('');
  const [searching, setSearching] = useState(false);
  const [filterLabel, setFilterLabel] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [e, z, activos] = await Promise.all([
          espaciosApi.getAll(),
          zonasApi.getAll(),
          ticketsApi.getActivos().catch(() => [] as Ticket[]),
        ]);
        setEspacios(e);
        setZonas(z);
        setTickets(activos);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const refreshEspacios = async () => {
    try { setEspacios(await espaciosApi.getAll()); } catch { /* */ }
  };

  // Recarga todos los tickets activos (quita el filtro por cédula)
  const reloadActivos = async () => {
    try {
      setTickets(await ticketsApi.getActivos());
      setFilterLabel('');
    } catch { /* */ }
  };

  // Monitoreo en vivo (SSE): actualiza el estado de espacios y, si no hay un
  // filtro por cédula aplicado, refresca la lista de tickets activos.
  useEspaciosSSE(setEspacios, () => {
    if (!filterLabel) {
      ticketsApi.getActivos().then(setTickets).catch(() => { /* */ });
    }
  });

  const filteredEspacios = selectedZonaFilter
    ? espacios.filter(e => e.idZona === selectedZonaFilter)
    : espacios;

  const disponibles = filteredEspacios.filter(e => e.estado === 'DISPONIBLE');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEspacio) { addToast('Selecciona un espacio', 'error'); return; }
    if (!placa.trim()) { addToast('Ingresa la placa', 'error'); return; }
    // Validate placa format
    const placaClean = placa.trim().toUpperCase();
    if (!/^[A-Z]{3}-\d{3,4}[A-Z]?$/.test(placaClean)) {
      addToast('Formato de placa inválido. Ej: ABC-1234 o ABC-123D', 'error');
      return;
    }
    setCreating(true);
    try {
      const ticket = await ticketsApi.create({
        id_espacio: selectedEspacio,
        placa: placaClean,
      });
      setTickets(prev => [ticket, ...prev]);
      addToast(`Ticket ${ticket.codigo_ticket} generado`, 'success');
      setShowCreateModal(false);
      setPlaca(''); setSelectedEspacio('');
      await refreshEspacios();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error al crear ticket', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Busca los tickets ACTIVOS del propietario a partir de su cédula.
  const handleSearchByCedula = async (e: React.FormEvent) => {
    e.preventDefault();
    const cedula = searchCedula.trim();
    if (!cedula) return;
    setSearching(true);
    try {
      const activos = await ticketsApi.getActivos(cedula);
      setTickets(activos);
      setFilterLabel(`cédula ${cedula}`);
      setShowSearchModal(false);
      addToast(
        activos.length ? `${activos.length} ticket(s) activo(s)` : 'Sin tickets activos para esa cédula',
        activos.length ? 'success' : 'info',
      );
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error al buscar tickets', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSalida = async (id: string) => {
    try {
      const updated = await ticketsApi.registrarSalida(id);
      setTickets(prev => prev.map(t => t.id_ticket === id ? updated : t));
      addToast(`Salida registrada · Valor: $${updated.valor_recaudado?.toFixed(2)}`, 'success');
      await refreshEspacios();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleAnular = async (id: string) => {
    try {
      const updated = await ticketsApi.anular(id, 'Anulación manual');
      setTickets(prev => prev.map(t => t.id_ticket === id ? updated : t));
      addToast('Ticket anulado', 'info');
      await refreshEspacios();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'activo': return 'badge-success';
      case 'pagado': return 'badge-info';
      case 'anulado': return 'badge-danger';
      default: return 'badge-neutral';
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>;

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-subtitle">Gestión de tickets de estacionamiento</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowSearchModal(true)}>🔍 Buscar</button>
          {hasPermission('TICKETS_CREATE') && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Nuevo Ticket</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div><div className="stat-value">{espacios.filter(e => e.estado === 'DISPONIBLE').length}</div><div className="stat-label">Disponibles</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon red">🚗</div>
          <div><div className="stat-value">{espacios.filter(e => e.estado === 'OCUPADO').length}</div><div className="stat-label">Ocupados</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue">🎫</div>
          <div><div className="stat-value">{tickets.filter(t => t.estado_ticket === 'activo').length}</div><div className="stat-label">Tickets Activos</div></div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon yellow">💰</div>
          <div><div className="stat-value">${tickets.filter(t => t.valor_recaudado).reduce((s, t) => s + (t.valor_recaudado || 0), 0).toFixed(2)}</div><div className="stat-label">Recaudado</div></div>
        </div>
      </div>

      {/* Tickets table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            {filterLabel ? `Tickets activos de ${filterLabel}` : 'Tickets activos'} ({tickets.length})
          </span>
          {filterLabel && (
            <button className="btn btn-xs btn-ghost" onClick={reloadActivos}>✕ Ver todos</button>
          )}
        </div>
        {tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎫</div>
            <div className="empty-state-title">Sin tickets activos</div>
            <div className="empty-state-text">
              {filterLabel
                ? 'Esa persona no tiene tickets activos.'
                : 'No hay tickets activos. Genera uno o búscalos por cédula.'}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Placa</th>
                  <th>Usuario</th>
                  <th>Categoría</th>
                  <th>Ingreso</th>
                  <th>Salida</th>
                  <th>Estado</th>
                  <th>Valor</th>
                  {hasPermission('TICKETS_UPDATE') && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id_ticket}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>{t.codigo_ticket}</td>
                    <td><span className="badge badge-neutral">{t.placa}</span></td>
                    <td>
                      {t.id_usuario ? (
                        <span className="badge badge-primary">✓ Registrado</span>
                      ) : (
                        <span className="badge badge-warning">🚶 Visitante</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ marginRight: '0.25rem' }}>{t.categoria_vehiculo}</span>
                      <span className="badge badge-purple">{t.categoria_zona}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(t.fecha_hora_ingreso).toLocaleString('es-EC')}</td>
                    <td style={{ fontSize: '0.78rem' }}>{t.fecha_hora_salida ? new Date(t.fecha_hora_salida).toLocaleString('es-EC') : '—'}</td>
                    <td><span className={`badge ${estadoBadge(t.estado_ticket)}`}>{t.estado_ticket.toUpperCase()}</span></td>
                    <td style={{ fontWeight: 600 }}>{t.valor_recaudado != null ? `$${t.valor_recaudado.toFixed(2)}` : '—'}</td>
                    {hasPermission('TICKETS_UPDATE') && (
                      <td>
                        {t.estado_ticket === 'activo' && (
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button className="btn btn-xs btn-success" onClick={() => handleSalida(t.id_ticket)}>💰 Pagar</button>
                            <button className="btn btn-xs btn-danger" onClick={() => handleAnular(t.id_ticket)}>✕ Anular</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: createView === 'visual' ? '650px' : '500px' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🎫 Generar Ticket</h2>

            {/* View Toggle */}
            <div className="view-toggle" style={{ marginBottom: '1rem' }}>
              <button className={createView === 'visual' ? 'active' : ''} onClick={() => setCreateView('visual')}>
                🗺️ Cuadrícula
              </button>
              <button className={createView === 'manual' ? 'active' : ''} onClick={() => setCreateView('manual')}>
                📝 Formulario
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {createView === 'visual' ? (
                <>
                  {/* Zona filter */}
                  <div className="form-group">
                    <label className="form-label">Filtrar por Zona</label>
                    <select value={selectedZonaFilter} onChange={e => { setSelectedZonaFilter(e.target.value); setSelectedEspacio(''); }}>
                      <option value="">Todas las zonas</option>
                      {zonas.filter(z => z.estado === 1).map(z => (
                        <option key={z.id} value={z.id}>{z.nombre} — {z.tipo}</option>
                      ))}
                    </select>
                  </div>

                  {/* Visual grid */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {disponibles.length} disponibles · Selecciona un espacio
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem' }}>
                        <span style={{ color: 'var(--success)' }}>● Disponible</span>
                        <span style={{ color: 'var(--danger)' }}>● Ocupado</span>
                      </div>
                    </div>
                    <div className="espacios-grid">
                      {filteredEspacios.map(e => (
                        <div
                          key={e.id}
                          className={`espacio-slot ${e.estado.toLowerCase()} ${selectedEspacio === e.id ? 'selected' : ''}`}
                          onClick={() => e.estado === 'DISPONIBLE' && setSelectedEspacio(e.id)}
                          title={`${e.codigo} · ${e.tipo} · ${e.estado}`}
                        >
                          <span className="espacio-code">{e.codigo}</span>
                          <span className="espacio-type">{e.tipo}</span>
                          <span className="espacio-status">{e.estado}</span>
                        </div>
                      ))}
                    </div>
                    {selectedEspacio && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--accent)' }}>
                        ✓ Seleccionado: {espacios.find(e => e.id === selectedEspacio)?.codigo} ({espacios.find(e => e.id === selectedEspacio)?.nombreZona})
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Manual mode */
                <div className="form-group">
                  <label className="form-label">Espacio Disponible</label>
                  <select value={selectedEspacio} onChange={e => setSelectedEspacio(e.target.value)} required>
                    <option value="">Seleccionar espacio...</option>
                    {espacios.filter(e => e.estado === 'DISPONIBLE').map(e => (
                      <option key={e.id} value={e.id}>{e.codigo} — {e.nombreZona} ({e.tipo})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Placa del Vehículo *</label>
                <input
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  placeholder="ABC-1234"
                  maxLength={8}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating || !selectedEspacio}>
                  {creating ? 'Generando...' : 'Generar Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Modal — tickets activos por cédula */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🔍 Buscar tickets activos</h2>
            <form onSubmit={handleSearchByCedula}>
              <div className="form-group">
                <label className="form-label">Cédula del propietario</label>
                <input
                  value={searchCedula}
                  onChange={e => setSearchCedula(e.target.value.replace(/\D/g, ''))}
                  placeholder="1712345678"
                  maxLength={10}
                  inputMode="numeric"
                  autoFocus
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Muestra los tickets ACTIVOS registrados a esa persona.
                </span>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowSearchModal(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
