import mongoose from 'mongoose'; 

const DEFAULT_ATLAS_URI = 'mongodb+srv://kholaazeem104_db_user:XV5TV2QE2XVX3y6z@cluster0.ajlcels.mongodb.net/test?retryWrites=true&w=majority';

let cachedPromise = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const rawUri = process.env.MONGO_URI || DEFAULT_ATLAS_URI;
  // Ensure database name is explicitly specified so queries go to 'test' where users are stored
  let uri = rawUri.trim();
  if (uri.includes('mongodb.net/') && !uri.includes('mongodb.net/test') && !uri.includes('mongodb.net/supportflow')) {
    uri = uri.replace('mongodb.net/', 'mongodb.net/test');
  }

  if (!cachedPromise) {
    mongoose.set('bufferCommands', true);
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    }).then(conn => {
      console.log(`✅ MongoDB Connected to DB: ${conn.connection.name}`);
      return conn;
    }).catch(err => {
      cachedPromise = null;
      console.error(`⚠️ MongoDB Connection Warning: ${err.message}`);
      throw err;
    });
  }

  try {
    return await cachedPromise;
  } catch (error) {
    console.log('📌 Running with in-memory / fallback data mode if MongoDB is offline.');
  }
};


