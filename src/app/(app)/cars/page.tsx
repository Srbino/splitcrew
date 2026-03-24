'use client';

import { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';

interface Passenger {
  id: number;
  car_id: number;
  user_id: number;
  user_name: string;
  user_avatar: string | null;
}

interface CarData {
  id: number;
  driver_user_id: number;
  car_name: string;
  seats: number;
  note: string | null;
  driver_name: string;
  driver_avatar: string | null;
  passengers: Passenger[];
}

interface UnassignedUser {
  id: number;
  name: string;
  avatar: string | null;
  boat_name: string;
}

async function apiCall(url: string, method = 'GET', data?: unknown) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const options: RequestInit = {
    method,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
  };
  if (data && method !== 'GET') options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  return res.json();
}

export default function CarsPage() {
  const [cars, setCars] = useState<CarData[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Add car modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCarName, setNewCarName] = useState('');
  const [newCarSeats, setNewCarSeats] = useState(5);
  const [newCarDriver, setNewCarDriver] = useState(0);
  const [newCarNote, setNewCarNote] = useState('');

  // Add passenger modal
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [passengerCarId, setPassengerCarId] = useState(0);
  const [passengerUserId, setPassengerUserId] = useState(0);

  // Confirm delete
  const [deleteCarId, setDeleteCarId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);

  const loadCars = useCallback(async () => {
    const res = await apiCall('/api/cars?action=list');
    if (res.success) {
      setCars(res.data.cars);
      setUnassigned(res.data.unassigned);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  async function handleAddCar() {
    if (!newCarDriver || !newCarName.trim() || newCarSeats < 1) return;
    setSaving(true);
    const res = await apiCall('/api/cars', 'POST', {
      action: 'add_car',
      driver_user_id: newCarDriver,
      car_name: newCarName.trim(),
      seats: newCarSeats,
      note: newCarNote.trim() || null,
    });
    setSaving(false);
    if (res.success) {
      setShowAddModal(false);
      setNewCarName('');
      setNewCarSeats(5);
      setNewCarDriver(0);
      setNewCarNote('');
      loadCars();
    } else {
      alert(res.error);
    }
  }

  async function handleDeleteCar() {
    if (!deleteCarId) return;
    setSaving(true);
    const res = await apiCall('/api/cars', 'POST', {
      action: 'delete_car',
      id: deleteCarId,
    });
    setSaving(false);
    if (res.success) {
      setDeleteCarId(null);
      loadCars();
    } else {
      alert(res.error);
    }
  }

  async function handleAddPassenger() {
    if (!passengerCarId || !passengerUserId) return;
    setSaving(true);
    const res = await apiCall('/api/cars', 'POST', {
      action: 'add_passenger',
      car_id: passengerCarId,
      user_id: passengerUserId,
    });
    setSaving(false);
    if (res.success) {
      setShowPassengerModal(false);
      setPassengerCarId(0);
      setPassengerUserId(0);
      loadCars();
    } else {
      alert(res.error);
    }
  }

  async function handleRemovePassenger(passengerId: number) {
    const res = await apiCall('/api/cars', 'POST', {
      action: 'remove_passenger',
      passenger_id: passengerId,
    });
    if (res.success) {
      loadCars();
    } else {
      alert(res.error);
    }
  }

  function openAddPassengerModal(carId: number) {
    setPassengerCarId(carId);
    setPassengerUserId(0);
    setShowPassengerModal(true);
  }

  // All users available to be drivers (unassigned users)
  const availableDrivers = unassigned;

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Cars</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Cars</h1>
      </div>

      {/* Car cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cars.map(car => {
          const occupiedSeats = car.passengers.length + 1; // +1 for driver
          const availableSeats = car.seats - occupiedSeats;

          return (
            <div key={car.id} className="card">
              <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
                {/* Car header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--color-brand-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Car size={20} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{car.car_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {occupiedSeats}/{car.seats} seats filled
                        {car.note && <> &middot; {car.note}</>}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteCarId(car.id)}
                    aria-label="Delete car"
                    style={{ flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Driver */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                    Driver
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={car.driver_name} avatar={car.driver_avatar} size="sm" userId={car.driver_user_id} />
                    <span style={{ fontWeight: 500 }}>{car.driver_name}</span>
                  </div>
                </div>

                {/* Passengers */}
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                    Passengers ({car.passengers.length})
                  </div>
                  {car.passengers.length === 0 && (
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.85rem', margin: '4px 0' }}>
                      No passengers yet
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {car.passengers.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={p.user_name} avatar={p.user_avatar} size="sm" userId={p.user_id} />
                          <span>{p.user_name}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleRemovePassenger(p.id)}
                          aria-label={`Remove ${p.user_name}`}
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add passenger button */}
                  {availableSeats > 0 && unassigned.length > 0 && (
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ marginTop: 8 }}
                      onClick={() => openAddPassengerModal(car.id)}
                    >
                      <UserPlus size={14} /> Add passenger
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned crew */}
      {unassigned.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
            Unassigned crew ({unassigned.length})
          </h3>
          <div className="card">
            <div className="card-body" style={{ padding: 'var(--card-pad)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unassigned.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={u.name} avatar={u.avatar} size="sm" userId={u.id} />
                    <span>{u.name}</span>
                    <span className="badge" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>{u.boat_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB - Add car */}
      <button className="fab" onClick={() => setShowAddModal(true)} aria-label="Add car">
        <Plus size={24} />
      </button>

      {/* Add Car Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Car"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddCar} disabled={saving}>
              {saving ? 'Adding...' : 'Add Car'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Driver</label>
          <select
            className="form-control"
            value={newCarDriver}
            onChange={e => setNewCarDriver(Number(e.target.value))}
          >
            <option value={0}>Select driver...</option>
            {availableDrivers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Car Name</label>
          <input
            className="form-control"
            value={newCarName}
            onChange={e => setNewCarName(e.target.value)}
            placeholder="e.g. Silver Skoda"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Total Seats (including driver)</label>
          <input
            className="form-control"
            type="number"
            min={1}
            max={20}
            value={newCarSeats}
            onChange={e => setNewCarSeats(Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Note (optional)</label>
          <input
            className="form-control"
            value={newCarNote}
            onChange={e => setNewCarNote(e.target.value)}
            placeholder="e.g. Meet at parking lot B"
          />
        </div>
      </Modal>

      {/* Add Passenger Modal */}
      <Modal
        isOpen={showPassengerModal}
        onClose={() => setShowPassengerModal(false)}
        title="Add Passenger"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowPassengerModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddPassenger} disabled={saving}>
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Select crew member</label>
          <select
            className="form-control"
            value={passengerUserId}
            onChange={e => setPassengerUserId(Number(e.target.value))}
          >
            <option value={0}>Select person...</option>
            {unassigned.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteCarId !== null}
        onClose={() => setDeleteCarId(null)}
        title="Delete Car"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteCarId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDeleteCar} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <p>Are you sure you want to delete this car? All passengers will be unassigned.</p>
      </Modal>
    </>
  );
}
