import { redirect } from 'next/navigation';

import { cloudPath } from '@/lib/routes';

/** The cloud is home. */
export default function HomePage() {
  redirect(cloudPath);
}
