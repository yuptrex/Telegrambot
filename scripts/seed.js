/**
 * Seeds the database with base item templates so the shop isn't empty on first run.
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../src/models/Item');
const { BASE_ITEMS } = require('../src/config/items');

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  await mongoose.connect(uri);
  console.log('[seed] Connected to MongoDB');

  const existingCount = await Item.countDocuments({ isTemplate: true });
  if (existingCount > 0) {
    console.log(`[seed] Found ${existingCount} existing item templates. Skipping (delete them first to reseed).`);
    await mongoose.disconnect();
    return;
  }

  const docs = BASE_ITEMS.map((item) => ({ ...item, isTemplate: true, ownerId: null }));
  await Item.insertMany(docs);

  console.log(`[seed] Inserted ${docs.length} item templates.`);
  await mongoose.disconnect();
  console.log('[seed] Done.');
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
