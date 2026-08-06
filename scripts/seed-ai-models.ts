/**
 * One-time (but idempotent — safe to re-run) seed of ai_providers/ai_models
 * from src/lib/ai/seed-data.ts (a snapshot of the old static PROVIDERS
 * const). Run once against production when Phase 3 ships; re-run against
 * any fresh database (e.g. a new environment) after `db:migrate`.
 *
 *   npx tsx scripts/seed-ai-models.ts
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { PROVIDER_SEED } from '../src/lib/ai/seed-data';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });
  const { aiProviders, aiModels } = schema;

  let providersUpserted = 0;
  let modelsUpserted = 0;

  for (const seed of PROVIDER_SEED) {
    const [existing] = await db.select({ id: aiProviders.id }).from(aiProviders).where(eq(aiProviders.key, seed.key)).limit(1);

    const providerValues = {
      label: seed.label,
      supports: [...seed.supports],
      defaultModel: seed.defaultModel,
      apiKeyEnv: seed.apiKeyEnv,
      baseUrlEnv: seed.baseUrlEnv,
      fallbackBaseUrl: seed.fallbackBaseUrl,
      sort: seed.sort,
    };

    const providerId = existing
      ? (await db.update(aiProviders).set(providerValues).where(eq(aiProviders.id, existing.id)).returning({ id: aiProviders.id }))[0].id
      : (await db.insert(aiProviders).values({ key: seed.key, ...providerValues }).returning({ id: aiProviders.id }))[0].id;

    providersUpserted++;

    for (const [index, model] of seed.models.entries()) {
      const [existingModel] = await db
        .select({ id: aiModels.id })
        .from(aiModels)
        .where(and(eq(aiModels.providerId, providerId), eq(aiModels.modelId, model.modelId)))
        .limit(1);

      const modelValues = {
        label: model.label,
        tier: model.tier,
        creditsPer1k: model.creditsPer1k,
        sort: index,
      };

      if (existingModel) {
        await db.update(aiModels).set({ ...modelValues, updatedAt: new Date() }).where(eq(aiModels.id, existingModel.id));
      } else {
        await db.insert(aiModels).values({ providerId, modelId: model.modelId, ...modelValues });
      }
      modelsUpserted++;
    }
  }

  console.log(`AI model registry seed OK — ${providersUpserted} providers, ${modelsUpserted} models upserted.`);
  await client.end();
}

main().catch((error) => {
  console.error('AI model registry seed failed:', error);
  process.exit(1);
});
