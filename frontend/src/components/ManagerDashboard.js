import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const formatCurrency = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 'N/A';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Navbar = () => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      navigate('/auth?section=login&role=admin');
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/auth?section=login&role=admin');
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Event Management</Link>
      <div className="navbar-links">
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="footer">
    <p>© {new Date().getFullYear()} Event Management. All rights reserved.</p>
  </footer>
);

const ManagerDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [features, setFeatures] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [featureForm, setFeatureForm] = useState({
    company_name: '',
    package_amount: '',
    contact_details: { email: '', phone: '', address: '' },
    features: [{ name: '', description: '' }],
  });
  const [featureImages, setFeatureImages] = useState([]);
  const [formError, setFormError] = useState({});
  const [formSuccess, setFormSuccess] = useState('');
  const [replyForm, setReplyForm] = useState({ compose: '', targetMessage: '' });
  const [statusForms, setStatusForms] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isMessengerCollapsed, setMessengerCollapsed] = useState(false);
  const messageListRef = useRef(null);

  const getInitials = (name = '') => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getId = (entity) => {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    if (typeof entity === 'object' && entity._id) return entity._id.toString();
    return entity.toString?.() || '';
  };

  const adminId = admin?._id?.toString();
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  const replyingTo = sortedMessages.find((message) => message._id === replyForm.targetMessage);

  useEffect(() => {
    if (!adminId || replyForm.targetMessage) return;
    const latestIncoming = [...messages]
      .filter((message) => message.sender_id?._id?.toString() !== adminId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .pop();
    if (latestIncoming) {
      setReplyForm((prev) => ({ ...prev, targetMessage: latestIncoming._id }));
    }
  }, [messages, adminId, replyForm.targetMessage]);

  const pendingBookings = bookings.filter((booking) => booking.status === 'Pending').length;
  const confirmedBookings = bookings.filter((booking) => booking.status === 'Confirmed').length;

  const clientContacts = useMemo(() => {
    const seen = new Set();
    const contacts = [];

    bookings.forEach((booking) => {
      const user = booking.user_id;
      if (!user) return;
      const userId = getId(user);
      const featureName = booking.feature_id?.company_name || 'Wedding Package';
      const uniqueKey = `${userId}-${featureName}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      contacts.push({
        contactKey: booking._id,
        bookingId: booking._id,
        featureId: getId(booking.feature_id),
        userId,
        userName: user.name || 'Client',
        userEmail: user.email || '',
        featureName,
      });
    });

    return contacts;
  }, [bookings]);

  useEffect(() => {
    if (clientContacts.length === 0) {
      if (selectedContactId) setSelectedContactId('');
      return;
    }
    if (!clientContacts.some((contact) => contact.contactKey === selectedContactId)) {
      setSelectedContactId(clientContacts[0].contactKey);
    }
  }, [clientContacts, selectedContactId]);

  const selectedContact = clientContacts.find((contact) => contact.contactKey === selectedContactId);

  const filteredMessages = useMemo(() => {
    if (!selectedContact) return sortedMessages;
    const { bookingId, userId } = selectedContact;
    return sortedMessages.filter((message) => {
      const messageBookingId = getId(message.booking_id);
      const senderId = getId(message.sender_id);
      const recipientId = getId(message.recipient_id);
      return (
        (bookingId && messageBookingId === bookingId) ||
        (userId && (senderId === userId || recipientId === userId))
      );
    });
  }, [selectedContact, sortedMessages]);

  useEffect(() => {
    if (!selectedContact) {
      setReplyForm((prev) => ({ ...prev, targetMessage: '' }));
      return;
    }
    const latest = [...filteredMessages].filter((message) => getId(message.sender_id) !== adminId).pop();
    if (latest) {
      setReplyForm((prev) => ({ ...prev, targetMessage: latest._id }));
    } else if (filteredMessages.length > 0) {
      setReplyForm((prev) => ({ ...prev, targetMessage: filteredMessages[filteredMessages.length - 1]._id }));
    } else {
      setReplyForm((prev) => ({ ...prev, targetMessage: '' }));
    }
  }, [filteredMessages, selectedContact, adminId]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [filteredMessages.length, selectedContactId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching manager dashboard data...');
        const response = await axios.get('/api/manager-dashboard', { withCredentials: true });
        const { admin, features, bookings, messages } = response.data;
        console.log('Manager dashboard data:', {
          admin: admin ? { id: admin._id, name: admin.name, email: admin.email } : null,
          featureCount: features?.length || 0,
          bookingCount: bookings?.length || 0,
          messageCount: messages?.length || 0,
        });
        setAdmin(admin);
        setFeatures(features || []);
        setBookings(bookings || []);
        setMessages(messages || []);
        setLoading(false);
      } catch (err) {
        console.error('Manager dashboard fetch error:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        if (err.response?.status === 401) {
          navigate('/auth?section=login&role=admin');
        } else {
          setError('Failed to load dashboard data. Please try again.');
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const validateForm = () => {
    const errors = {};
    if (!featureForm.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }
    if (!featureForm.package_amount || featureForm.package_amount <= 0) {
      errors.package_amount = 'Valid package amount is required';
    }
    if (!featureForm.contact_details.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(featureForm.contact_details.email)) {
      errors.email = 'Valid email is required';
    }
    featureForm.features.forEach((f, index) => {
      if (!f.name.trim()) {
        errors[`feature_${index}_name`] = `Feature ${index + 1}: Name is required`;
      }
      if (!f.description.trim()) {
        errors[`feature_${index}_description`] = `Feature ${index + 1}: Description is required`;
      }
    });
    const imageCount = featureImages.filter((img) => img).length;
    if (imageCount > 0 && imageCount > featureForm.features.length) {
      errors.images = 'Number of images cannot exceed number of features';
    }
    return errors;
  };

  const handleFeatureInputChange = (e, index) => {
    const { name, value } = e.target;
    console.log('Input change:', { name, value, index });
    
    if (name.startsWith('contact_details.')) {
      const field = name.split('.')[1];
      setFeatureForm({
        ...featureForm,
        contact_details: { ...featureForm.contact_details, [field]: value },
      });
      setFormError((prev) => ({ ...prev, [name]: '', email: '' }));
    } else if (name.startsWith('features.')) {
      const field = name.split('.')[2];
      const updatedFeatures = [...featureForm.features];
      updatedFeatures[index] = { ...updatedFeatures[index], [field]: value };
      setFeatureForm({ ...featureForm, features: updatedFeatures });
      setFormError((prev) => ({ ...prev, [name]: '', [`feature_${index}_${field}`]: '' }));
    } else {
      setFeatureForm({ ...featureForm, [name]: value });
      setFormError((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const addFeatureField = () => {
    setFeatureForm({
      ...featureForm,
      features: [...featureForm.features, { name: '', description: '' }],
    });
    setFeatureImages([...featureImages, null]);
  };

  const removeFeatureField = (index) => {
    if (featureForm.features.length === 1) {
      setFormError((prev) => ({ ...prev, features: 'At least one feature is required' }));
      return;
    }
    setFeatureForm({
      ...featureForm,
      features: featureForm.features.filter((_, i) => i !== index),
    });
    setFeatureImages(featureImages.filter((_, i) => i !== index));
    setFormError((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`feature_${index}_`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        setFormError((prev) => ({ ...prev, [`image_${index}`]: 'Only JPEG, JPG, or PNG images are allowed' }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError((prev) => ({ ...prev, [`image_${index}`]: 'Image size must be less than 5MB' }));
        return;
      }
      const updatedImages = [...featureImages];
      updatedImages[index] = file;
      setFeatureImages(updatedImages);
      setFormError((prev) => ({ ...prev, [`image_${index}`]: '' }));
    }
  };

  const handleFeatureSubmit = async (e) => {
    e.preventDefault();
    setFormError({});
    setFormSuccess('');

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormError(errors);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('company_name', featureForm.company_name);
    formData.append('package_amount', featureForm.package_amount);
    formData.append('contact_details', JSON.stringify(featureForm.contact_details));
    formData.append('features', JSON.stringify(featureForm.features));
    featureImages.forEach((image, index) => {
      if (image) {
        formData.append('images', image);
      }
    });

    // Log FormData contents
    const formDataEntries = {};
    for (let [key, value] of formData.entries()) {
      formDataEntries[key] = value instanceof File ? value.name : value;
    }
    console.log('Submitting add-wedding-package:', formDataEntries);

    try {
      const response = await axios.post('/api/add-wedding-package', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Add package response:', response.data);
      setFormSuccess(response.data.message);
      setFeatureForm({
        company_name: '',
        package_amount: '',
        contact_details: { email: '', phone: '', address: '' },
        features: [{ name: '', description: '' }],
      });
      setFeatureImages([]);
      const updatedData = await axios.get('/api/manager-dashboard', { withCredentials: true });
      setFeatures(updatedData.data.features || []);
    } catch (err) {
      let errorMessage = 'Failed to add package. Please try again.';
      if (err.response?.status === 400 && err.response.data.errors) {
        const backendErrors = {};
        err.response.data.errors.forEach((e) => {
          if (e.param === 'contact_details') {
            backendErrors.email = e.msg;
          } else if (e.param === 'features') {
            backendErrors.features = e.msg;
          } else {
            backendErrors[e.param] = e.msg;
          }
        });
        setFormError(backendErrors);
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
        setFormError({ general: errorMessage });
      } else {
        setFormError({ general: errorMessage });
      }
      console.error('Add package error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (bookingId) => {
    const { status, message } = statusForms[bookingId] || {};
    if (!status) {
      setFormError((prev) => ({ ...prev, general: 'Status is required' }));
      return;
    }
    setFormError({});
    setFormSuccess('');

    try {
      const response = await axios.post(
        '/api/update-booking-status',
        { booking_id: bookingId, status, message: message?.trim() || undefined },
        { withCredentials: true }
      );
      setFormSuccess(response.data.message);
      const updatedData = await axios.get('/api/manager-dashboard', { withCredentials: true });
      setBookings(updatedData.data.bookings || []);
      setMessages(updatedData.data.messages || []);
      setStatusForms((prev) => ({ ...prev, [bookingId]: { status: '', message: '' } }));
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        general: err.response?.data?.errors?.[0]?.msg || 'Failed to update status. Please try again',
      }));
      console.error('Status update error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }
  };

  const handleStatusChange = (bookingId, field, value) => {
    setStatusForms((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || { status: '', message: '' }),
        [field]: value,
      },
    }));
    setFormError((prev) => ({ ...prev, general: '' }));
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    setFormError((prev) => ({ ...prev, general: '' }));
    setFormSuccess('');
    const messageId = replyForm.targetMessage;
    const content = replyForm.compose?.trim();
    if (!messageId) {
      setFormError((prev) => ({ ...prev, general: 'Please choose a conversation to reply to.' }));
      return;
    }
    if (!content) {
      setFormError((prev) => ({ ...prev, general: 'Reply content is required' }));
      return;
    }

    try {
      const response = await axios.post(
        '/api/reply-message',
        { message_id: messageId, content },
        { withCredentials: true }
      );
      setFormSuccess(response.data.message);
      const updatedData = await axios.get('/api/manager-dashboard', { withCredentials: true });
      setMessages(updatedData.data.messages || []);
      setReplyForm({ compose: '', targetMessage: '' });
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        general: err.response?.data?.errors?.[0]?.msg || 'Failed to send reply. Please try again',
      }));
      console.error('Reply error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    setFormError((prev) => ({ ...prev, general: '' }));
    setFormSuccess('');

    try {
      const response = await axios.post(
        '/api/delete-message',
        { message_id: messageId },
        { withCredentials: true }
      );
      setFormSuccess(response.data.message);
      const updatedData = await axios.get('/api/manager-dashboard', { withCredentials: true });
      setMessages(updatedData.data.messages || []);
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        general: err.response?.data?.errors?.[0]?.msg || 'Failed to delete message. Please try again',
      }));
      console.error('Delete message error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="flex-grow-1">
        <div className="dashboard-container fade-in">
          <h1 className="dashboard-title">Manager Dashboard</h1>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Packages live</span>
              <strong>{features.length}</strong>
              <p className="section-subtext">Curated collections available to users</p>
            </div>
            <div className="summary-card">
              <span>Total bookings</span>
              <strong>{bookings.length}</strong>
              <p className="section-subtext">{pendingBookings} awaiting review</p>
            </div>
            <div className="summary-card">
              <span>Confirmed events</span>
              <strong>{confirmedBookings}</strong>
              <p className="section-subtext">Ready for execution</p>
            </div>
            <div className="summary-card">
              <span>Messages</span>
              <strong>{messages.length}</strong>
              <p className="section-subtext">Stay responsive to enquiries</p>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Add Wedding Package</h2>
            </div>
            <form onSubmit={handleFeatureSubmit} className="feature-form">
              {formError.general && <div className="error">{formError.general}</div>}
              {formSuccess && <div className="success">{formSuccess}</div>}
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={featureForm.company_name}
                  onChange={handleFeatureInputChange}
                  className="form-control"
                  required
                />
                {formError.company_name && <div className="error">{formError.company_name}</div>}
              </div>
              <div className="form-group">
                <label>Package Amount ($)</label>
                <input
                  type="number"
                  name="package_amount"
                  value={featureForm.package_amount}
                  onChange={handleFeatureInputChange}
                  className="form-control"
                  required
                  min="0"
                  step="0.01"
                />
                {formError.package_amount && <div className="error">{formError.package_amount}</div>}
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  name="contact_details.email"
                  value={featureForm.contact_details.email}
                  onChange={handleFeatureInputChange}
                  className="form-control"
                  required
                />
                {formError.email && <div className="error">{formError.email}</div>}
              </div>
              <div className="form-group">
                <label>Contact Phone</label>
                <input
                  type="text"
                  name="contact_details.phone"
                  value={featureForm.contact_details.phone}
                  onChange={handleFeatureInputChange}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Contact Address</label>
                <input
                  type="text"
                  name="contact_details.address"
                  value={featureForm.contact_details.address}
                  onChange={handleFeatureInputChange}
                  className="form-control"
                />
              </div>
              <h3>Features</h3>
              {formError.features && <div className="error">{formError.features}</div>}
              {featureForm.features.map((feature, index) => (
                <div key={index} className="feature-group">
                  <div className="form-group">
                    <label>Feature Name</label>
                    <input
                      type="text"
                      name={`features.${index}.name`}
                      value={feature.name}
                      onChange={(e) => handleFeatureInputChange(e, index)}
                      className="form-control"
                      required
                    />
                    {formError[`feature_${index}_name`] && (
                      <div className="error">{formError[`feature_${index}_name`]}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name={`features.${index}.description`}
                      value={feature.description}
                      onChange={(e) => handleFeatureInputChange(e, index)}
                      className="form-control"
                      required
                    />
                    {formError[`feature_${index}_description`] && (
                      <div className="error">{formError[`feature_${index}_description`]}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Image (JPEG/JPG/PNG, max 5MB)</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => handleImageChange(e, index)}
                      className="form-control"
                    />
                    {featureImages[index] && <p>Selected: {featureImages[index].name}</p>}
                    {formError[`image_${index}`] && <div className="error">{formError[`image_${index}`]}</div>}
                  </div>
                  {featureForm.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeatureField(index)}
                      className="btn-cancel"
                    >
                      Remove Feature
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addFeatureField} className="btn-secondary">
                Add Another Feature
              </button>
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Package'}
              </button>
            </form>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>My Packages</h2>
            </div>
            <div className="packages-grid grid grid-2">
              {features.length > 0 ? (
                features.map((feature) => (
                  <div key={feature._id} className="package-card">
                    <h3 className="package-title">{feature.company_name || 'Unnamed Package'}</h3>
                    <p className="package-price">Price: {formatCurrency(feature.package_amount)}</p>
                    <div className="package-contact">
                      <p><strong>Contact Details:</strong></p>
                      <p>Email: {feature.contact_details?.email || 'Not provided'}</p>
                      {feature.contact_details?.phone && <p>Phone: {feature.contact_details.phone}</p>}
                      {feature.contact_details?.address && <p>Address: {feature.contact_details.address}</p>}
                    </div>
                    {feature.features?.length > 0 ? (
                      <div className="feature-details">
                        <h4>Features:</h4>
                        {feature.features.map((f, idx) => (
                          <div key={idx} className="feature-subitem">
                            <p><strong>{f.name || 'Unnamed'}</strong>: {f.description || 'No description'}</p>
                            {f.image && (
                              <div className="feature-image-wrapper">
                                <img
                                  src={`http://localhost:5000${f.image}`}
                                  alt={f.name || 'Feature image'}
                                  className="feature-image"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                  loading="lazy"
                                />
                                <span className="image-fallback" style={{ display: 'none' }}>
                                  Image not available
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No features available.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="no-data">No packages available.</p>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Bookings</h2>
            </div>
            <div className="bookings-grid grid grid-2">
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <div key={booking._id} className="booking-item">
                    <p>Package: {booking.feature_id?.company_name || 'N/A'}</p>
                    <p>User: {booking.user_id?.name || 'N/A'}</p>
                    <p>Date: {new Date(booking.weddingDate).toLocaleDateString()}</p>
                    <p>Venue: {booking.venue || 'N/A'}</p>
                    <p>Guests: {booking.guestCount || 'N/A'}</p>
                    <div className="booking-meta">
                      <span
                        className={`status-pill ${(booking.status || 'Pending').toLowerCase()}`}
                        aria-label={`Status ${booking.status || 'Pending'}`}
                      >
                        {booking.status || 'Pending'}
                      </span>
                    </div>
                    <div className="booking-actions">
                      <div className="form-group">
                        <label>Update Status</label>
                        <select
                          value={statusForms[booking._id]?.status || booking.status}
                          onChange={(e) => handleStatusChange(booking._id, 'status', e.target.value)}
                          className="form-control"
                          aria-label={`Update status for booking ${booking._id}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Message to User (Optional)</label>
                        <textarea
                          value={statusForms[booking._id]?.message || ''}
                          onChange={(e) => handleStatusChange(booking._id, 'message', e.target.value)}
                          className="form-control"
                          rows="3"
                          placeholder="Explain the status change (e.g., 'Booking confirmed for Grand Hall')"
                        />
                      </div>
                      <button
                        onClick={() => handleStatusUpdate(booking._id)}
                        className="btn-submit"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No bookings available.</p>
              )}
              {formError.general && <div className="error">{formError.general}</div>}
              {formSuccess && <div className="success">{formSuccess}</div>}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <div>
                <h2>Messages</h2>
              </div>
              <button
                type="button"
                className="collapse-toggle"
                onClick={() => setMessengerCollapsed((prev) => !prev)}
                aria-expanded={!isMessengerCollapsed}
                aria-label={isMessengerCollapsed ? 'Expand messages' : 'Minimize messages'}
              >
                {isMessengerCollapsed ? '＋' : '−'}
              </button>
            </div>
            {!isMessengerCollapsed && (
              <div className="messenger-wrapper">
                <div className="messenger-thread card">
                <div className="messenger-header">
                  <div className="composer-heading">
                    <h3>Chat with your clients</h3>
                    <p>Select a booking to focus the conversation.</p>
                  </div>
                  {clientContacts.length > 0 ? (
                    <div className="contact-pills" role="list">
                      {clientContacts.map((contact) => (
                        <button
                          type="button"
                          key={contact.contactKey}
                          className={`contact-pill ${selectedContactId === contact.contactKey ? 'active' : ''}`}
                          onClick={() => setSelectedContactId(contact.contactKey)}
                          role="listitem"
                        >
                          <div className="contact-pill-avatar" aria-hidden="true">
                            {getInitials(contact.userName)}
                          </div>
                          <div className="contact-pill-details">
                            <strong>{contact.userName}</strong>
                            <span>{contact.featureName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="message-hint">No bookings yet. Messages will appear once clients reach out.</p>
                  )}
                </div>
                <div className="message-list" ref={messageListRef}>
                  {filteredMessages.length > 0 ? (
                    filteredMessages.map((message) => {
                      const isSender = message.sender_id?._id.toString() === admin?._id.toString();
                      const contextParts = [];
                      if (message.feature_id?.company_name) {
                        contextParts.push(message.feature_id.company_name);
                      }
                      if (message.booking_id?.weddingDate) {
                        contextParts.push(new Date(message.booking_id.weddingDate).toLocaleDateString());
                      }
                      const contextLabel = contextParts.length ? contextParts.join(' • ') : null;
                      const isSelectable = !isSender;
                      const isSelected = replyForm.targetMessage === message._id;

                      return (
                        <div
                          key={message._id}
                          className={`message-row ${isSender ? 'sent' : 'received'} ${isSelectable ? 'selectable' : ''} ${
                            isSelected ? 'selected' : ''
                          }`}
                          role={isSelectable ? 'button' : undefined}
                          onClick={() => {
                            if (!isSelectable) return;
                            setReplyForm((prev) => ({ ...prev, targetMessage: message._id }));
                          }}
                          aria-pressed={isSelectable ? isSelected : undefined}
                        >
                          <div className="message-avatar" aria-hidden="true">
                            <span>{getInitials(isSender ? admin?.name : message.sender_id?.name)}</span>
                          </div>
                          <div className="message-body">
                            <div className="message-meta">
                              <div>
                                <strong>{isSender ? 'You' : message.sender_id?.name || 'Unknown user'}</strong>
                                {contextLabel && <span className="message-context">{contextLabel}</span>}
                              </div>
                              <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
                            </div>
                            <p className="message-text">{message.content || 'N/A'}</p>
                            <div className="message-actions compact">
                              {isSender && (
                                <button
                                  className="btn-icon danger"
                                  onClick={() => handleDeleteMessage(message._id)}
                                  aria-label="Delete this message"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                            {isSelectable && null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="no-data messenger-empty">No messages available. Stay tuned for client enquiries.</p>
                  )}
                </div>
                <div className="message-composer embedded compact">
                  {formError.general && <div className="error">{formError.general}</div>}
                  <form onSubmit={handleReplySubmit} className="message-form inline">
                    <div className="composer-input-row tight">
                      <textarea
                        className="composer-textarea"
                        rows="1"
                        value={replyForm.compose}
                        onChange={(e) => setReplyForm((prev) => ({ ...prev, compose: e.target.value }))}
                        placeholder="Type your reply..."
                        required
                      />
                      <button
                        type="submit"
                        className="btn-icon"
                        aria-label="Send reply"
                        disabled={!replyForm.targetMessage || !replyForm.compose.trim()}
                      >
                        ➤
                      </button>
                    </div>
                  </form>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ManagerDashboard;