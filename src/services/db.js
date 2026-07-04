const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables.');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    // modern mongoose (6+) doesn't need useNewUrlParser/useUnifiedTopology, kept minimal
  });

  console.log('[db] Connected to MongoDB');

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  return mongoose.connection;
}

module.exports = { connectDB };
