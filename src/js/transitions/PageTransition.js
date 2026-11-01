import { Transition } from '@unseenco/taxi';
import gsap from 'gsap';

export default class PageTransition extends Transition {
  constructor({ wrapper, exitTransition, enterTransition }) {
    super({ wrapper });
    this.exitTransition = exitTransition;
    this.enterTransition = enterTransition;
  }

  onLeave({ from, done }) {
    const tl = gsap.timeline({ paused: true });
    let finished = false;
    let handlePopstate;
    const finish = () => {
      if (finished) return;
      finished = true;
      removeEventListener('popstate', handlePopstate);
      done();
    };
    handlePopstate = () => {
      tl.seek(tl.endTime());
      finish();
    };
    tl.eventCallback('onComplete', finish);
    addEventListener('popstate', handlePopstate);
    tl.add(this.exitTransition(from, window.mediaQueries));
    tl.play();
  }

  onEnter({ to, done }) {
    const tl = gsap.timeline({ paused: true });
    let finished = false;
    let handlePopstate;
    const finish = () => {
      if (finished) return;
      finished = true;
      removeEventListener('popstate', handlePopstate);
      done();
    };
    handlePopstate = () => {
      tl.seek(tl.endTime());
      finish();
    };
    tl.eventCallback('onComplete', finish);
    addEventListener('popstate', handlePopstate);
    tl.add(this.enterTransition(to, window.mediaQueries));
    tl.play();
  }
}
