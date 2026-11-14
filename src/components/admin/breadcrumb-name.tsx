'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/**
 * The real name of what a detail page shows, for the header's last crumb.
 *
 * The breadcrumb lives in the layout and only knows the URL, so a detail page
 * read "Taxonomy › Details" — ids are not names, and looking them up there
 * would cost a query on every admin page. The page already has the name; it
 * renders `<BreadcrumbName name={…} />` and the header shows it.
 */
const NameContext = createContext<{ name: string | null; setName: (name: string | null) => void }>({
  name: null,
  setName: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  return <NameContext.Provider value={{ name, setName }}>{children}</NameContext.Provider>;
}

export function useBreadcrumbName(): string | null {
  return useContext(NameContext).name;
}

export function BreadcrumbName({ name }: { name: string }) {
  const { setName } = useContext(NameContext);
  useEffect(() => {
    setName(name);
    return () => setName(null);
  }, [name, setName]);
  return null;
}
