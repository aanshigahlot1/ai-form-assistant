// backend/src/models/MemoryEntry.model.js
import mongoose from 'mongoose';

const memoryEntrySchema = new mongoose.Schema({
  extensionId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  fieldContext: {
    id: String, name: String, placeholder: String,
    fieldType: String, url: String, platform: String
  },
  source: { 
    type: String, 
    enum: ['user_correction', 'claude_semantic', 'pattern', 'memory', 'manual'],
    default: 'manual'
  },
  confidence: { type: Number, default: 1.0 },
  usageCount: { type: Number, default: 1 },
  embedding: [Number], // Vector embedding for semantic search
  lastUsed: Date
}, { timestamps: true });

memoryEntrySchema.index({ extensionId: 1, usageCount: -1 });
memoryEntrySchema.index({ extensionId: 1, question: 'text' });

export const MemoryEntry = mongoose.model('MemoryEntry', memoryEntrySchema);
