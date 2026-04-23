import React, { useState } from 'react';

export const ContactContent = () => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    }, 1000);
  };

  return (
    <>
      <div className="modal-header">
        <div>
          <h1 id="modal-title">Contact Us</h1>
          <p>We're Here to Assist You With All Your Library Needs</p>
        </div>
      </div>
      <div className="modal-body">
        <p style={{ marginBottom: 'var(--spacing-lg)' }}>
          Have questions about our library services? Need research assistance or have suggestions?
          We're here to help and would love to hear from you!
        </p>
        <h2>Get in Touch</h2>
        <div className="contact-section">
          <div className="contact-item">
            <div className="contact-icon">📍</div>
            <div>
              <h4>Campus Location</h4>
              <p>
                Vemu Institute of Technology (Autonomous)<br />
                P.Kothakota, Chittoor<br />
                Andhra Pradesh, India - 517588
              </p>
            </div>
          </div>
          <div className="contact-item">
            <div className="contact-icon">✉️</div>
            <div>
              <h4>Email Address</h4>
              <p>
                <a href="mailto:library@vemu.org" style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>library@vemu.org</a><br />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>We typically respond within 24 hours</span>
              </p>
            </div>
          </div>
          <div className="contact-item">
            <div className="contact-icon">📞</div>
            <div>
              <h4>Phone Number</h4>
              <p>
                <a href="tel:+919876543210" style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>+91 9876 543210</a><br />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>Mon-Fri: 8:00 AM - 5:00 PM</span>
              </p>
            </div>
          </div>
          <div className="contact-item">
            <div className="contact-icon">🕐</div>
            <div>
              <h4>Library Hours</h4>
              <p>
                <strong>Monday - Friday:</strong> 8:00 AM - 8:00 PM<br />
                <strong>Saturday:</strong> 9:00 AM - 5:00 PM<br />
                <strong>Sunday:</strong> Closed<br />
                <strong>Digital Resources:</strong> Available 24/7 ⏰
              </p>
            </div>
          </div>
        </div>
        <h2>Quick Support Topics</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>🔍 Research Help</h4>
            <p>Get expert assistance with thesis, dissertation, and research projects.</p>
          </div>
          <div className="feature-card">
            <h4>📚 Book Access</h4>
            <p>Questions about borrowing, renewals, or finding specific resources?</p>
          </div>
          <div className="feature-card">
            <h4>💻 Technical Support</h4>
            <p>Need help accessing online resources or using our digital systems?</p>
          </div>
          <div className="feature-card">
            <h4>🎓 Training Sessions</h4>
            <p>Request personalized database training and information literacy programs.</p>
          </div>
        </div>
        <h2>Send Us a Message</h2>
        <div className="form-section">
          <form id="contactForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input type="text" id="name" name="name" required placeholder="Enter your full name" autoComplete="name" />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input type="email" id="email" name="email" required placeholder="your.email@example.com" autoComplete="email" />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <input type="text" id="subject" name="subject" required placeholder="What is your inquiry about?" autoComplete="off" />
            </div>
            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea id="message" name="message" required placeholder="Tell us how we can help you..."></textarea>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={status !== 'idle'}
              style={status === 'success' ? { background: 'var(--color-success)' } : {}}
            >
              {status === 'success' ? '✓ Message Sent!' : status === 'submitting' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
        <div className="highlight-box">
          <p><strong>✓ Your Privacy Matters:</strong> All information you provide is secure and used only to respond to your inquiry. We never share your data with third parties.</p>
        </div>
        <h3>Frequently Asked Questions</h3>
        <ul>
          <li><strong>How do I access online resources?</strong> Visit our portal or email us for login credentials.</li>
          <li><strong>Can I extend my book borrowing period?</strong> Yes! Renewals can be done online or through our library staff.</li>
          <li><strong>Do you offer document delivery?</strong> Yes, we can scan and email documents from our collection.</li>
          <li><strong>How do I book a research consultation?</strong> Contact us via email or phone to schedule an appointment.</li>
        </ul>
      </div>
    </>
  );
};
