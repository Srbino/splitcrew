import { AnimatedPage, AnimatedList, AnimatedItem } from '@/components/shared/animations';
import { requireAuth } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getInitials, avatarColorClass } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const locale = await getSetting('language', 'en');

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

  const boatsWithCrew: BoatWithCrew[] = boats.map(boat => ({
    id: boat.id,
    name: boat.name,
    crew: users.filter(u => u.boat_id === boat.id),
  }));

  return (
    <AnimatedPage>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t(locale, 'crews.title')}</h1>
      </div>

      <AnimatedList className="flex flex-col gap-5">
        {boatsWithCrew.map(boat => (
          <div key={boat.id}>
            <div className="flex items-center gap-2 mb-3">
              <Sailboat size={18} className="text-primary" />
              <h2 className="text-lg font-semibold">
                {boat.name}
              </h2>
              <Badge variant="secondary" className="ml-1">
                {boat.crew.length} {t(locale, 'crews.crew')}
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              {boat.crew.map(member => (
                <AnimatedItem key={member.id}>
                <Card className="py-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar size="lg">
                        {member.avatar ? (
                          <AvatarImage
                            src={member.avatar.startsWith('/') ? member.avatar : `/${member.avatar}`}
                            alt={member.name}
                          />
                        ) : null}
                        <AvatarFallback className={avatarColorClass(member.id)}>
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base">{member.name}</div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {member.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone size={13} />
                              <a
                                href={`tel:${member.phone}`}
                                className="text-inherit no-underline hover:underline"
                              >
                                {member.phone}
                              </a>
                            </div>
                          )}
                          {member.email && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail size={13} />
                              <a
                                href={`mailto:${member.email}`}
                                className="text-inherit no-underline hover:underline"
                              >
                                {member.email}
                              </a>
                            </div>
                          )}
                          {!member.phone && !member.email && (
                            <div className="text-sm text-muted-foreground/60">
                              {t(locale, 'crews.noContactInfo')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </AnimatedItem>
              ))}

              {boat.crew.length === 0 && (
                <Card className="py-0">
                  <CardContent className="p-4 text-center text-muted-foreground/60">
                    {t(locale, 'crews.noCrewAssigned')}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}
      </AnimatedList>
    </AnimatedPage>
  );
}
