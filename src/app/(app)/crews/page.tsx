import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { Avatar } from '@/components/Avatar';
import { Phone, Mail, Sailboat } from 'lucide-react';

interface BoatWithCrew {
  id: number;
  name: string;
  crew: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    avatar: string | null;
  }[];
}

export default async function CrewsPage() {
  await requireAuth();

  const boats = await query<{ id: number; name: string }>(
    'SELECT * FROM boats ORDER BY id'
  );

  const users = await query<{
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    avatar: string | null;
    boat_id: number;
  }>(
    'SELECT * FROM users ORDER BY name'
  );

  // Group users by boat
  const boatsWithCrew: BoatWithCrew[] = boats.map(boat => ({
    id: boat.id,
    name: boat.name,
    crew: users.filter(u => u.boat_id === boat.id),
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Crews</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {boatsWithCrew.map(boat => (
          <div key={boat.id}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <Sailboat size={18} style={{ color: 'var(--color-brand)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                {boat.name}
              </h2>
              <span className="badge" style={{ marginLeft: 4 }}>
                {boat.crew.length} crew
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {boat.crew.map(member => (
                <div key={member.id} className="card">
                  <div className="card-body" style={{ padding: 'var(--card-pad)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar
                        name={member.name}
                        avatar={member.avatar}
                        size="md"
                        userId={member.id}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{member.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                          {member.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                              <Phone size={13} />
                              <a href={`tel:${member.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {member.phone}
                              </a>
                            </div>
                          )}
                          {member.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                              <Mail size={13} />
                              <a href={`mailto:${member.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {member.email}
                              </a>
                            </div>
                          )}
                          {!member.phone && !member.email && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                              No contact info
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {boat.crew.length === 0 && (
                <div className="card">
                  <div className="card-body" style={{ padding: 'var(--card-pad)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    No crew members assigned
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
