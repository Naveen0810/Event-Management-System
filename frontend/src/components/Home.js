import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Carousel, Container, Dropdown } from 'react-bootstrap';

const carouselImages = [
  {
    url: '/images/eventmanagementimg.jpeg',
    title: 'Unforgettable Weddings',
    subtitle: 'Craft your perfect day with us',
  },
  {
    url: '/images/eventmanagementimg2.jpg',
    title: 'Stunning Venues',
    subtitle: 'Discover the best locations',
  },
  {
    url: '/images/eventmanagementimg3.jpeg',
    title: 'Timeless Memories',
    subtitle: 'Make every moment count',
  },
];

const stats = [
  { label: 'Vendors onboarded', value: '120+', accent: 'accent-primary' },
  { label: 'Avg. planning time saved', value: '38hrs', accent: 'accent-success' },
  { label: 'Cities covered', value: '30+', accent: 'accent-warning' },
  { label: 'Client happiness score', value: '4.9/5', accent: 'accent-info' },
];

const features = [
  {
    title: 'User-Friendly Booking',
    description:
      'Easily request, compare, and book curated packages with customizable options for date, venue, and guest count.',
  },
  {
    title: 'Manager Command Center',
    description: 'Admins can manage packages, approvals, and conversations without juggling spreadsheets.',
  },
  {
    title: 'Transparent Collaboration',
    description: 'Real-time notifications keep couples and planners aligned from enquiry to final payment.',
  },
];

const timelineSteps = [
  { title: 'Browse curated packages', copy: 'Filter by budget, city, and vibe in seconds.' },
  { title: 'Share your brief', copy: 'Send managers the details so they can tailor every detail.' },
  { title: 'Confirm and track', copy: 'Approve proposals, sign contracts, and monitor progress.' },
  { title: 'Celebrate with ease', copy: 'Keep guests, vendors, and planners in sync on the big day.' },
];

const testimonials = [
  { quote: 'We cut our planning time in half and never lost track of a single message.', author: 'Priya & Karan' },
  { quote: 'Vendors love the clarity. Clients love the transparency. Everyone wins.', author: 'Studio Oris Events' },
  { quote: 'Dashboards and automation made our boutique agency feel enterprise-ready.', author: 'The Gala Co.' },
];

const Home = () => {
  const [index, setIndex] = useState(0);

  const handleSelect = (selectedIndex) => {
    setIndex(selectedIndex);
  };

  return (
    <div className="legacy-home d-flex flex-column min-vh-100 home-page">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">Event Management</Link>
        <div className="navbar-links">
          <Link to="/auth?section=login&role=user" className="nav-link">Login</Link>
          <Link to="/auth?section=signup&role=user" className="btn-primary">Sign Up</Link>
        </div>
      </nav>

      <section className="carousel-section fade-in">
        <Carousel activeIndex={index} onSelect={handleSelect} interval={5000}>
          {carouselImages.map((image, idx) => (
            <Carousel.Item key={idx}>
              <img className="d-block w-100 carousel-img" src={image.url} alt={image.title} />
              <Carousel.Caption className="carousel-caption">
                <h3>{image.title}</h3>
                <p>{image.subtitle}</p>
              </Carousel.Caption>
            </Carousel.Item>
          ))}
        </Carousel>
      </section>

      <header className="hero fade-in">
        <div className="hero-content">
          <h1>All your wedding workflows, finally in one place.</h1>
          <p>
            Streamline how you scout venues, negotiate with vendors, collaborate with clients, and execute every celebration. Tap
            into curated packages, fast approvals, and realtime dashboards.
          </p>
          <div className="hero-cta">
            <Link to="/auth?section=signup&role=user" className="btn-submit">Plan my wedding</Link>
            <Link to="/auth?section=login&role=admin" className="btn-ghost">I manage events</Link>
          </div>
        </div>
      </header>

      <section className="stats-section">
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat-card ${stat.accent}`}>
              <h3>{stat.label}</h3>
              <div className="stat-number">{stat.value}</div>
              <p>Powered by vetted planners and live vendor insights.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section fade-in">
        <Container>
          <div className="section-header">
            <div>
              <div className="pill">Why couples love us</div>
              <h2 className="section-title">Purpose-built for planners & dreamers</h2>
              <p className="section-subtext">Every workflow is automated, every message searchable, every detail crystal clear.</p>
            </div>
          </div>
          <div className="grid grid-3">
            {features.map((feature, idx) => (
              <div className="feature-card card" key={feature.title}>
                <span className="pill">0{idx + 1}</span>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="timeline-section fade-in">
        <Container>
          <div className="section-header">
            <div>
              <div className="pill">How it works</div>
              <h2 className="section-title">Four steps to a stress-free celebration</h2>
            </div>
          </div>
          <div className="timeline">
            {timelineSteps.map((step, idx) => (
              <div className="timeline-step" key={step.title}>
                <div className="timeline-step-index">0{idx + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="testimonials-section fade-in">
        <Container>
          <div className="section-header">
            <div>
              <div className="pill">Testimonials</div>
              <h2 className="section-title">Loved by planners. Cherished by couples.</h2>
            </div>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((item) => (
              <div className="testimonial-card" key={item.author}>
                <p>{item.quote}</p>
                <h4>{item.author}</h4>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="cta-section fade-in">
        <div className="cta-banner">
          <h2>Ready to plan smarter?</h2>
          <p className="supporting-text">Create a free account in under two minutes.</p>
          <Link to="/auth?section=signup&role=user" className="btn-primary">Get Started Now</Link>
        </div>
      </section>

      <footer className="footer">
        <p> 2025 Event Management. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;