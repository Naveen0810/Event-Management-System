const mongoose = require('mongoose');

const FeatureSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  package_amount: { type: Number, required: true },
  contact_details: {
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
  },
  features: [
    {
      name: { type: String, required: true },
      description: { type: String, required: true },
      image: { type: String },
    },
  ],
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Feature', FeatureSchema);