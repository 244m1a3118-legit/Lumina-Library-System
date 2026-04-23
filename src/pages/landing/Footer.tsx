import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  onOpenModal: (modalName: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenModal }) => {
  return (
    <footer>
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About Vemu Library</h4>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 0 }}>
              Committed to providing world-class library services and resources
              to support the academic excellence of our institution.
            </p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo(0,0); }}>Home</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenModal('about'); }} className="modal-trigger">About Us</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenModal('contact'); }} className="modal-trigger">Contact</a></li>
              <li><Link to="/login">Login Portal</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Digital Collections</a></li>
              <li><a href="#">Research Guides</a></li>
              <li><a href="#">Database Access</a></li>
              <li><a href="#">Library Services</a></li>
            </ul>
          </div>
        </div>
        <div className="social-links">
          <a href="#" className="social-link" title="Facebook" aria-label="Facebook">f</a>
          <a href="#" className="social-link" title="Twitter" aria-label="Twitter">𝕏</a>
          <a href="#" className="social-link" title="Instagram" aria-label="Instagram">📷</a>
          <a href="#" className="social-link" title="LinkedIn" aria-label="LinkedIn">in</a>
        </div>
        <div className="footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} Vemu Institute of Technology (Autonomous). All rights reserved. |
            <a href="#">Privacy Policy</a> |
            <a href="#">Terms of Service</a>
          </p>
        </div>
      </div>
    </footer>
  );
};
