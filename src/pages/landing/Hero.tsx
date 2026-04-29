import React from 'react';
import { Link } from 'react-router-dom';

interface HeroProps {
  onOpenModal: (modalName: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenModal }) => {
  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-content">
          <h1>Knowledge Without Boundaries</h1>
          <p className="subtitle">
            Discover Vemu Institute's commitment to academic excellence through our autonomous
            library management system. Access thousands of volumes, journals, and digital resources
            designed to support your academic journey.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-large">Access Library Portal</Link>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onOpenModal('overview'); }} 
              className="btn btn-secondary btn-large modal-trigger"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};
