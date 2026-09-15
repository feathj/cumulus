import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { dayIn, isDayKey, resolveTimeZone, TIME_ZONE_COOKIE } from '@/lib/day';
import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { TodayView } from '../today-view';

/** Today at /today, or any other day at /today/YYYY-MM-DD: routines, the focus blocks and the journal. */
export default async function TodayPage({ params }: PageProps<'/today/[[...day]]'>) {
  const { day: segments } = await params;
  const [requested, ...rest] = segments ?? [];
  if (rest.length || (requested !== undefined && !isDayKey(requested))) notFound();

  // The browser's zone, once it has told us; the server's until then.
  const timeZone = resolveTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
  const day = requested ?? dayIn(new Date(), timeZone);
  await getQueryClient().prefetchQuery(trpc.today.day.queryOptions({ day, timeZone }));

  return (
    <HydrateClient>
      <TodayView day={day} timeZone={timeZone} />
    </HydrateClient>
  );
}
