import mongoose, { Schema } from 'mongoose';

const EMRClientSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  connectionType: String,
  authToken: String,
  sftpHost: String,
  sftpPort: String,
  sftpUser: String,
  sftpPass: String,
});

export default mongoose.models.EMRClient || mongoose.model('EMRClient', EMRClientSchema);