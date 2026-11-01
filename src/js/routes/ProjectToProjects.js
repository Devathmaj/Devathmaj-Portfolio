import PageTransition from '../transitions/PageTransition';

import { ProjectsEnterTransition } from '../transitions/Projects';
import { ProjectExitTransition } from '../transitions/Project';

export default class ProjectToProjectsTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: ProjectExitTransition,
      enterTransition: ProjectsEnterTransition,
    });
  }
}
