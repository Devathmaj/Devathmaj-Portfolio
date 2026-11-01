import PageTransition from '../transitions/PageTransition';

import { ProjectsExitTransition } from '../transitions/Projects';
import { HomeEntranceTransition } from '../transitions/Home';

export default class ProjectsToHomeTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: ProjectsExitTransition,
      enterTransition: HomeEntranceTransition,
    });
  }
}
