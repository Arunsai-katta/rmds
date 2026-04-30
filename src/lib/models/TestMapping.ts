import mongoose, { Schema } from 'mongoose';

const TestMappingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  // Add other fields as needed based on your test mapping structure
  // Example:
  testName: String,
  cptCode: String,
  description: String,
});

export default mongoose.models.TestMapping || mongoose.model('TestMapping', TestMappingSchema);