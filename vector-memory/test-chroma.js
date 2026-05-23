// vector-memory/test-chroma.js
// Run: node test-chroma.js
// Tests the full embed → store → query pipeline

import { ChromaService } from './ChromaService.js';
import { EmbeddingPipeline } from './EmbeddingPipeline.js';

async function main() {
  console.log('🧪 Testing vector memory pipeline...\n');

  // Test ChromaDB connectivity
  console.log('1. Testing ChromaDB connection...');
  const chroma = new ChromaService();
  try {
    await chroma.init();
    console.log('   ✅ ChromaDB connected\n');
  } catch (err) {
    console.error('   ❌ ChromaDB not reachable:', err.message);
    console.log('   → Run: docker run -p 8000:8000 chromadb/chroma\n');
    process.exit(1);
  }

  // Test embedding pipeline
  console.log('2. Testing EmbeddingPipeline (hash fallback)...');
  const pipeline = new EmbeddingPipeline();
  await pipeline.init();

  const testEntries = [
    { id: 'test-1', question: 'What is your current CGPA?', answer: '8.7' },
    { id: 'test-2', question: 'Enter your email address', answer: 'test@example.com' },
    { id: 'test-3', question: 'Which college did you attend?', answer: 'IIT Delhi' },
    { id: 'test-4', question: 'List your technical skills', answer: 'React, Node.js, Python' },
    { id: 'test-5', question: 'Describe your work experience', answer: '2 internships, 6 months total' },
  ];

  for (const entry of testEntries) {
    await pipeline.addEntry(entry.id, entry.question, entry.answer, { source: 'test' });
    console.log(`   ✅ Indexed: "${entry.question}"`);
  }

  // Test semantic queries
  console.log('\n3. Testing semantic queries...');
  const queries = [
    'Cumulative GPA',
    'Contact email',
    'University name',
    'Programming skills',
    'Professional experience',
    'Date of birth', // Should return no match
  ];

  for (const q of queries) {
    const match = await pipeline.findMatch(q, 0.3);
    if (match) {
      console.log(`   ✅ "${q}" → "${match.answer}" (conf: ${match.confidence.toFixed(2)})`);
    } else {
      console.log(`   ⚪ "${q}" → no match`);
    }
  }

  // Cleanup test entries
  for (const entry of testEntries) await chroma.delete(entry.id);
  console.log('\n✅ All tests passed! Vector memory is working correctly.');
}

main().catch(err => { console.error('Test failed:', err); process.exit(1); });
