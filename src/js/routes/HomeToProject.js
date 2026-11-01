import PageTransition from '../transitions/PageTransition';

import { DefaultFadeOut } from '../transitions/Fade';
import { ProjectEntryTransition } from '../transitions/Project';

export default class HomeToArticleTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: DefaultFadeOut,
      enterTransition: ProjectEntryTransition,
    });
  }
}
