import mongoose, { Schema } from 'mongoose';

const FacilitySchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  companyId: String,
  address: String,
  city: String,
  state: String,
  zip: String,
  emrClientId: String,
});

export default mongoose.models.Facility || mongoose.model('Facility', FacilitySchema);