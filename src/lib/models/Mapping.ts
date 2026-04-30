import mongoose, { Schema } from 'mongoose';

const MappingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  providerId: String,
  facilityId: String,
});

export default mongoose.models.Mapping || mongoose.model('Mapping', MappingSchema);