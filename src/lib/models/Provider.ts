import mongoose, { Schema } from 'mongoose';

const ProviderSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  npi: String,
  credential: String,
  firstName: String,
  lastName: String,
  practiceGroup: String,
});

export default mongoose.models.Provider || mongoose.model('Provider', ProviderSchema);