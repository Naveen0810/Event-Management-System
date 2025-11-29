import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

axios.defaults.baseURL = 'http://localhost:5000';

const personaCopy = {
  admin: 'Managers design curated packages, reply to enquiries, and unlock financial controls in one console.',
  user: 'Users discover curated experiences, manage bookings, and stay aligned with planners at every milestone.',
};

const Navbar = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const closeDropdown = () => setDropdownOpen(false);

  return (
    <nav className="navbar glass-nav auth-nav">
      <div className="navbar-brand">
        <Link to="/">Event Management</Link>
      </div>
      <div className="navbar-links" aria-hidden="true" />
      <div className="navbar-cta" aria-hidden="true" />

    </nav>
  );
};

const Footer = () => (
  <footer className="footer">
    <div>
      <p> {new Date().getFullYear()} Event Management. Crafted for iconic experiences.</p>
      <div className="footer-links">
        <a href="/#about">About</a>
        <a href="/#contact">Contact</a>
      </div>
    </div>
  </footer>
);

const Auth = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialSection = searchParams.get('section') || 'login';
  const initialRole = searchParams.get('role') || 'user';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [activeRole, setActiveRole] = useState(initialRole);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: initialRole });
  const [error, setError] = useState('');

  const updateParams = (sectionValue, roleValue) => {
    setSearchParams({ section: sectionValue, role: roleValue });
  };

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setActiveRole(initialRole);
    setFormData((prev) => ({ ...prev, role: initialRole }));
  }, [initialRole]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTabChange = (sectionValue) => {
    setActiveSection(sectionValue);
    updateParams(sectionValue, activeRole);
    setError('');
  };

  const handleRoleChange = (roleValue) => {
    setActiveRole(roleValue);
    setFormData((prev) => ({ ...prev, role: roleValue }));
    updateParams(activeSection, roleValue);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = activeSection === 'login' ? '/api/login' : '/api/register';
    const payload = {
      email: formData.email,
      password: formData.password,
      ...(activeSection === 'signup' && { name: formData.name, role: activeRole }),
    };

    try {
      const response = await axios.post(endpoint, payload, { withCredentials: true });

      if (activeSection === 'login') {
        const { redirect } = response.data;
        if (!redirect) {
          setError('Login succeeded, but a redirect destination was not provided.');
          return;
        }
        navigate(redirect);
      } else {
        navigate(response.data.redirect || `/auth?section=login&role=${activeRole}`);
      }
    } catch (err) {
      let errorMessage = '';
      if (err.response?.status === 400 && err.response.data.errors) {
        errorMessage = err.response.data.errors.map((e) => e.msg).join('; ');
      } else {
        errorMessage = err.response?.data?.error || err.message || 'An error occurred. Please try again.';
        if (err.response?.status === 401) {
          errorMessage = 'Invalid credentials. Please check your email or password.';
        }
      }
      setError(errorMessage);
    }
  };

  return (
    <div className="auth-page">
      <Navbar />
      <main className="auth-shell auth-centered">
        <section className="auth-panel card compact">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${activeSection === 'login' ? 'active' : ''}`}
              onClick={() => handleTabChange('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab ${activeSection === 'signup' ? 'active' : ''}`}
              onClick={() => handleTabChange('signup')}
            >
              Sign up
            </button>
          </div>

          <div className="role-toggle">
            {['user', 'admin'].map((roleOption) => (
              <button
                type="button"
                key={roleOption}
                className={roleOption === activeRole ? 'active' : ''}
                onClick={() => handleRoleChange(roleOption)}
              >
                {roleOption === 'admin' ? 'Event manager' : 'User'}
              </button>
            ))}
          </div>

          <h2>{activeSection === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="muted">{activeRole === 'admin' ? 'Manager portal' : 'User portal'}</p>

          {error && <p className="error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit} className="form-stack">
            {activeSection === 'signup' && (
              <label className="input-field">
                Full name
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </label>
            )}
            <label className="input-field">
              Email address
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>
            <label className="input-field">
              Password
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                minLength={6}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary full-width">
              {activeSection === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <p className="toggle-text">
            {activeSection === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="toggle-link"
              onClick={() => handleTabChange(activeSection === 'login' ? 'signup' : 'login')}
            >
              {activeSection === 'login' ? 'Sign up' : 'Login'}
            </button>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;