import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const Navbar = () => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      navigate('/auth?section=login&role=user');
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/auth?section=login&role=user');
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
    <p> {new Date().getFullYear()} Event Management. All rights reserved.</p>
  </footer>
);

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [features, setFeatures] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [expandedPackage, setExpandedPackage] = useState(null);
  const [bookingForms, setBookingForms] = useState({});
  const [formError, setFormError] = useState({});
  const [formSuccess, setFormSuccess] = useState({});
  const [carouselIndices, setCarouselIndices] = useState({});
  const [newMessageForm, setNewMessageForm] = useState({ featureId: '', bookingId: '', content: '' });
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

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

  const featureLookup = useMemo(() => {
    return features.reduce((acc, feature) => {
      if (feature?._id) {
        acc[feature._id.toString()] = feature;
      }
      return acc;
    }, {});
  }, [features]);

  const managerContacts = useMemo(() => {
    const seen = new Set();
    const contacts = [];

    bookings.forEach((booking) => {
      const rawFeatureId = booking.feature_id?._id || booking.feature_id;
      const featureId = rawFeatureId ? rawFeatureId.toString() : '';
      const featureData =
        (booking.feature_id && booking.feature_id.admin_id ? booking.feature_id : null) ||
        featureLookup[featureId];
      const manager = featureData?.admin_id;
      if (!manager) return;

      const managerId = getId(manager);
      const featureName = featureData?.company_name || 'Wedding Package';
      const uniqueKey = `${managerId}-${featureName}`;

      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      contacts.push({
        contactKey: booking._id,
        bookingId: booking._id,
        featureId,
        managerId,
        managerName: manager.name || 'Event Manager',
        managerEmail: manager.email || '',
        featureName,
        weddingDate: booking.weddingDate,
      });
    });

    return contacts;
  }, [bookings, featureLookup]);

  useEffect(() => {
    if (managerContacts.length === 0) {
      if (selectedContactId) {
        setSelectedContactId('');
      }
      setNewMessageForm((prev) => ({ ...prev, featureId: '', bookingId: '' }));
      return;
    }

    const matchesExisting = managerContacts.some((contact) => contact.contactKey === selectedContactId);
    if (!matchesExisting) {
      const fallback = managerContacts[0];
      setSelectedContactId(fallback.contactKey);
      setNewMessageForm((prev) => ({
        ...prev,
        featureId: fallback.featureId,
        bookingId: fallback.bookingId,
      }));
    }
  }, [managerContacts, selectedContactId]);

  const selectedContact = managerContacts.find((contact) => contact.contactKey === selectedContactId);

  const filteredMessages = useMemo(() => {
    if (!selectedContact) return sortedMessages;
    const { bookingId, featureId, managerId } = selectedContact;
    return sortedMessages.filter((message) => {
      const messageBookingId = getId(message.booking_id);
      const messageFeatureId = getId(message.feature_id);
      const senderId = getId(message.sender_id);
      const recipientId = getId(message.recipient_id);

      return (
        (bookingId && messageBookingId === bookingId) ||
        (featureId && messageFeatureId === featureId) ||
        (managerId && (senderId === managerId || recipientId === managerId))
      );
    });
  }, [selectedContact, sortedMessages]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [selectedContactId, filteredMessages.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/user-dashboard', { withCredentials: true });
        const { user, features, bookings, messages } = response.data;
        setUser(user);
        setFeatures(features || []);
        setBookings(bookings || []);
        setMessages(messages || []);
        setProfileForm({ name: user?.name || '', email: user?.email || '' });
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/auth?section=login&role=user');
        } else {
          setError('Failed to load dashboard data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setFormError((prev) => ({ ...prev, profile: '' }));
    setFormSuccess((prev) => ({ ...prev, profile: '' }));

    try {
      const response = await axios.post('/api/update-profile', profileForm, { withCredentials: true });
      setFormSuccess((prev) => ({ ...prev, profile: response.data.message }));
      setUser((prev) => ({ ...prev, ...profileForm }));
    } catch (err) {
      let errorMessage = 'Failed to update profile. Please try again.';
      if (err.response?.status === 400 && err.response.data.errors) {
        errorMessage = err.response.data.errors.map((e) => e.msg).join('; ');
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setFormError((prev) => ({ ...prev, profile: errorMessage }));
    }
  };

  const handleBookingSubmit = async (e, featureId) => {
    e.preventDefault();
    setFormError((prev) => ({ ...prev, [featureId]: '' }));
    setFormSuccess((prev) => ({ ...prev, [featureId]: '' }));

    const bookingForm = bookingForms[featureId] || { weddingDate: '', venue: '', guestCount: '' };
    if (!bookingForm.weddingDate || !bookingForm.venue || !bookingForm.guestCount) {
      setFormError((prev) => ({ ...prev, [featureId]: 'All fields are required.' }));
      return;
    }

    try {
      const response = await axios.post(
        '/api/book-package',
        { ...bookingForm, feature_id: featureId },
        { withCredentials: true }
      );
      setFormSuccess((prev) => ({ ...prev, [featureId]: response.data.message }));
      const updatedData = await axios.get('/api/user-dashboard', { withCredentials: true });
      setBookings(updatedData.data.bookings || []);
      setBookingForms((prev) => ({ ...prev, [featureId]: { weddingDate: '', venue: '', guestCount: '' } }));
      setExpandedPackage(featureId);
    } catch (err) {
      let errorMessage = 'Failed to book package. Please try again.';
      if (err.response?.status === 400 && err.response.data.errors) {
        errorMessage = err.response.data.errors.map((e) => e.msg).join('; ');
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setFormError((prev) => ({ ...prev, [featureId]: errorMessage }));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setFormError((prev) => ({ ...prev, bookings: '' }));
    setFormSuccess((prev) => ({ ...prev, bookings: '' }));

    try {
      const response = await axios.post('/api/cancel-booking', { booking_id: bookingId }, { withCredentials: true });
      setFormSuccess((prev) => ({ ...prev, bookings: response.data.message }));
      const updatedData = await axios.get('/api/user-dashboard', { withCredentials: true });
      setBookings(updatedData.data.bookings || []);
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        bookings: err.response?.data?.error || 'Failed to cancel booking. Please try again.',
      }));
    }
  };

  const togglePackageDetails = (featureId) => {
    setExpandedPackage((prev) => (prev === featureId ? null : featureId));
  };

  const handleBookingInputChange = (featureId, field, value) => {
    setBookingForms((prev) => ({
      ...prev,
      [featureId]: {
        ...(prev[featureId] || { weddingDate: '', venue: '', guestCount: '' }),
        [field]: value,
      },
    }));
  };

  const handleCarouselNav = (featureId, direction) => {
    const feature = features.find((f) => f._id === featureId);
    const images = feature?.features?.filter((f) => f.image).map((f) => f.image) || [];
    if (images.length === 0) return;

    setCarouselIndices((prev) => {
      const currentIndex = prev[featureId] || 0;
      let newIndex;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % images.length;
      } else {
        newIndex = (currentIndex - 1 + images.length) % images.length;
      }
      return { ...prev, [featureId]: newIndex };
    });
  };

  const handleSelectContact = (contact) => {
    setSelectedContactId(contact.contactKey);
    setNewMessageForm((prev) => ({
      ...prev,
      featureId: contact.featureId,
      bookingId: contact.bookingId,
    }));
    setFormError((prev) => ({ ...prev, compose: '' }));
    setFormSuccess((prev) => ({ ...prev, compose: '' }));
  };

  const handleNewMessageChange = (field, value) => {
    setNewMessageForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendNewMessage = async (e) => {
    e.preventDefault();
    setFormError((prev) => ({ ...prev, compose: '' }));
    setFormSuccess((prev) => ({ ...prev, compose: '' }));

    if (!newMessageForm.featureId && !newMessageForm.bookingId) {
      setFormError((prev) => ({ ...prev, compose: 'Select an event manager to start chatting.' }));
      return;
    }

    if (!newMessageForm.content.trim()) {
      setFormError((prev) => ({ ...prev, compose: 'Message content is required.' }));
      return;
    }

    try {
      const payload = {
        content: newMessageForm.content.trim(),
        ...(newMessageForm.featureId ? { feature_id: newMessageForm.featureId } : {}),
        ...(newMessageForm.bookingId ? { booking_id: newMessageForm.bookingId } : {}),
      };
      const response = await axios.post('/api/send-message', payload, { withCredentials: true });
      setFormSuccess((prev) => ({ ...prev, compose: response.data.message }));
      const updatedData = await axios.get('/api/user-dashboard', { withCredentials: true });
      setMessages(updatedData.data.messages || []);
      setNewMessageForm((prev) => ({ ...prev, content: '' }));
    } catch (err) {
      let errorMessage = 'Failed to send message. Please try again.';
      if (err.response?.status === 400 && err.response.data.errors) {
        errorMessage = err.response.data.errors.map((e) => e.msg).join('; ');
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setFormError((prev) => ({ ...prev, compose: errorMessage }));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    setFormError((prev) => ({ ...prev, messages: '' }));
    setFormSuccess((prev) => ({ ...prev, messages: '' }));

    try {
      const response = await axios.post('/api/delete-message', { message_id: messageId }, { withCredentials: true });
      setFormSuccess((prev) => ({ ...prev, messages: response.data.message }));
      const updatedData = await axios.get('/api/user-dashboard', { withCredentials: true });
      setMessages(updatedData.data.messages || []);
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        messages: err.response?.data?.error || 'Failed to delete message. Please try again.',
      }));
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="flex-grow-1">
        <div className="dashboard-container fade-in">
          <h1 className="dashboard-title">User Dashboard</h1>

          <div className="section">
            <h2>Profile</h2>
            <form onSubmit={handleProfileUpdate} className="profile-form">
              {formError.profile && <div className="error">{formError.profile}</div>}
              {formSuccess.profile && <div className="success">{formSuccess.profile}</div>}
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <button type="submit" className="btn-submit">Update Profile</button>
            </form>
          </div>

          <div className="section">
            <h2>Wedding Packages</h2>
            <div className="packages-grid grid grid-2">
              {features.length > 0 ? (
                features.map((feature) => {
                  const images = feature.features.filter((f) => f.image).map((f) => f.image);
                  const currentIndex = carouselIndices[feature._id] || 0;
                  const currentImage = images[currentIndex];

                  return (
                    <div key={feature._id} className="package-card">
                      <div className="package-preview">
                        <h3 className="package-title">{feature.company_name || 'Unnamed Package'}</h3>
                        <p className="package-price">
                          Price: ${feature.package_amount ? feature.package_amount.toFixed(2) : 'N/A'}
                        </p>
                        {images.length > 0 ? (
                          <div className="package-carousel">
                            <button
                              className="carousel-arrow carousel-arrow-left"
                              onClick={() => handleCarouselNav(feature._id, 'prev')}
                              disabled={images.length <= 1}
                              aria-label="Previous image"
                            >
                              &lt;
                            </button>
                            <div className="package-image-wrapper">
                              <img
                                src={`http://localhost:5000${currentImage}`}
                                alt={feature.company_name || 'Feature image'}
                                className="package-image"
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
                            <button
                              className="carousel-arrow carousel-arrow-right"
                              onClick={() => handleCarouselNav(feature._id, 'next')}
                              disabled={images.length <= 1}
                              aria-label="Next image"
                            >
                              &gt;
                            </button>
                          </div>
                        ) : (
                          <p className="no-data">No images available</p>
                        )}
                        <button
                          className="btn-details"
                          onClick={() => togglePackageDetails(feature._id)}
                          aria-expanded={expandedPackage === feature._id}
                        >
                          {expandedPackage === feature._id ? 'Hide Details' : 'Show Details'}
                        </button>
                      </div>
                      {expandedPackage === feature._id && (
                        <div className="package-details">
                          <div className="package-contact">
                            <p><strong>Contact Details:</strong></p>
                            <p>Email: {feature.contact_details?.email || 'Not provided'}</p>
                            <p>Phone: {feature.contact_details?.phone || 'Not provided'}</p>
                            <p>Address: {feature.contact_details?.address || 'Not provided'}</p>
                          </div>
                          {feature.features?.length > 0 ? (
                            <div className="feature-details">
                              <h4>Features:</h4>
                              {feature.features.map((f, idx) => (
                                <div key={idx} className="feature-subitem">
                                  <p>
                                    <strong>{f.name || 'Unnamed Feature'}</strong>: {f.description || 'No description'}
                                  </p>
                                  {f.image ? (
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
                                  ) : (
                                    <p className="no-data">No image available</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="no-data">No features available.</p>
                          )}
                          <form
                            onSubmit={(e) => handleBookingSubmit(e, feature._id)}
                            className="booking-form"
                          >
                            {formError[feature._id] && <div className="error">{formError[feature._id]}</div>}
                            {formSuccess[feature._id] && <div className="success">{formSuccess[feature._id]}</div>}
                            <div className="form-group">
                              <label>Wedding Date</label>
                              <input
                                type="date"
                                value={bookingForms[feature._id]?.weddingDate || ''}
                                onChange={(e) => handleBookingInputChange(feature._id, 'weddingDate', e.target.value)}
                                className="form-control"
                                required
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div className="form-group">
                              <label>Venue</label>
                              <input
                                type="text"
                                value={bookingForms[feature._id]?.venue || ''}
                                onChange={(e) => handleBookingInputChange(feature._id, 'venue', e.target.value)}
                                className="form-control"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Guest Count</label>
                              <input
                                type="number"
                                value={bookingForms[feature._id]?.guestCount || ''}
                                onChange={(e) => handleBookingInputChange(feature._id, 'guestCount', e.target.value)}
                                className="form-control"
                                required
                                min="1"
                              />
                            </div>
                            <button type="submit" className="btn-book">Book Package</button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="no-data">No packages available.</p>
              )}
            </div>
          </div>

          <div className="section">
            <h2>Bookings</h2>
            <div className="bookings-grid grid grid-2">
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <div key={booking._id} className="booking-card">
                    <h3 className="booking-title">{booking.feature_id.company_name || 'Unnamed Package'}</h3>
                    <p className="booking-date">Wedding Date: {formatTimestamp(booking.weddingDate)}</p>
                    <p className="booking-venue">Venue: {booking.venue}</p>
                    <p className="booking-guest-count">Guest Count: {booking.guestCount}</p>
                    {booking.status === 'Pending' && (
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => handleCancelBooking(booking._id)}
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="no-data">No bookings available.</p>
              )}
              {formError.bookings && <div className="error">{formError.bookings}</div>}
              {formSuccess.bookings && <div className="success">{formSuccess.bookings}</div>}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <div>
                <h2>Messenger</h2>
              </div>
              <button
                type="button"
                className="collapse-toggle"
                onClick={() => setMessengerCollapsed((prev) => !prev)}
                aria-expanded={!isMessengerCollapsed}
                aria-label={isMessengerCollapsed ? 'Expand messenger' : 'Minimize messenger'}
              >
                {isMessengerCollapsed ? '＋' : '−'}
              </button>
            </div>
            {!isMessengerCollapsed && (
              <div className="messenger-wrapper">
                <div className="messenger-thread card">
                  <div className="messenger-header">
                    <div className="composer-heading">
                      <h3>Chat with your planner</h3>
                      <p>Select a manager from your bookings to send them a quick update.</p>
                    </div>
                    {managerContacts.length > 0 ? (
                      <div className="contact-pills" role="list">
                        {managerContacts.map((contact) => (
                          <button
                            type="button"
                            key={contact.contactKey}
                            className={`contact-pill ${selectedContactId === contact.contactKey ? 'active' : ''}`}
                            onClick={() => handleSelectContact(contact)}
                            role="listitem"
                          >
                            <div className="contact-pill-avatar" aria-hidden="true">
                              {getInitials(contact.managerName)}
                            </div>
                            <div className="contact-pill-details">
                              <strong>{contact.managerName}</strong>
                              <span>{contact.featureName}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="message-list" ref={messageListRef}>
                    {filteredMessages.length > 0 ? (
                      filteredMessages.map((message) => {
                        const isSender = getId(message.sender_id) === getId(user);
                        const contextParts = [];
                        if (message.feature_id?.company_name) {
                          contextParts.push(message.feature_id.company_name);
                        }
                        if (message.booking_id?.weddingDate) {
                          contextParts.push(new Date(message.booking_id.weddingDate).toLocaleDateString());
                        }
                        const contextLabel = contextParts.length ? contextParts.join(' • ') : null;

                        return (
                          <div key={message._id} className={`message-row ${isSender ? 'sent' : 'received'}`}>
                            <div className="message-avatar" aria-hidden="true">
                              <span>{getInitials(isSender ? user?.name : message.sender_id?.name)}</span>
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
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="no-data messenger-empty">
                        {selectedContact ? 'No conversation yet. Send the first message!' : 'No messages yet. Start the conversation!'}
                      </p>
                    )}
                  </div>
                  <div className="message-composer embedded">
                    {formError.compose && <div className="error">{formError.compose}</div>}
                    {formSuccess.compose && <div className="success">{formSuccess.compose}</div>}
                    <form onSubmit={handleSendNewMessage} className="message-form">
                      {selectedContact && (
                        <div className="selected-contact-banner">
                          <span className="label">Chatting with</span>
                          <strong>{selectedContact.managerName}</strong>
                          <span className="meta">{selectedContact.featureName}</span>
                        </div>
                      )}
                      <div className="composer-input-row">
                        <textarea
                          className="composer-textarea"
                          rows="1"
                          value={newMessageForm.content}
                          onChange={(e) => handleNewMessageChange('content', e.target.value)}
                          placeholder={selectedContact ? 'Type your message...' : 'Select a manager to start chatting'}
                          disabled={!selectedContact}
                          required
                        />
                        <button
                          type="submit"
                          className="btn-icon"
                          aria-label="Send message"
                          disabled={!selectedContact || !newMessageForm.content.trim()}
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

export default UserDashboard;