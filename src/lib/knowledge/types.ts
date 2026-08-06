/** One retrieved grounding chunk, normalized across sources. */
export type KnowledgeChunk = {
  title: string;
  text: string;
  citation: string;
  sourceKey: string;
};

export type KnowledgeResult = {
  ok: boolean;
  chunks: KnowledgeChunk[];
  sourceKey: string;
};

export function emptyResult(sourceKey: string): KnowledgeResult {
  return { ok: false, chunks: [], sourceKey };
}
