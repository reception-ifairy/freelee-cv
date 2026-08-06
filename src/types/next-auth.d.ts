/*
 * Auth.js type augmentation.
 *
 * `next-auth` only *re-exports* `User`, `Session` and `JWT` from `@auth/core`.
 * Augmenting the `next-auth` module would therefore declare brand-new
 * interfaces that shadow the real ones (and silently lose `id`, `name`, …),
 * so every augmentation has to target the module where the interface is
 * actually declared.
 */
declare module '@auth/core/types' {
  interface User {
    isAdmin?: boolean;
    defaultTeamId?: string;
  }

  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      defaultTeamId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    uid?: string;
    isAdmin?: boolean;
    defaultTeamId?: string;
  }
}

export {};
