import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { ProfileForm } from './profile-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const session = await requireUser();
  const [account] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!account) throw new Error('Account not found.');

  return (
    <div className="container-app py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <ProfileForm name={account.name} email={account.email} timezone={account.timezone} />
      </div>
    </div>
  );
}
