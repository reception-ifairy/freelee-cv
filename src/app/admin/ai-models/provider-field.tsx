'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/field';
import { GridSelect } from '@/components/ui/grid-select';

export function ProviderField({ providers }: { providers: { id: number; label: string }[] }) {
  const options = providers.map((p) => ({ id: String(p.id), label: p.label }));
  const [value, setValue] = useState(options[0]?.id ?? '');

  return (
    <div>
      <Label htmlFor="providerId">Provider</Label>
      <GridSelect id="providerId" name="providerId" columns={2} value={value} onChange={setValue} options={options} />
    </div>
  );
}
