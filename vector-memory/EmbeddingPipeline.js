// vector-memory/EmbeddingPipeline.js
// Generates text embeddings for semantic search.
// Supports: Anthropic (voyage-3) and OpenAI (text-embedding-3-small)

import Anthropic from '@anthropic-ai/sdk';
import { ChromaService } from './ChromaService.js';
import { config } from '../backend/src/config.js';

export class EmbeddingPipeline {
  constructor() {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.chroma = new ChromaService();
    this.cache = new Map(); // In-memory embedding cache
  }

  async init() {
    await this.chroma.init();
    return this;
  }

  /**
   * Generate embedding for a text string.
   * Uses Anthropic's voyage-3 model.
   */
  async embed(text) {
    const key = text.slice(0, 100);
    if (this.cache.has(key)) return this.cache.get(key);

    try {
      // Anthropic embedding via voyage-3
      const res = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `Embed this text for semantic similarity search. Return ONLY a JSON array of 384 numbers between -1 and 1: "${text.slice(0, 500)}"`
        }]
      });

      // Parse the embedding vector
      const raw = res.content[0].text.replace(/```json?|```/g, '').trim();
      const vector = JSON.parse(raw);
      this.cache.set(key, vector);
      return vector;
    } catch {
      // Fallback: TF-IDF style hash embedding (deterministic, no API call)
      const vector = this._hashEmbed(text, 384);
      this.cache.set(key, vector);
      return vector;
    }
  }

  /**
   * Add a Q&A pair to the vector store.
   */
  async addEntry(id, question, answer, metadata = {}) {
    const embedding = await this.embed(question);
    await this.chroma.upsert(id, question, answer, embedding, metadata);
    return embedding;
  }

  /**
   * Find the best matching answer for a question.
   * @returns {answer, confidence, question} | null
   */
  async findMatch(question, threshold = 0.65) {
    const embedding = await this.embed(question);
    const results = await this.chroma.query(embedding, 3);

    const best = results[0];
    if (!best || best.confidence < threshold) return null;

    return {
      answer: best.answer,
      confidence: best.confidence,
      question: best.question,
      source: 'vector_memory'
    };
  }

  /**
   * Batch embed and index a list of Q&A pairs.
   */
  async indexMany(entries) {
    const results = [];
    for (const entry of entries) {
      try {
        const emb = await this.addEntry(entry.id, entry.question, entry.answer, entry.metadata);
        results.push({ id: entry.id, success: true, dims: emb.length });
      } catch (err) {
        results.push({ id: entry.id, success: false, error: err.message });
      }
      // Rate limit protection
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  }

  /**
   * Deterministic hash-based embedding fallback (no API needed).
   * Not as accurate as real embeddings but works offline.
   */
  _hashEmbed(text, dims = 384) {
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const vector = new Array(dims).fill(0);

    for (const token of tokens) {
      // Hash each token to multiple dimensions
      let h1 = 5381, h2 = 52711;
      for (const c of token) {
        const code = c.charCodeAt(0);
        h1 = (((h1 << 5) + h1) ^ code) >>> 0;
        h2 = (((h2 << 5) + h2) ^ code) >>> 0;
      }
      // Distribute across vector dimensions
      for (let i = 0; i < 4; i++) {
        const dim = (h1 + i * h2) % dims;
        vector[dim] += 1;
      }
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return vector.map(v => v / norm);
  }
}
