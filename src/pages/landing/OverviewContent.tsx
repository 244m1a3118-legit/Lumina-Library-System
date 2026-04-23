import React from 'react';

export const OverviewContent = () => (
  <>
    <div className="modal-header">
      <div>
        <h1 id="modal-title">Library Overview</h1>
        <p>Your Gateway to Knowledge and Academic Excellence</p>
      </div>
    </div>
    <div className="modal-body">
      <p>
        Welcome to the Vemu Institute of Technology Central Library - your gateway to academic excellence
        and knowledge discovery. Our state-of-the-art library infrastructure is designed to support the
        educational and research needs of our students, faculty, and researchers.
      </p>
      <div className="highlight-box">
        <p>💡 <strong>Our library is open 24/7 for digital resources!</strong> Access our e-books, journals, and databases anytime, anywhere.</p>
      </div>
      <h2>Our Mission</h2>
      <p>
        To provide comprehensive library services and resources that facilitate learning, teaching, and
        research while promoting intellectual growth and academic excellence within the Vemu community.
      </p>
      <h3>Key Highlights</h3>
      <div className="feature-grid">
        <div className="feature-card">
          <h4>📚 Extensive Collection</h4>
          <p>Over 55,000 book volumes covering diverse disciplines and research areas.</p>
        </div>
        <div className="feature-card">
          <h4>🌐 Digital Resources</h4>
          <p>Access to 50,000+ e-books, journals, and comprehensive databases.</p>
        </div>
        <div className="feature-card">
          <h4>👨‍💼 Expert Support</h4>
          <p>Dedicated librarians available for research guidance and consultation.</p>
        </div>
        <div className="feature-card">
          <h4>🏢 Modern Facilities</h4>
          <p>Reading rooms, computer labs, and collaborative study spaces.</p>
        </div>
        <div className="feature-card">
          <h4>⏰ Always Available</h4>
          <p>24/7 access to digital resources for your convenience.</p>
        </div>
        <div className="feature-card">
          <h4>📖 Specialized Collections</h4>
          <p>Technical, engineering, and humanities materials for all needs.</p>
        </div>
      </div>
      <h3>Services Available</h3>
      <ul>
        <li>Book borrowing and renewal services with convenient checkout options</li>
        <li>Inter-library loan programs for access to resources beyond our collection</li>
        <li>Research assistance and personalized database training sessions</li>
        <li>Document scanning and digitization services</li>
        <li>Library orientation and information literacy programs</li>
        <li>Exclusive access to academic journals and online databases</li>
      </ul>
      <h3>Why Choose Vemu Library?</h3>
      <p>
        Our dedicated team of librarians and support staff are committed to enhancing your academic
        experience and ensuring you have access to the resources you need to succeed.
      </p>
      <ul>
        <li>Personalized research assistance tailored to your needs</li>
        <li>Access to the latest academic and professional resources</li>
        <li>Comfortable and technology-rich learning environment</li>
        <li>Flexible borrowing policies to support your academic journey</li>
        <li>Expert guidance in navigating complex information landscapes</li>
      </ul>
      <p style={{ marginTop: 'var(--spacing-2xl)', padding: 'var(--spacing-lg)', background: 'rgba(59,130,246,0.05)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)' }}>
        📞 Need assistance? Contact our library team at <strong>library@vemu.org</strong> or visit us on campus!
      </p>
    </div>
  </>
);
