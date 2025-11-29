const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    feature_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature' },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);