import { createNoise2D } from 'simplex-noise';
import mapRange from './utils/mapRange';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MatchMediaManager from './MatchMediaManager';
const noise2D = createNoise2D();

gsap.registerPlugin(ScrollTrigger);

export default class ExperienceWaterfall {
  constructor() {
    this.el = document.querySelector('.experience-rows');
    this.rows = this.el.querySelectorAll('.experience-row');

    this.init();
  }
  getWavedCoords(idx) {
    return mapRange(
      noise2D(0, idx),
      0,
      1,
      -window.innerWidth * 0.75,
      window.innerWidth * 0.75
    );
  }
  init() {
    this.rows.forEach((row, idx) => {
      row.style.setProperty('--factor', 0.3);
      const rowTitle = row.querySelector('.experience-row__title');
      const rowTitleWidth = rowTitle.getBoundingClientRect().width.toFixed(2);

      const wavedCoords = this.getWavedCoords(idx).toFixed(2);
      row.style.paddingLeft = 0;
      MatchMediaManager.add(({ conditions }) => {
        const { isMobile, prefersReducedMotion } = conditions;
        if (prefersReducedMotion & !isMobile) {
          row.style.transform = `translateX(calc(50vw - ${
            rowTitleWidth / 2
          }px))`;
        } else if (!prefersReducedMotion) {
          row.style.transform = isMobile
            ? `translateX(calc(${wavedCoords}px * var(--factor)))`
            : `translateX(calc((${wavedCoords}px + ${
                window.innerWidth / 2
              }px) * var(--factor) - ${rowTitleWidth / 2}px + ${
                window.innerWidth / 2
              }px))`;
        }
      });
    });

    this.animate();
  }
  animate() {
    MatchMediaManager.add(({ conditions }) => {
      const { prefersReducedMotion, isMobile } = conditions;
      this.rows.forEach((row) => {
        const tl = gsap.timeline({
          autoRemoveChildren: true,
        });
        if (!prefersReducedMotion) {
          tl.to(row, {
            '--factor': 0,
            duration: 2,
            ease: isMobile ? 'linear' : 'power1.in',
            scrollTrigger: {
              trigger: row,
              start: 'bottom bottom',
              end: isMobile ? 'top bottom+=300px' : 'top center',
              scrub: 1,
            },
          });
        }

        tl.to(row, {
          opacity: 0,
          scrollTrigger: {
            trigger: row,
            start: 'top top+=100',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });
    });
  }
}
