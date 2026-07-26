import { useEffect, useState } from 'react';
import { vehiculosApi } from '../api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import type { Vehiculo, CreateVehiculoRequest, TipoVehiculo, Clasificacion } from '../types';

const TIPOS: TipoVehiculo[] = ['Auto', 'Motocicleta', 'Camioneta'];
const CLASIFICACIONES: Clasificacion[] = ['Electrico', 'Gasolina', 'Diesel', 'Hibrido'];

export default function VehiculosPage() {
  const { addToast, ToastContainer } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('VEHICULOS_CREATE');
  const canDelete = hasPermission('VEHICULOS_DELETE');
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tipo, setTipo] = useState<TipoVehiculo>('Auto');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    placa: '', marca: '', modelo: '', color: '', anio: new Date().getFullYear(),
    clasificacion: 'Gasolina' as string,
    numeroPuertas: 4, capacidadMaletero: 400,
    tipoMoto: 'Deportiva', cabina: 'simple', capacidadCarga: 800,
  });

  useEffect(() => { loadVehiculos(); }, []);

  const loadVehiculos = async () => {
    try { setVehiculos(await vehiculosApi.getAll()); } catch { /* */ }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const placaRegex = tipo === 'Motocicleta' ? /^[A-Z]{3}-\d{3}[A-Z]$/ : /^[A-Z]{3}-\d{4}$/;
    if (!placaRegex.test(form.placa)) {
      addToast(`Formato de placa inválido. ${tipo === 'Motocicleta' ? 'Ej: ABC-123D' : 'Ej: ABC-1234'}`, 'error');
      return;
    }
    setCreating(true);
    try {
      const payload: CreateVehiculoRequest = {
        tipo,
        datos: {
          placa: form.placa, marca: form.marca.trim(), modelo: form.modelo.trim(),
          color: form.color.trim(), anio: form.anio, clasificacion: form.clasificacion,
          ...(tipo === 'Auto' ? { numeroPuertas: form.numeroPuertas, capacidadMaletero: form.capacidadMaletero } : {}),
          ...(tipo === 'Motocicleta' ? { tipoMoto: form.tipoMoto } : {}),
          ...(tipo === 'Camioneta' ? { cabina: form.cabina, capacidadCarga: form.capacidadCarga } : {}),
        },
      };
      await vehiculosApi.create(payload);
      addToast('Vehículo creado', 'success');
      setShowModal(false);
      setForm({ placa: '', marca: '', modelo: '', color: '', anio: new Date().getFullYear(), clasificacion: 'Gasolina', numeroPuertas: 4, capacidadMaletero: 400, tipoMoto: 'Deportiva', cabina: 'simple', capacidadCarga: 800 });
      loadVehiculos();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vehiculosApi.delete(id);
      addToast('Vehículo eliminado', 'success');
      loadVehiculos();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>;

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehículos</h1>
          <p className="page-subtitle">Todos los vehículos del sistema</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Vehículo</button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Registro ({vehiculos.length})</span>
        </div>
        {vehiculos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚗</div>
            <div className="empty-state-title">Sin vehículos</div>
            <div className="empty-state-text">No hay vehículos registrados en el sistema.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Año</th>
                  <th>Tipo</th>
                  <th>Combustible</th>
                  <th>Estado</th>
                  {canDelete && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {vehiculos.map(v => (
                  <tr key={v.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>{v.placa}</td>
                    <td>{v.marca}</td>
                    <td>{v.modelo}</td>
                    <td>{v.color}</td>
                    <td>{v.anio}</td>
                    <td><span className="badge badge-info">{v.tipo}</span></td>
                    <td><span className="badge badge-neutral">{v.clasificacion}</span></td>
                    <td>
                      <span className={`badge ${v.activo ? 'badge-success' : 'badge-danger'}`}>
                        {v.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canDelete && (
                      <td>
                        <button className="btn btn-xs btn-danger" onClick={() => handleDelete(v.id)}>Eliminar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🚗 Registrar Vehículo</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoVehiculo)}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Placa *</label>
                <input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} maxLength={8} required
                  placeholder={tipo === 'Motocicleta' ? 'ABC-123D' : 'ABC-1234'} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Marca *</label>
                  <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} maxLength={30} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} maxLength={107} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Color *</label>
                  <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} maxLength={64} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Año *</label>
                  <input type="number" value={form.anio} onChange={e => setForm({ ...form, anio: +e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Combustible</label>
                <select value={form.clasificacion} onChange={e => setForm({ ...form, clasificacion: e.target.value })}>
                  {CLASIFICACIONES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {tipo === 'Auto' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Puertas</label>
                    <input type="number" min={2} max={5} value={form.numeroPuertas} onChange={e => setForm({ ...form, numeroPuertas: +e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Maletero (kg)</label>
                    <input type="number" min={150} max={800} value={form.capacidadMaletero} onChange={e => setForm({ ...form, capacidadMaletero: +e.target.value })} />
                  </div>
                </div>
              )}
              {tipo === 'Motocicleta' && (
                <div className="form-group">
                  <label className="form-label">Tipo de Moto</label>
                  <select value={form.tipoMoto} onChange={e => setForm({ ...form, tipoMoto: e.target.value })}>
                    <option value="Deportiva">Deportiva</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Motocross">Motocross</option>
                  </select>
                </div>
              )}
              {tipo === 'Camioneta' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cabina</label>
                    <select value={form.cabina} onChange={e => setForm({ ...form, cabina: e.target.value })}>
                      <option value="simple">Simple</option>
                      <option value="doble">Doble</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Carga (kg)</label>
                    <input type="number" min={450} max={1360} value={form.capacidadCarga} onChange={e => setForm({ ...form, capacidadCarga: +e.target.value })} />
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
