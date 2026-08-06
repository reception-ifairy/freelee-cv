import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { teamInvitations, teams } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AcceptForm } from './accept-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team invitation' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();

  const [row] = await db
    .select({ email: teamInvitations.email, role: teamInvitations.role, expiresAt: teamInvitations.expiresAt, acceptedAt: teamInvitations.acceptedAt, teamName: teams.name })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .where(eq(teamInvitations.token, token))
    .limit(1);

  return (
    <div className="container-app py-16">
      <Card className="mx-auto max-w-md p-6">
        {!row ? (
          <p className="text-sm text-slate-500">This invitation link is invalid.</p>
        ) : row.acceptedAt ? (
          <p className="text-sm text-slate-500">This invitation has already been used.</p>
        ) : row.expiresAt < new Date() ? (
          <p className="text-sm text-slate-500">This invitation has expired — ask for a new one.</p>
        ) : (
          <>
            <CardHeader className="p-0">
              <CardTitle>Join {row.teamName}</CardTitle>
              <CardDescription>
                You&apos;ve been invited as <strong>{row.role}</strong>, to {row.email}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-5">
              {!user ? (
                <p className="text-sm text-slate-500">
                  <Link href={`/login?redirectTo=/invite/${token}`} className="font-medium text-brand-600 hover:underline">
                    Sign in
                  </Link>{' '}
                  or{' '}
                  <Link href="/register" className="font-medium text-brand-600 hover:underline">
                    create an account
                  </Link>{' '}
                  with {row.email} to accept.
                </p>
              ) : (
                <AcceptForm token={token} />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
