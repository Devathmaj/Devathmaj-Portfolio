export default class ProjectEntries {
  constructor() {
    this.getCrownComposite();
    this.getCollarComposite();

    this.handleResize = this.handleResize.bind(this);
    this.addListeners();
  }
  getCrownComposite() {
    const projectEntries = document.querySelectorAll(
      '.list-design-element:is(:nth-of-type(2), :nth-of-type(3), :nth-of-type(4))'
    );
    let compositeHeight = 0;
    projectEntries.forEach((block) => {
      const height = block.getBoundingClientRect().height;
      compositeHeight += height;
    });
    document
      .querySelector('.projects-block-list')
      .style.setProperty('--crown-height', `${compositeHeight}px`);
  }
  getCollarComposite() {
    const projectEntries = document.querySelectorAll(
      '.list-design-element:is(:nth-of-type(6), :nth-of-type(7))'
    );
    let compositeWidth = 0;

    projectEntries.forEach((block) => {
      const height = block.getBoundingClientRect().width;
      compositeWidth += height;
    });
    document
      .querySelector('.projects-block-list')
      .style.setProperty('--collar-width', `${compositeWidth}px`);
  }
  handleResize() {
    this.getCrownComposite();
    this.getCollarComposite();
  }
  removeListeners() {
    window.removeEventListener('resize', this.handleResize);
  }
  addListeners() {
    window.addEventListener('resize', this.handleResize, false);
  }
}
