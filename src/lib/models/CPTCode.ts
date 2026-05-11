import mongoose, { Schema } from 'mongoose';

const CPTCodeSchema = new Schema({
  code: { type: String, required: true, unique: true },
  description: String,
  shortName: String,
  keywords: [String],
});

export default mongoose.models.CPTCode || mongoose.model('CPTCode', CPTCodeSchema);