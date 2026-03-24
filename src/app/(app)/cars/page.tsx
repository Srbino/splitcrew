'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, avatarColorClass } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

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
  const csrfToken =
    document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute('content') || '';
  const options: RequestInit = {
    method,
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
  };
  if (data && method !== 'GET') options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  return res.json();
}

function CrewAvatar({
  name,
  avatar,
  userId,
  size = 'sm',
}: {
  name: string;
  avatar: string | null;
  userId: number;
  size?: 'sm' | 'default';
}) {
  return (
    <Avatar size={size}>
      {avatar ? (
        <AvatarImage src={avatar} alt={name} />
      ) : null}
      <AvatarFallback className={avatarColorClass(userId)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export default function CarsPage() {
  const { t } = useI18n();
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

  const availableDrivers = unassigned;

  if (loading) {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('cars.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('cars.title')}</h1>
      </div>

      {/* Car cards */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {cars.map((car) => {
            const occupiedSeats = car.passengers.length + 1;
            const availableSeats = car.seats - occupiedSeats;

            return (
              <motion.div
                key={car.id}
                layout
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                <Card className="py-0">
                  <CardContent className="p-5">
                    {/* Car header */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10">
                          <Car className="size-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-[1.05rem] font-semibold">
                            {car.car_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {occupiedSeats}/{car.seats} seats filled
                            {car.note && <> &middot; {car.note}</>}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeleteCarId(car.id)}
                        aria-label="Delete car"
                        className="shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {/* Driver */}
                    <div className="mb-3">
                      <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                        {t('cars.driver')}
                      </div>
                      <div className="flex items-center gap-2">
                        <CrewAvatar
                          name={car.driver_name}
                          avatar={car.driver_avatar}
                          userId={car.driver_user_id}
                        />
                        <span className="text-sm font-medium">
                          {car.driver_name}
                        </span>
                      </div>
                    </div>

                    {/* Passengers */}
                    <div>
                      <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                        {t('cars.passengers')} ({car.passengers.length})
                      </div>

                      {car.passengers.length === 0 && (
                        <p className="text-sm text-muted-foreground/60">
                          {t('cars.noPassengersYet')}
                        </p>
                      )}

                      <AnimatePresence mode="popLayout">
                        <div className="flex flex-col gap-1.5">
                          {car.passengers.map((p) => (
                            <motion.div
                              key={p.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <CrewAvatar
                                  name={p.user_name}
                                  avatar={p.user_avatar}
                                  userId={p.user_id}
                                />
                                <span className="text-sm">{p.user_name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleRemovePassenger(p.id)}
                                aria-label={`Remove ${p.user_name}`}
                              >
                                <UserMinus className="size-3.5 text-muted-foreground" />
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </AnimatePresence>

                      {/* Add passenger button */}
                      {availableSeats > 0 && unassigned.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => openAddPassengerModal(car.id)}
                        >
                          <UserPlus className="size-3.5" />
                          {t('cars.addPassenger')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Unassigned crew */}
      {unassigned.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-3">
            {t('cars.unassigned')} ({unassigned.length})
          </h3>
          <Card className="py-0">
            <CardContent className="p-4">
              <div className="flex flex-col gap-2">
                {unassigned.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <CrewAvatar
                      name={u.name}
                      avatar={u.avatar}
                      userId={u.id}
                    />
                    <span className="text-sm">{u.name}</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[0.7rem]"
                    >
                      {u.boat_name}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FAB - Add car */}
      <button
        className="fixed bottom-24 right-5 md:bottom-8 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        onClick={() => setShowAddModal(true)}
        aria-label="Add car"
      >
        <Plus className="size-6" />
      </button>

      {/* Add Car Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('cars.addCar')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddCar} disabled={saving}>
              {saving ? t('common.saving') : t('cars.addCar')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t('cars.driver')}</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={newCarDriver}
              onChange={(e) => setNewCarDriver(Number(e.target.value))}
            >
              <option value={0}>{t('cars.selectDriver')}</option>
              {availableDrivers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('cars.carName')}</Label>
            <Input
              value={newCarName}
              onChange={(e) => setNewCarName(e.target.value)}
              placeholder="e.g. Silver Skoda"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('cars.seats')}</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={newCarSeats}
              onChange={(e) => setNewCarSeats(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('cars.note')}</Label>
            <Input
              value={newCarNote}
              onChange={(e) => setNewCarNote(e.target.value)}
              placeholder="e.g. Meet at parking lot B"
            />
          </div>
        </div>
      </Modal>

      {/* Add Passenger Modal */}
      <Modal
        isOpen={showPassengerModal}
        onClose={() => setShowPassengerModal(false)}
        title={t('cars.addPassenger')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPassengerModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddPassenger} disabled={saving}>
              {saving ? t('common.saving') : t('common.add')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label>{t('cars.selectPerson')}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={passengerUserId}
            onChange={(e) => setPassengerUserId(Number(e.target.value))}
          >
            <option value={0}>{t('cars.selectPerson')}</option>
            {unassigned.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteCarId !== null}
        onClose={() => setDeleteCarId(null)}
        title={t('cars.deleteCar')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteCarId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCar}
              disabled={saving}
            >
              {saving ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('cars.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
