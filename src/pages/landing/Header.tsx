import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onOpenModal: (modalName: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenModal }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleModalClick = (e: React.MouseEvent<HTMLAnchorElement>, modalName: string) => {
    e.preventDefault();
    setMenuOpen(false);
    onOpenModal(modalName);
  };

  return (
    <header id="header" className={scrolled ? 'scrolled' : ''}>
      <div className="container">
        <nav className="nav-wrapper">
          <a href="#" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo(0,0); }}>
            <div className="logo-icon">📚</div>
            <span>Vemu Library</span>
          </a>

          <ul 
            className="nav-menu" 
            id="navMenu"
            style={menuOpen ? {
              display: 'flex',
              flexDirection: 'column',
              position: 'absolute',
              top: '100%',
              left: '0',
              right: '0',
              gap: '0',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              padding: 'var(--spacing-md)',
              zIndex: 999
            } : {}}
          >
            <li><a href="#" onClick={(e) => handleModalClick(e, 'overview')} className="nav-link modal-trigger">Overview</a></li>
            <li><a href="#" onClick={(e) => handleModalClick(e, 'about')} className="nav-link modal-trigger">About Us</a></li>
            <li><a href="#" onClick={(e) => handleModalClick(e, 'contact')} className="nav-link modal-trigger">Contact</a></li>
            <li className="nav-login">
              <Link to="/login" className="btn btn-primary">Login Portal</Link>
            </li>
          </ul>

          <button 
            className={`menu-toggle ${menuOpen ? 'active' : ''}`} 
            id="menuToggle" 
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
      </div>
    </header>
  );
};
