import gsap from 'gsap';

const mm = gsap.matchMedia();

const breakpoints = {
  isMobile: `(max-width: 599px)`,
  isTablet: `(min-width: 600px) and (max-width: 899px)`,
  isDesktop: `(min-width: 900px)`,
  prefersReducedMotion: '(prefers-reduced-motion: reduce)',
};

const MatchMediaManager = {
  add(callback) {
    mm.add(breakpoints, callback);
  },
};

export default MatchMediaManager;
