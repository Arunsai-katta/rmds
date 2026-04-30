import mongoose, { Schema } from 'mongoose';

const ResultSchema = new Schema({
  id: { type: String, required: true, unique: true },
  parsedData: Schema.Types.Mixed, // Store ParsedPDFResult
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  sentAt: Date,
  error: String,
});

export default mongoose.models.Result || mongoose.model('Result', ResultSchema);