import { getGateway, isGatewayId } from '@/lib/billing/gateways';
import { fulfilOrder } from '@/lib/billing/credits';
import { fulfilPassOrder } from '@/lib/billing/entitlements';
import { db } from '@/db';
import { activityLog } from '@/db/schema';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;

  if (!isGatewayId(gateway)) {
    return Response.json({ error: 'unknown gateway' }, { status: 404 });
  }

  // The raw body is required for signature verification — it must be read
  // before anything parses it, and must not be re-serialised.
  const rawBody = await request.text();

  let order;
  try {
    order = await getGateway(gateway).handleWebhook(request, rawBody);
  } catch (error) {
    console.error(`[webhook:${gateway}] rejected`, error);
    return Response.json({ error: 'verification failed' }, { status: 400 });
  }

  // 200 on events we deliberately ignore, so the provider stops retrying them.
  if (!order) return Response.json({ status: 'ignored' });

  const outcome = await fulfilOrder(order.id);
  // Pass orders carry zero credits (fulfilOrder is a no-op for them beyond
  // the idempotency flag) — the entitlement is the actual product, granted
  // here. See docs/12-billing-overhaul.md.
  if (order.kind === 'pass') await fulfilPassOrder(order.id);

  await db.insert(activityLog).values({
    userId: order.userId,
    action: 'order.paid',
    description: `Order ${order.reference} paid via ${gateway}`,
    meta: { gateway, outcome, reference: order.reference },
  });

  return Response.json({ status: 'ok', outcome });
}
