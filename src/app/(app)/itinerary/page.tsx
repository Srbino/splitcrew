import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { Sailboat, Anchor, Car, MapPin, Calendar } from 'lucide-react';

interface ItineraryDay {
  id: number;
  day_number: number;
  date: string;
  title: string;
  description: string | null;
  type: string;
  location_from: string | null;
  location_to: string | null;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; Icon: typeof Sailboat }> = {
  sailing: { color: 'var(--color-info)', bg: 'var(--color-info-bg, rgba(0,122,255,0.1))', Icon: Sailboat },
  port: { color: 'var(--color-success)', bg: 'var(--color-success-bg, rgba(52,199,89,0.1))', Icon: Anchor },
  car: { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-secondary)', Icon: Car },
};

export default async function ItineraryPage() {
  await requireAuth();

  const days = await query<ItineraryDay>(
    'SELECT * FROM itinerary ORDER BY sort_order, date, id'
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Itinerary</h1>
      </div>

      {days.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--card-pad-spacious)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            No itinerary planned yet.
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: 7,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--color-border)',
            borderRadius: 1,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {days.map(day => {
              const config = TYPE_CONFIG[day.type] || TYPE_CONFIG.port;
              const TypeIcon = config.Icon;

              return (
                <div key={day.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: -24,
                    top: 16,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: config.color,
                    border: '3px solid var(--color-bg)',
                    zIndex: 1,
                  }} />

                  <div className="card">
                    <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
                      {/* Date and type badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          <Calendar size={13} />
                          {formatDate(day.date)}
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: config.bg,
                            color: config.color,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          <TypeIcon size={12} style={{ marginRight: 4 }} />
                          {day.type}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                        {day.title}
                      </h3>

                      {/* From -> To */}
                      {(day.location_from || day.location_to) && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.85rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: 4,
                        }}>
                          <MapPin size={13} />
                          {day.location_from && <span>{day.location_from}</span>}
                          {day.location_from && day.location_to && <span>&rarr;</span>}
                          {day.location_to && <span>{day.location_to}</span>}
                        </div>
                      )}

                      {/* Description */}
                      {day.description && (
                        <p style={{
                          fontSize: '0.85rem',
                          color: 'var(--color-text-secondary)',
                          margin: '8px 0 0 0',
                          lineHeight: 1.5,
                        }}>
                          {day.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
