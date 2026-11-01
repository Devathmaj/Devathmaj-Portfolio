import PageTransition from '../transitions/PageTransition';

import { ProjectExitTransition } from '../transitions/Project';
import { HomeEntranceTransition } from '../transitions/Home';

export default class ProjectToHomeTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: ProjectExitTransition,
      enterTransition: HomeEntranceTransition,
    });
  }
}
