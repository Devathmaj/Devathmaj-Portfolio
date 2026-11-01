import gsap from 'gsap';
import { convertSplitElIntoLines } from '../utils/convertSplitElIntoLines';
import { DefaultFadeIn } from './Fade';

export const ProjectEntryTransition = (transitioningView, mediaQueries) => {
  const { prefersReducedMotion } = mediaQueries;

  const title = transitioningView.querySelector('.project-header__title');
  const abstract = transitioningView.querySelector('.project-header__abstract');
  const tl = gsap.timeline();

  if (prefersReducedMotion) {
    tl.add(DefaultFadeIn(transitioningView));
  } else {
    Splitting({
      target: title,
      by: 'chars',
    });
    Splitting({
      target: abstract,
      by: 'lines',
    });
    abstract.innerHTML = convertSplitElIntoLines(abstract);

    tl.from('.project-header__mark', {
      ease: 'power3.inOut',
      duration: 0.5,
      opacity: 0,
    })
      .from(
        '.project-header__title .char',
        {
          ease: 'power3.inOut',
          duration: 0.5,
          filter: 'blur(2px)',
          opacity: 0,
          stagger: 0.02,
        },
        '<+=.1'
      )
      .from(
        '.project-header__abstract .line',
        {
          y: '-50%',
          opacity: 0,
          stagger: 0.05,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
          duration: 0.5,
        },
        '<+=.3'
      )
      .from(
        '.project-header__meta div :is(dt, dd:not(:has(ul)), li)',
        {
          opacity: 0,
          duration: 0.5,
        },
        '<+=.2'
      )
      .from(
        '.project-dossier',
        {
          y: 24,
          opacity: 0,
          duration: 0.5,
        },
        '<+=.2'
      )
      .from(
        '.project-header__cover',
        {
          y: 24,
          opacity: 0,
          duration: 0.6,
          ease: 'power3.out',
        },
        '<+=.1'
      )
      .from(
        '.project-explorer',
        {
          y: '50%',
          opacity: 0,
          duration: 0.5,
        },
        '<+=.2'
      )
      .from(
        '.article-content, .project-chapter-nav, .project-source',
        {
          opacity: 0,
          duration: 0.3,
        },
        '<+=.2'
      )
      .from(
        '.project-more',
        {
          y: 24,
          opacity: 0,
          duration: 0.5,
        },
        '<+=.1'
      );
  }
  return tl;
};
export const ProjectExitTransition = () => {
  if (window.location.hash) {
    window.history.replaceState(
      null,
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
  }

  const exitTl = gsap.timeline({
    clearProps: true,
  });
  exitTl.to(
    '.project-header__mark, .project-header__title, .project-header__abstract, .project-header__meta, .project-header__cover, .project-dossier, .project-explorer, .article-content, .project-chapter-nav, .project-source, .project-more',
    {
      opacity: 0,
      y: '50%',
      ease: 'power4.in',
      stagger: 0.05,
      duration: 0.3,
    }
  );
  return exitTl;
};
