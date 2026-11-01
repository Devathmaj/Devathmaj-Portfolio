import PageTransition from '../transitions/PageTransition';
import { ProjectsEnterTransition } from '../transitions/Projects';
import { HomeExitTransition } from '../transitions/Home';

export default class HomeToProjectsTransition extends PageTransition {
  constructor({ wrapper }) {
    super({
      wrapper,
      exitTransition: HomeExitTransition,
      enterTransition: ProjectsEnterTransition,
    });
  }
}
