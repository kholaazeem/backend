import mongoose from 'mongoose'; 

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    console.log('📌 Running in mock mode on production / Vercel (No MONGO_URI provided).');
    mongoose.set('bufferCommands', false);
    return;
  }

  try {
    mongoose.set('bufferCommands', false);
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/supportflow', {
      serverSelectionTimeoutMS: 2500,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Warning: ${error.message}`);
    console.log('📌 Running with in-memory / fallback data mode if MongoDB is offline.');
  }
};

