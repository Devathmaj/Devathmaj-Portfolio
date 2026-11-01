import PageTransition from '../transitions/PageTransition';

import { ProjectsExitToProjectTransition } from '../transitions/Projects';
import { ProjectEntryTransition } from '../transitions/Project';

export default class ProjectsToProjectTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: ProjectsExitToProjectTransition,
      enterTransition: ProjectEntryTransition,
    });
  }
}
