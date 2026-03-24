import { NextRequest } from 'next/server';
import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute, getAllUsers } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const action = request.nextUrl.searchParams.get('action');

    if (action === 'list') {
      // Get all cars with driver info
      const cars = await query<{
        id: number;
        driver_user_id: number;
        car_name: string;
        seats: number;
        note: string | null;
        driver_name: string;
        driver_avatar: string | null;
      }>(
        `SELECT c.*, u.name AS driver_name, u.avatar AS driver_avatar
         FROM cars c
         LEFT JOIN users u ON c.driver_user_id = u.id
         ORDER BY c.id`
      );

      // Get passengers for each car
      const passengers = await query<{
        id: number;
        car_id: number;
        user_id: number;
        user_name: string;
        user_avatar: string | null;
      }>(
        `SELECT cp.id, cp.car_id, cp.user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM car_passengers cp
         LEFT JOIN users u ON cp.user_id = u.id
         ORDER BY u.name`
      );

      // Group passengers by car
      const passengerMap: Record<number, typeof passengers> = {};
      for (const p of passengers) {
        if (!passengerMap[p.car_id]) passengerMap[p.car_id] = [];
        passengerMap[p.car_id].push(p);
      }

      // Build car data with passengers
      const carsWithPassengers = cars.map(car => ({
        ...car,
        passengers: passengerMap[car.id] || [],
      }));

      // Find unassigned users (not a driver and not a passenger)
      const allUsers = await getAllUsers();
      const assignedUserIds = new Set<number>();
      for (const car of cars) {
        assignedUserIds.add(car.driver_user_id);
      }
      for (const p of passengers) {
        assignedUserIds.add(p.user_id);
      }
      const unassigned = allUsers.filter(u => !assignedUserIds.has(u.id));

      return apiSuccess({ cars: carsWithPassengers, unassigned });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Cars GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { action } = body;

    if (action === 'add_car') {
      const { driver_user_id, car_name, seats, note } = body;
      if (!driver_user_id || !car_name || !seats) {
        return apiError('Driver, car name, and seats are required.');
      }
      if (seats < 1 || seats > 20) {
        return apiError('Seats must be between 1 and 20.');
      }

      // Check driver isn't already assigned to a car (as driver)
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM cars WHERE driver_user_id = $1',
        [driver_user_id]
      );
      if (existing) {
        return apiError('This user is already a driver of another car.');
      }

      await execute(
        'INSERT INTO cars (driver_user_id, car_name, seats, note) VALUES ($1, $2, $3, $4)',
        [driver_user_id, car_name, seats, note || null]
      );

      return apiSuccess();
    }

    if (action === 'delete_car') {
      const { id } = body;
      if (!id) return apiError('Car ID is required.');

      // Delete passengers first
      await execute('DELETE FROM car_passengers WHERE car_id = $1', [id]);
      await execute('DELETE FROM cars WHERE id = $1', [id]);

      return apiSuccess();
    }

    if (action === 'add_passenger') {
      const { car_id, user_id } = body;
      if (!car_id || !user_id) {
        return apiError('Car and user are required.');
      }

      // Check seat capacity (driver takes 1 seat)
      const car = await queryOne<{ seats: number }>(
        'SELECT seats FROM cars WHERE id = $1',
        [car_id]
      );
      if (!car) return apiError('Car not found.');

      const passengerCount = await queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM car_passengers WHERE car_id = $1',
        [car_id]
      );
      const currentPassengers = parseInt(passengerCount?.count || '0', 10);

      // Driver takes 1 seat, so available seats for passengers = seats - 1
      if (currentPassengers >= car.seats - 1) {
        return apiError('This car is full. No more seats available.');
      }

      // Check user isn't already in another car
      const existingPassenger = await queryOne<{ id: number }>(
        'SELECT id FROM car_passengers WHERE user_id = $1',
        [user_id]
      );
      if (existingPassenger) {
        return apiError('This user is already assigned to a car.');
      }

      await execute(
        'INSERT INTO car_passengers (car_id, user_id) VALUES ($1, $2)',
        [car_id, user_id]
      );

      return apiSuccess();
    }

    if (action === 'remove_passenger') {
      const { passenger_id } = body;
      if (!passenger_id) return apiError('Passenger ID is required.');

      await execute('DELETE FROM car_passengers WHERE id = $1', [passenger_id]);

      return apiSuccess();
    }

    return apiError('Invalid action.');
  } catch (err) {
    console.error('Cars POST error:', err);
    return apiError('Server error', 500);
  }
}
