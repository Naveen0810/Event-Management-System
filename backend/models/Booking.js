const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  feature_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feature',
    required: true,
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  weddingDate: {
    type: Date,
    required: true,
  },
  venue: {
    type: String,
    required: true,
  },
  guestCount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Rejected'], 
    default: 'Pending',
  },
  message: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Booking', BookingSchema);