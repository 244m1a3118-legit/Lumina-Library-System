import React from 'react';

export const AboutContent = () => (
  <>
    <div className="modal-header">
      <div>
        <h1 id="modal-title">About Our Library</h1>
        <p>Building Excellence Through Knowledge and Innovation</p>
      </div>
    </div>
    <div className="modal-body">
      <p>
        Vemu Institute of Technology's Central Library stands as a pillar of academic excellence,
        serving the institution since its inception. With a commitment to continuous improvement and
        innovation, we have evolved to meet the changing needs of our academic community.
      </p>
      <h2>Library Facilities &amp; Infrastructure</h2>
      <p>
        Our modern library building features state-of-the-art infrastructure with comfortable reading areas,
        high-speed internet connectivity, and advanced information technology resources. We maintain an
        environment conducive to learning, research, and intellectual exchange.
      </p>
      <div className="stats-card">
        <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-white)' }}>📊 Library by Numbers</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">55K+</div>
            <div className="stat-label">Book Volumes</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">2K+</div>
            <div className="stat-label">Print Journals</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <div className="stat-label">Digital Theses</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">50K+</div>
            <div className="stat-label">E-Resources</div>
          </div>
        </div>
      </div>
      <h3>Collections &amp; Resources</h3>
      <div className="feature-grid">
        <div className="feature-card">
          <h4>📖 Print Collections</h4>
          <p>Comprehensive coverage of engineering, technology, and management disciplines.</p>
        </div>
        <div className="feature-card">
          <h4>💻 Electronic Resources</h4>
          <p>Online journals, e-books, databases, and multimedia materials.</p>
        </div>
        <div className="feature-card">
          <h4>🎓 Special Collections</h4>
          <p>Theses, dissertations, and institutional repositories.</p>
        </div>
        <div className="feature-card">
          <h4>📚 Reference Materials</h4>
          <p>Encyclopedias, handbooks, and comprehensive research guides.</p>
        </div>
      </div>
      <h2>Advanced Technology Infrastructure</h2>
      <p>Our library is equipped with cutting-edge technology to support your academic and research needs:</p>
      <ul>
        <li>High-speed Wi-Fi available throughout the building for seamless connectivity</li>
        <li>Modern computer terminals and workstations with latest software</li>
        <li>Advanced cataloguing and sophisticated library management systems</li>
        <li>Video conferencing and virtual meeting facilities for remote collaboration</li>
        <li>Multimedia production equipment for research and presentation projects</li>
        <li>Secure and privacy-protected study environments</li>
      </ul>
      <h2>Professional &amp; Dedicated Staff</h2>
      <p>Our team of qualified librarians and support staff are committed to providing excellent service and supporting your academic and research endeavors.</p>
      <div className="feature-grid">
        <div className="feature-card">
          <h4>🎯 Personalized Assistance</h4>
          <p>Expert guidance tailored to your specific research needs and academic goals.</p>
        </div>
        <div className="feature-card">
          <h4>📚 Training Sessions</h4>
          <p>Comprehensive database training and information literacy programs.</p>
        </div>
        <div className="feature-card">
          <h4>🔍 Research Support</h4>
          <p>In-depth consultation for thesis, dissertation, and research projects.</p>
        </div>
        <div className="feature-card">
          <h4>💡 Expert Guidance</h4>
          <p>Navigate complex information landscapes with our expert recommendations.</p>
        </div>
      </div>
      <h2>Commitment to Excellence</h2>
      <div className="highlight-box">
        <p><strong>🏆 Our Promise:</strong> We continuously update our collections with the latest publications and research materials to ensure you have access to cutting-edge academic resources that support your success.</p>
      </div>
      <h3>Vision for the Future</h3>
      <ul>
        <li>Expanding our digital collections and online resources</li>
        <li>Implementing innovative library technologies and services</li>
        <li>Creating collaborative learning spaces for group research and study</li>
        <li>Providing support for emerging research methodologies</li>
        <li>Fostering information literacy and critical thinking skills</li>
        <li>Building partnerships with national and international academic institutions</li>
      </ul>
    </div>
  </>
);
