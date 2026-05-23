// vector-memory/ChromaService.js
// ChromaDB vector store for semantic question-answer matching
// Run ChromaDB locally: docker run -p 8000:8000 chromadb/chroma

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_NAME = 'form_qa_memory';

export class ChromaService {
  constructor() {
    this.collectionId = null;
  }

  async init() {
    // Create or get the collection
    try {
      const res = await this._request('POST', '/api/v1/collections', {
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' }
      });
      this.collectionId = res.id;
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('UniqueConstraint')) {
        const res = await this._request('GET', `/api/v1/collections/${COLLECTION_NAME}`);
        this.collectionId = res.id;
      } else {
        throw err;
      }
    }
    console.log('[ChromaService] Collection ready:', this.collectionId);
    return this;
  }

  /**
   * Add or update a Q&A entry in the vector store.
   * @param {string} id - Unique entry ID
   * @param {string} question - The form question
   * @param {string} answer - The answer
   * @param {number[]} embedding - Vector embedding (1536-dim for OpenAI, 384-dim for sentence-transformers)
   * @param {object} metadata - Extra context
   */
  async upsert(id, question, answer, embedding, metadata = {}) {
    if (!this.collectionId) await this.init();
    await this._request('POST', `/api/v1/collections/${this.collectionId}/upsert`, {
      ids: [id],
      documents: [question],
      embeddings: [embedding],
      metadatas: [{ answer, ...metadata, updatedAt: new Date().toISOString() }]
    });
  }

  /**
   * Find the most semantically similar questions to a query.
   * @param {number[]} queryEmbedding - Query vector
   * @param {number} nResults - Number of results to return
   * @returns {Array<{id, question, answer, distance, confidence}>}
   */
  async query(queryEmbedding, nResults = 5) {
    if (!this.collectionId) await this.init();
    const res = await this._request('POST', `/api/v1/collections/${this.collectionId}/query`, {
      query_embeddings: [queryEmbedding],
      n_results: nResults,
      include: ['documents', 'metadatas', 'distances']
    });

    const results = [];
    const ids = res.ids?.[0] || [];
    const docs = res.documents?.[0] || [];
    const metas = res.metadatas?.[0] || [];
    const dists = res.distances?.[0] || [];

    for (let i = 0; i < ids.length; i++) {
      const distance = dists[i] ?? 1;
      const confidence = Math.max(0, 1 - distance); // cosine: 0=identical, 2=opposite
      results.push({
        id: ids[i],
        question: docs[i],
        answer: metas[i]?.answer,
        distance,
        confidence,
        metadata: metas[i]
      });
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Delete an entry by ID.
   */
  async delete(id) {
    if (!this.collectionId) await this.init();
    await this._request('POST', `/api/v1/collections/${this.collectionId}/delete`, { ids: [id] });
  }

  /**
   * Get all entries (for export).
   */
  async getAll(limit = 500) {
    if (!this.collectionId) await this.init();
    const res = await this._request('POST', `/api/v1/collections/${this.collectionId}/get`, {
      limit,
      include: ['documents', 'metadatas', 'embeddings']
    });
    return (res.ids || []).map((id, i) => ({
      id,
      question: res.documents?.[i],
      metadata: res.metadatas?.[i]
    }));
  }

  /**
   * Count entries in collection.
   */
  async count() {
    if (!this.collectionId) await this.init();
    const res = await this._request('GET', `/api/v1/collections/${this.collectionId}/count`);
    return res;
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────────

  async _request(method, path, body) {
    const res = await fetch(`${CHROMA_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ChromaDB ${method} ${path} → ${res.status}: ${errText}`);
    }
    return res.status === 204 ? null : res.json();
  }
}
