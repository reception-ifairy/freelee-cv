'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/server/actions/auth';
import { initialsOf } from '@/lib/utils';

type Props = { name: string; email: string; isAdmin: boolean; roomsEnabled?: boolean; crewsEnabled?: boolean };

export function UserMenu({ name, email, isAdmin, roomsEnabled = false, crewsEnabled = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white transition hover:ring-2 hover:ring-brand-200"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initialsOf(name)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>

          <Link href="/dashboard" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            Dashboard
          </Link>
          <Link href="/chat" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            My chats
          </Link>
          {roomsEnabled ? (
            <Link href="/rooms" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              Rooms
            </Link>
          ) : null}
          {crewsEnabled ? (
            <Link href="/crews" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              Crews
            </Link>
          ) : null}
          <Link href="/marketplace" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            Marketplace
          </Link>
          <Link href="/dashboard/vendor" className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            Vendor dashboard
          </Link>
          <Link
            href="/dashboard/billing"
            className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Billing
          </Link>
          <Link
            href="/dashboard/team"
            className="block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Team
          </Link>

          {isAdmin ? (
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:text-brand-400 dark:hover:bg-slate-800"
            >
              Admin panel
            </Link>
          ) : null}

          <form action={logoutAction} className="border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
