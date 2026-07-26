import { useEffect, useState } from 'react';
import { zonasApi, espaciosApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useEspaciosSSE } from '../hooks/useEspaciosSSE';
import type { Zona, Espacio } from '../types';

export default function DashboardPage() {
  const { user, isAdmin, isRecaudador } = useAuth();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [z, e] = await Promise.all([zonasApi.getAll(), espaciosApi.getAll()]);
        setZonas(z);
        setEspacios(e);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  // Monitoreo en vivo de ocupación (SSE)
  useEspaciosSSE(setEspacios);

  const disponibles = espacios.filter(e => e.estado === 'DISPONIBLE').length;
  const ocupados = espacios.filter(e => e.estado === 'OCUPADO').length;
  const totalZonas = zonas.filter(z => z.estado === 1).length;
  const ocupacion = espacios.length > 0 ? Math.round((ocupados / espacios.length) * 100) : 0;

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAdmin ? 'Panel Administrativo' : 'Panel de Recaudación'}
          </h1>
          <p className="page-subtitle">Bienvenido, {user?.username} 👋</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon blue">🅿️</div>
          <div>
            <div className="stat-value">{totalZonas}</div>
            <div className="stat-label">Zonas Activas</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-value">{disponibles}</div>
            <div className="stat-label">Espacios Disponibles</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon red">🚗</div>
          <div>
            <div className="stat-value">{ocupados}</div>
            <div className="stat-label">Espacios Ocupados</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon yellow">📊</div>
          <div>
            <div className="stat-value">{ocupacion}%</div>
            <div className="stat-label">Ocupación</div>
          </div>
        </div>
      </div>

      {/* Zone Summary */}
      {zonas.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title">Resumen por Zonas</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Disponibles</th>
                  <th>Ocupados</th>
                  <th>Ocupación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {zonas.map(z => {
                  const espZona = espacios.filter(e => e.idZona === z.id);
                  const disp = espZona.filter(e => e.estado === 'DISPONIBLE').length;
                  const ocup = espZona.filter(e => e.estado === 'OCUPADO').length;
                  const pct = espZona.length > 0 ? Math.round((ocup / espZona.length) * 100) : 0;
                  return (
                    <tr key={z.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{z.nombre}</td>
                      <td><span className="badge badge-info">{z.tipo}</span></td>
                      <td>{z.capacidad}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{disp}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{ocup}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '2rem' }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${z.estado === 1 ? 'badge-success' : 'badge-danger'}`}>
                          {z.estado === 1 ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tus Permisos</span>
            <span className="badge badge-neutral">{user?.permissions.length} permisos</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {user?.permissions.map(p => (
              <span key={p} className="badge badge-info">{p}</span>
            ))}
          </div>
        </div>
      )}

      {isRecaudador && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Accesos Rápidos</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Usa el menú lateral para acceder al módulo de <strong>Tickets</strong> donde puedes generar nuevos tickets 
            y registrar salidas/pagos.
          </p>
        </div>
      )}
    </div>
  );
}
