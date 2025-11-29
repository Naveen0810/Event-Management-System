const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const User = require('./models/User');
const Feature = require('./models/Feature');
const Booking = require('./models/Booking');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_please_change_me';

// Ensure Uploads folder exists
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/Uploads', express.static(uploadsDir));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/event-management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, or PNG images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).array('images', 10);

// Middleware to Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ errors: [{ msg: 'No token provided' }] });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ errors: [{ msg: 'Invalid token' }] });
  }
};

// Middleware to Check Role
const checkRole = (role) => (req, res, next) => {
  if (req.user.role !== role) {
    console.log(`Access denied. ${role} role required for user:`, req.user.id);
    return res.status(403).json({ errors: [{ msg: `Access denied. ${role} role required` }] });
  }
  next();
};

// Authentication Routes
app.post('/api/register', [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['user', 'admin']).withMessage('Role must be user or admin'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Register validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ errors: [{ msg: 'User already exists', param: 'email' }] });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: false }); // secure: true in production
    const redirect = '/auth?section=login&role=' + role;
    res.json({ message: 'Registration successful', redirect, user: { id: user._id, name, email, role } });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/send-message', verifyToken, checkRole('user'), [
  body('feature_id').optional().isMongoId().withMessage('Valid Feature ID is required when provided'),
  body('booking_id').optional().isMongoId().withMessage('Valid Booking ID is required when provided'),
  body('content').notEmpty().trim().withMessage('Message content is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { feature_id, booking_id, content } = req.body;

  if (!feature_id && !booking_id) {
    return res.status(400).json({ errors: [{ msg: 'Please select a package or booking to message about' }] });
  }

  try {
    let recipientId = null;
    let resolvedFeatureId = null;
    let resolvedBookingId = null;

    if (feature_id) {
      const feature = await Feature.findById(feature_id);
      if (!feature) {
        return res.status(404).json({ errors: [{ msg: 'Feature not found', param: 'feature_id' }] });
      }
      resolvedFeatureId = feature._id;
      recipientId = feature.admin_id;
    }

    if (booking_id) {
      const booking = await Booking.findOne({ _id: booking_id, user_id: req.user.id }).populate('feature_id');
      if (!booking) {
        return res.status(404).json({ errors: [{ msg: 'Booking not found or unauthorized', param: 'booking_id' }] });
      }

      if (feature_id && booking.feature_id?._id.toString() !== feature_id) {
        return res.status(400).json({ errors: [{ msg: 'Booking does not belong to the selected package', param: 'booking_id' }] });
      }

      resolvedBookingId = booking._id;
      resolvedFeatureId = resolvedFeatureId || booking.feature_id?._id;
      recipientId = recipientId || booking.provider_id || booking.feature_id?.admin_id;
    }

    if (!recipientId) {
      return res.status(400).json({ errors: [{ msg: 'Could not resolve an event manager recipient' }] });
    }

    const newMessage = new Message({
      feature_id: resolvedFeatureId,
      booking_id: resolvedBookingId,
      sender_id: req.user.id,
      recipient_id: recipientId,
      content: content.trim(),
    });

    await newMessage.save();
    res.json({ message: 'Message sent successfully', newMessage });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Login validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ errors: [{ msg: 'Invalid credentials', param: 'email' }] });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ errors: [{ msg: 'Invalid credentials', param: 'password' }] });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: false });
    const redirect = user.role === 'admin' ? '/manager-dashboard' : '/user-dashboard';
    res.json({ message: 'Login successful', redirect, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// User Dashboard Routes
app.get('/api/user-dashboard', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const features = await Feature.find().populate('admin_id', 'name email');
    const bookings = await Booking.find({ user_id: req.user.id }).populate('feature_id user_id');
    const messages = await Message.find({
      $or: [{ sender_id: req.user.id }, { recipient_id: req.user.id }],
    })
      .populate('sender_id recipient_id')
      .populate('feature_id')
      .populate({ path: 'booking_id', populate: { path: 'feature_id' } });

    res.json({ user, features, bookings, messages });
  } catch (err) {
    console.error('User dashboard error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/update-profile', verifyToken, checkRole('user'), [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Profile update validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ errors: [{ msg: 'User not found' }] });
    }

    const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existingUser) {
      return res.status(400).json({ errors: [{ msg: 'Email already in use', param: 'email' }] });
    }

    user.name = name;
    user.email = email;
    await user.save();

    res.json({ message: 'Profile updated successfully', user: { id: user._id, name, email, role: user.role } });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/book-package', verifyToken, checkRole('user'), [
  body('feature_id').isMongoId().withMessage('Valid Feature ID is required'),
  body('weddingDate').isISO8601().toDate().withMessage('Valid wedding date is required'),
  body('venue').notEmpty().trim().withMessage('Venue is required'),
  body('guestCount').isInt({ min: 1 }).withMessage('Guest count must be a positive integer'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Book package validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { feature_id, weddingDate, venue, guestCount } = req.body;
  console.log('Received book-package request:', { feature_id, weddingDate, venue, guestCount });

  try {
    const feature = await Feature.findById(feature_id);
    if (!feature) {
      return res.status(404).json({ errors: [{ msg: 'Feature not found', param: 'feature_id' }] });
    }

    const booking = new Booking({
      user_id: req.user.id,
      feature_id,
      provider_id: feature.admin_id,
      weddingDate,
      venue,
      guestCount,
      status: 'Pending',
    });

    await booking.save();
    res.json({ message: 'Package booked successfully', booking });
  } catch (err) {
    console.error('Book package error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/cancel-booking', verifyToken, checkRole('user'), [
  body('booking_id').isMongoId().withMessage('Valid Booking ID is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Cancel booking validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { booking_id } = req.body;

  try {
    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ errors: [{ msg: 'Booking not found', param: 'booking_id' }] });
    }

    if (booking.user_id.toString() !== req.user.id) {
      return res.status(403).json({ errors: [{ msg: 'Unauthorized to cancel this booking' }] });
    }

    if (booking.status !== 'Pending') {
      return res.status(400).json({ errors: [{ msg: 'Only pending bookings can be cancelled' }] });
    }

    booking.status = 'Cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// Manager Dashboard Routes
app.get('/api/manager-dashboard', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('-password');
    const features = await Feature.find({ admin_id: req.user.id });
    const featureIds = features.map((feature) => feature._id);
    const bookings = await Booking.find({
      $or: [
        { provider_id: req.user.id },
        { feature_id: { $in: featureIds } },
      ],
    }).populate('feature_id user_id');
    const messages = await Message.find({
      $or: [{ sender_id: req.user.id }, { recipient_id: req.user.id }],
    })
      .populate('sender_id recipient_id')
      .populate('feature_id')
      .populate({ path: 'booking_id', populate: { path: 'feature_id user_id' } });

    res.json({ admin, features, bookings, messages });
  } catch (err) {
    console.error('Manager dashboard error:', err);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/add-wedding-package', verifyToken, checkRole('admin'), (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      return res.status(400).json({ errors: [{ msg: err.message }] });
    }
    next();
  });
}, [
  body('company_name').notEmpty().trim().isLength({ min: 1 }).withMessage('Company name is required'),
  body('package_amount').isFloat({ min: 0 }).withMessage('Package amount must be a positive number'),
  body('contact_details').custom((value) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) {
        throw new Error('Valid email is required');
      }
      if (parsed.phone && !/^\+?[\d\s-]{7,15}$/.test(parsed.phone)) {
        throw new Error('Invalid phone number format');
      }
      if (parsed.address && parsed.address.length > 200) {
        throw new Error('Address must be 200 characters or less');
      }
      return true;
    } catch (err) {
      throw new Error(err.message || 'Invalid contact details format');
    }
  }),
  body('features').custom((value) => {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.length < 1) {
        throw new Error('At least one feature is required');
      }
      parsed.forEach((f, i) => {
        if (!f.name?.trim() || f.name.length < 1) {
          throw new Error(`Feature ${i + 1}: Name is required`);
        }
        if (!f.description?.trim() || f.description.length < 1) {
          throw new Error(`Feature ${i + 1}: Description is required`);
        }
        if (f.name.length > 100) {
          throw new Error(`Feature ${i + 1}: Name must be 100 characters or less`);
        }
        if (f.description.length > 500) {
          throw new Error(`Feature ${i + 1}: Description must be 500 characters or less`);
        }
      });
      return true;
    } catch (err) {
      throw new Error(err.message || 'Invalid features format');
    }
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Add-wedding-package validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { company_name, package_amount, contact_details, features } = req.body;
  const images = req.files;

  console.log('Received add-wedding-package request:', {
    company_name,
    package_amount: parseFloat(package_amount),
    contact_details,
    features,
    imageCount: images.length,
  });

  try {
    const parsedFeatures = JSON.parse(features);
    const parsedContactDetails = JSON.parse(contact_details);

    // Allow images to be optional for features
    if (images.length > parsedFeatures.length) {
      console.log('Too many images:', { features: parsedFeatures.length, images: images.length });
      return res.status(400).json({
        errors: [{ msg: 'Number of images cannot exceed number of features', param: 'images' }],
      });
    }

    const featureData = parsedFeatures.map((feature, index) => ({
      name: feature.name.trim(),
      description: feature.description.trim(),
      image: images[index] ? `/Uploads/${images[index].filename}` : '',
    }));

    const newFeature = new Feature({
      admin_id: req.user.id,
      company_name: company_name.trim(),
      package_amount: parseFloat(package_amount),
      contact_details: {
        email: parsedContactDetails.email,
        phone: parsedContactDetails.phone || '',
        address: parsedContactDetails.address || '',
      },
      features: featureData,
    });

    await newFeature.save();
    console.log('Wedding package added:', newFeature._id);
    res.json({ message: 'Wedding package added successfully', feature: newFeature });
  } catch (err) {
    console.error('Add wedding package error:', err.stack);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ errors: [{ msg: `Database validation error: ${err.message}` }] });
    }
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/update-booking-status', verifyToken, checkRole('admin'), [
  body('booking_id').isMongoId().withMessage('Valid Booking ID is required'),
  body('status').isIn(['Pending', 'Confirmed', 'Rejected']).withMessage('Invalid status'),
  body('message').optional().trim().notEmpty().withMessage('Message cannot be empty if provided'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Update-booking-status validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { booking_id, status, message } = req.body;
  console.log('Received update-booking-status request:', { booking_id, status, message });

  try {
    const booking = await Booking.findById(booking_id).populate('user_id');
    if (!booking) {
      return res.status(404).json({ errors: [{ msg: 'Booking not found', param: 'booking_id' }] });
    }

    booking.status = status;
    await booking.save();
    console.log('Booking status updated:', { booking_id, newStatus: booking.status });

    let newMessage = null;
    if (message) {
      newMessage = new Message({
        feature_id: booking.feature_id,
        booking_id: booking._id,
        sender_id: req.user.id,
        recipient_id: booking.user_id._id,
        content: message.trim(),
      });
      await newMessage.save();
      console.log('Status update message sent:', { message_id: newMessage._id, content: message });
    }

    res.json({
      message: 'Booking status updated successfully',
      booking,
      statusMessage: newMessage ? { id: newMessage._id, content: newMessage.content } : null,
    });
  } catch (err) {
    console.error('Update booking status error:', err.stack);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// Message Routes
app.post('/api/reply-message', verifyToken, [
  body('message_id').isMongoId().withMessage('Valid Message ID is required'),
  body('content').notEmpty().trim().withMessage('Message content is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Reply-message validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { message_id, content } = req.body;
  console.log('Received reply-message request:', { message_id, content, userId: req.user.id });

  try {
    const originalMessage = await Message.findById(message_id).populate('sender_id recipient_id');
    if (!originalMessage) {
      console.log('Message not found:', message_id);
      return res.status(404).json({ errors: [{ msg: 'Original message not found', param: 'message_id' }] });
    }

    if (
      !originalMessage.sender_id ||
      !originalMessage.recipient_id ||
      (originalMessage.sender_id._id.toString() !== req.user.id &&
       originalMessage.recipient_id._id.toString() !== req.user.id)
    ) {
      console.log('Unauthorized reply attempt:', { userId: req.user.id, messageId: message_id });
      return res.status(403).json({ errors: [{ msg: 'Unauthorized to reply to this message' }] });
    }

    const recipientId =
      originalMessage.sender_id._id.toString() === req.user.id
        ? originalMessage.recipient_id._id
        : originalMessage.sender_id._id;

    const newMessage = new Message({
      feature_id: originalMessage.feature_id,
      booking_id: originalMessage.booking_id,
      sender_id: req.user.id,
      recipient_id: recipientId,
      content: content.trim(),
    });

    await newMessage.save();
    console.log('Reply saved:', { message_id: newMessage._id, content });
    res.json({ message: 'Reply sent successfully', newMessage });
  } catch (err) {
    console.error('Reply message error:', err.stack);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

app.post('/api/delete-message', verifyToken, [
  body('message_id').isMongoId().withMessage('Valid Message ID is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Delete-message validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { message_id } = req.body;
  console.log('Received delete-message request:', { message_id, userId: req.user.id });

  try {
    const message = await Message.findById(message_id);
    if (!message) {
      console.log('Message not found:', message_id);
      return res.status(404).json({ errors: [{ msg: 'Message not found', param: 'message_id' }] });
    }

    if (message.sender_id.toString() !== req.user.id) {
      console.log('Unauthorized delete attempt:', { userId: req.user.id, messageId: message_id });
      return res.status(403).json({ errors: [{ msg: 'Unauthorized to delete this message' }] });
    }

    await Message.deleteOne({ _id: message_id });
    console.log('Message deleted:', message_id);
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err.stack);
    return res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});