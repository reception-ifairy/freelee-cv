# Packs, plans and passes

Three ways to sell access. They can all run at once, and most sites should offer at least two.

| | **Credit pack** | **Subscription plan** | **Access pass** |
|---|---|---|---|
| Customer pays | Once | Every week/month/year | Once |
| They get | A lump of credits | Credits topped up each period | Unmetered use for a period |
| Expires? | Never | Renews until cancelled | Yes — that's the point |
| Best for | Occasional users | Regulars | Trials, events, deadlines |
| Predictable revenue | No | **Yes** | No |

## Credit packs — Commerce → Credit packs

The simplest. Pay once, get credits, use them whenever. Nothing expires.

Offer three. People reliably pick the middle one, so make that the one you want them on. Give the
largest a genuine discount per credit — that's what makes it feel like a choice rather than an
upsell.

> 500 credits — £5 · **2,000 credits — £15** (best value) · 5,000 credits — £30

## Subscription plans — Commerce → Subscription plans

Recurring credits on a schedule. Weekly, monthly or yearly. **Stripe only** — PayPal can't do
recurring billing here.

This is the only one that gives you predictable monthly revenue, which matters a lot if you're
paying AI bills every month.

Set **credits per period** a bit above what a typical regular actually uses. Leaving people just
short of enough is a reliable way to lose them.

## Access passes — Commerce → Access passes

Unmetered use for a fixed window — an hour, a day, a week. No credit counting while it's running.

Excellent for: a student the night before an exam, a business trialling you for a week, a
conference offer.

**One risk to understand:** unmetered means unmetered. Someone can use a pass very heavily, and on
an Advanced-tier persona that can cost you more than the pass earned. Price passes against your
*heaviest* plausible user, not your average one.

## Payments

**Settings → Billing** and your environment keys. Stripe supports everything. PayPal handles
one-off purchases only. With no gateway configured, the pricing page says so and nothing can be
bought.
