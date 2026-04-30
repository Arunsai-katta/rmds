import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rmds';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseGlobal | undefined;
}


let cached = global.mongoose;
if (!cached) {
  cached = { conn: null, promise: null };
  global.mongoose = cached;
}
cached = global.mongoose as MongooseGlobal;

async function dbConnect() {
  if (cached!.conn) return cached!.conn;
  if (!cached!.promise) {
    cached!.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then((mongoose) => {
      return mongoose;
    });
  }
  cached!.conn = await cached!.promise;
  return cached!.conn;
}

export default dbConnect;
