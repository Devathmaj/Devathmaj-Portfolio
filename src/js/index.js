import { Core, Renderer } from '@unseenco/taxi';

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
gsap.config({ nullTargetWarn: false });

import MatchMediaManager from './MatchMediaManager';
import NavManager from './NavManager';
import SiteNavigation from './SiteNavigation';
import { DiscoveryStore } from './DiscoveryStore';
import DiscoveryUI from './DiscoveryUI';
import QuoteShuffle from './QuoteShuffle';
import { restorePlayback, syncVinylDock } from './vinylAudio';
import { assetManager } from './assets/AssetManager';

import { updateFooterBreadcrumbs } from './utils/updateFooterBreadcrumbs';

import DefaultTransition from './transitions/Default';

// Keep the no-JS fallback until the module actually runs, then opt into the
// JavaScript-enhanced styles. This replaces the inline script so the page can
// ship a strict script-src CSP without hashes or 'unsafe-inline'.
document.body.classList.remove('no-js');

window.navManager = new NavManager();
const discovery = new DiscoveryStore();
const discoveryUI = new DiscoveryUI(discovery);
const siteNavigations = [];
const refreshSiteNavigations = () => {
  for (let index = siteNavigations.length - 1; index >= 0; index -= 1) {
    if (!siteNavigations[index].root.isConnected) {
      siteNavigations[index].destroy();
      siteNavigations.splice(index, 1);
    }
  }

  document.querySelectorAll('[data-site-navigation]').forEach((root) => {
    if (!siteNavigations.some((navigation) => navigation.root === root)) {
      siteNavigations.push(new SiteNavigation(root, discovery));
    }
  });

  siteNavigations.forEach((navigation) => navigation.syncCurrentPage());
};
refreshSiteNavigations();
history.scrollRestoration = 'manual';
window.assetManager = assetManager;
assetManager.start();
restorePlayback();

const callout = document.querySelector('.callout');
const pageNav = document.querySelector('.page-nav');
if (callout && pageNav) {
  const syncCalloutHeight = () => {
    pageNav.style.setProperty(
      '--callout-height',
      `${callout.getBoundingClientRect().height}px`,
    );
  };

  syncCalloutHeight();
  window.addEventListener('resize', syncCalloutHeight);
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncCalloutHeight).observe(callout);
  }
}

window.mediaQueries = {};
MatchMediaManager.add(({ conditions }) => {
  Object.assign(window.mediaQueries, conditions);
});

let projectEntries = null;
let projectShowcase = null;
let projectSignals = [];
let imageShuffles = [];
let quoteShuffle = null;
let vinylPlayer = null;
let certificateStack = null;

const destroyVinylPlayer = () => {
  vinylPlayer?.destroy();
  vinylPlayer = null;
};

const destroyImageShuffles = () => {
  imageShuffles.forEach((shuffle) => shuffle.destroy());
  imageShuffles = [];
};

const destroyProjectShowcase = () => {
  if (projectShowcase) {
    projectShowcase.destroy();
    projectShowcase = null;
  }
};

const destroyProjectSignals = () => {
  projectSignals.forEach((signal) => signal.destroy());
  projectSignals = [];
};

class DefaultRenderer extends Renderer {
  initialLoad() {
    console.log(`
Hey, curious developer.

If you're reading this, you've found your way
a little deeper into the website than most.

I'm a software engineer who enjoys building things,
breaking things, and figuring out how they work.

Since you're already here, feel free to look around.
There might be a few more things worth discovering.

Happy exploring!
`);
    window.addEventListener('keypress', ({ shiftKey, key }) => {
      if (shiftKey && key === 'D') {
        document.body.classList.toggle('themed');
        document.body.classList.toggle('dark');
      }
      if (shiftKey && key === 'G') {
        document.body.classList.toggle('with-grid');
      }
    });
    if (window.location.pathname === '/') {
      navManager.hide(true);
    }

    if (document.querySelector('.home-experience__title')) {
      MatchMediaManager.add(({ conditions }) => {
        const { prefersReducedMotion } = conditions;
        gsap.from('.home-experience__title', {
          '--banner-scale': prefersReducedMotion ? 1 : 0,

          scrollTrigger: {
            trigger: '.home-experience__title',
            start: 'top bottom',
            end: 'bottom center',
            scrub: 2,
          },
        });
      });
    }
    this.onEnter();
  }
  onEnter() {
    discoveryUI.refresh();
    discovery.trackPathname();
    navManager.updateLink();
    refreshSiteNavigations();
    if (document.querySelector('.about-page')) {
      import('./About')
        .then(({ default: initAbout }) => initAbout())
        .catch((error) => console.error('Failed to initialise the About page:', error));
    }

    const quoteStack = document.querySelector('[data-quote-stack]');
    if (quoteStack) quoteShuffle = new QuoteShuffle(quoteStack);

    if (window.location.pathname === '/') {
      navManager.hide();
      document.body.classList.add('home');
      MatchMediaManager.add(({ conditions }) => {
        const { prefersReducedMotion, isMobile } = conditions;
        gsap.from('.home-about__title-inner', {
          x: prefersReducedMotion || isMobile ? 0 : '50vw',
          scrollTrigger: {
            trigger: '.home-about__title',
            start: 'top bottom',
            end: 'bottom center',
            scrub: 2,
          },
        });
      });
    } else {
      if (navManager.hidingNav.progress() > 0) {
        navManager.show();
      }
      document.body.classList.remove('home');
    }
    destroyImageShuffles();
    destroyProjectShowcase();
    destroyProjectSignals();

    destroyVinylPlayer();
    const vinylRoot = document.querySelector('[data-vinyl-player]');
    if (vinylRoot) {
      import('./VinylPlayer').then(({ default: VinylPlayer }) => {
        if (vinylRoot.isConnected) vinylPlayer = new VinylPlayer(vinylRoot);
      }).catch((error) => console.error('Failed to load the vinyl player:', error));
    }

    const projectSignalControls = document.querySelectorAll('[data-project-signal-control]');
    if (projectSignalControls.length) {
      import('./ProjectSignal')
        .then(({ default: ProjectSignal }) => {
          projectSignalControls.forEach((control) => {
            if (control.isConnected) projectSignals.push(new ProjectSignal(control));
          });
        })
        .catch((error) => console.error('Failed to load the project signal module:', error));
    }

    const projectShowcaseRoot = document.querySelector('[data-project-showcase]');

    if (projectShowcaseRoot) {
      import('./ProjectShowcase')
        .then(({ default: ProjectShowcase }) => {
          if (projectShowcaseRoot.isConnected) {
            projectShowcase = new ProjectShowcase(projectShowcaseRoot);
          }
        })
        .catch((error) => {
          console.error('Failed to load the ProjectShowcase module:', error);
        });
    }

    if (document.querySelector('.project-figure')) {
      import('./ProjectFigures')
        .then(({ default: ProjectFigures }) => {
          new ProjectFigures();
        })
        .catch((error) => {
          console.error('Failed to load the ProjectFigures module:', error);
        });
    }

    const shuffleRoots = document.querySelectorAll('[data-image-shuffle]');
    if (shuffleRoots.length) {
      import('./ImageShuffle')
        .then(({ default: ImageShuffle }) => {
          shuffleRoots.forEach((root) => {
            if (root.isConnected) {
              imageShuffles.push(new ImageShuffle(root));
            }
          });
        })
        .catch((error) => {
          console.error('Failed to load the ImageShuffle module:', error);
        });
    }
    const projectEntriesRoot = document.querySelector('.projects-block-list');
    if (projectEntriesRoot) {
      import('./ProjectEntries')
        .then(({ default: ProjectEntries }) => {
          if (projectEntriesRoot.isConnected) projectEntries = new ProjectEntries();
        })
        .catch((error) => {
          console.error('Failed to load the ProjectEntries module:', error);
        });
    }
    if (document.querySelector('.links-list')) {
      import('./LinksSigil')
        .then(({ default: LinksSigil }) => {
          new LinksSigil();
        })
        .catch((error) => {
          console.error('Failed to load the LinksSigil module:', error);
        });
    }
    if (document.querySelector('[data-certificate-archive]')) {
      import('./CertificateStack')
        .then(({ default: CertificateStack }) => {
          const archive = document.querySelector(
            '[data-certificate-archive]',
          );
          if (archive?.isConnected) {
            certificateStack?.destroy();
            certificateStack = new CertificateStack(archive);
          }
        })
        .catch((error) => {
          console.error(
            'Failed to load the CertificateStack module:',
            error,
          );
        });
    }
    if (document.querySelector('.contact-form')) {
      import('./ContactForm')
        .then(({ default: ContactForm }) => {
          const contactForm = document.querySelector('.contact-form');
          if (contactForm?.isConnected) {
            new ContactForm(contactForm);
          }
        })
        .catch((error) => {
          console.error('Failed to load the ContactForm module:', error);
        });
    }
    if (document.querySelector('.page-header__bar, .barb-bar')) {
      MatchMediaManager.add(({ conditions }) => {
        const { prefersReducedMotion } = conditions;
        gsap.to('.page-header__bar, .barb-bar', {
          backgroundPositionX: prefersReducedMotion ? 0 : '100%',
          scrollTrigger: {
            target: '.page-header',
            scrub: 1,
          },
        });
      });
    }
    if (document.querySelector('.experience-rows')) {
      import('./ExperienceWaterfall')
        .then(({ default: ExperienceWaterfall }) => {
          new ExperienceWaterfall();
        })
        .catch((error) => {
          console.error('Failed to load the ExperienceWaterfall module:', error);
        });
    }
    if (document.querySelector('[data-tag="currentTime"]')) {
      import('./Clock')
        .then(({ default: Clock }) => {
          const clocks = document.querySelectorAll('[data-tag="currentTime"]');
          clocks.forEach((clockElement) => {
            new Clock(clockElement);
          });
        })
        .catch((error) => {
          console.error('Failed to load the Clock module:', error);
        });
    }
    if (document.querySelector('.project-entry')) {
      import('./utils/linkifyCards')
        .then(({ default: linkifyCards }) => {
          linkifyCards('.project-entry');
        })
        .catch((error) => {
          console.error('Failed to load the Card Linkifier module:', error);
        });
    }
    if (document.querySelector('[data-marquee]')) {
      import('./Marquee')
        .then(({ default: Marquee }) => {
          const marquees = document.querySelectorAll('[data-marquee]');
          marquees.forEach((marqueeElement) => {
            new Marquee(marqueeElement);
          });
        })
        .catch((error) => {
          console.error('Failed to load the Marquee module:', error);
        });
    }
    if (document.querySelector('.footer-border')) {
      import('./FooterShader').then(({ default: FooterShader }) => {
        new FooterShader();
      });
    }
    updateFooterBreadcrumbs();
    syncVinylDock();
  }
  onLeave() {
    destroyVinylPlayer();
    destroyImageShuffles();
    destroyProjectShowcase();
    destroyProjectSignals();
    certificateStack?.destroy();
    certificateStack = null;
    projectEntries?.removeListeners();
    projectEntries = null;
    quoteShuffle?.destroy();
    quoteShuffle = null;
  }
  onLeaveCompleted() {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }
}

const taxi = new Core({
  allowInterruption: true,
  links: 'a[href]:not([target]):not([data-taxi-ignore])',
  renderers: {
    default: DefaultRenderer,
  },
  transitions: {
    default: DefaultTransition,
  },
  reloadJsFilter: (element) =>
    element.dataset.taxiReload !== undefined ||
    element.src.includes('codepen.io'),
});

const loadTransitions = async () => ({
  projectToProjects: (await import('./routes/ProjectToProjects')).default,
  projectToHome: (await import('./routes/ProjectToHome')).default,
  default: DefaultTransition,
  homeToProject: (await import('./routes/HomeToProject')).default,
  homeToProjects: (await import('./routes/HomeToProjects')).default,
  projectsToProject: (await import('./routes/ProjectsToProject')).default,
  projectsToHome: (await import('./routes/ProjectsToHome')).default,
});

(async () => {
  const Transitions = await loadTransitions();
  for (const transitionName in Transitions) {
    taxi.transitions[transitionName] = Transitions[transitionName];
  }
  taxi.addRoute('/', '/projects', 'homeToProjects');
  taxi.addRoute(`\/projects`, '', 'projectsToHome');
  taxi.addRoute(`\/projects`, `\/projects\/.*`, 'projectsToProject');
  taxi.addRoute(`\/projects\/.*`, `\/projects`, 'projectToProjects');
  taxi.addRoute(`/`, `\/projects\/.*`, 'homeToProject');
  taxi.addRoute(`\/projects\/.*`, ``, 'projectToHome');
})();
