import React, { useState } from 'react';
// Force tracking for landing page
import { Header } from './landing/Header';
import { Hero } from './landing/Hero';
import { Footer } from './landing/Footer';
import { Modal } from './landing/Modal';
import { OverviewContent } from './landing/OverviewContent';
import { AboutContent } from './landing/AboutContent';
import { ContactContent } from './landing/ContactContent';
import './landing/landing.css';

export default function LandingPage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleOpenModal = (modalName: string) => {
    setActiveModal(modalName);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="landing-theme">
      <a href="#home" className="visually-hidden" style={{ position: 'fixed', top: 0, left: 0, zIndex: 10001 }}>
        Skip to main content
      </a>
      
      <Header onOpenModal={handleOpenModal} />
      <Hero onOpenModal={handleOpenModal} />
      <Footer onOpenModal={handleOpenModal} />

      <Modal isOpen={activeModal !== null} onClose={handleCloseModal}>
        {activeModal === 'overview' && <OverviewContent />}
        {activeModal === 'about' && <AboutContent />}
        {activeModal === 'contact' && <ContactContent />}
      </Modal>
    </div>
  );
}
