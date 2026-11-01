export default class ProjectFigures {
  constructor() {
    this.figures = [...document.querySelectorAll('.project-figure')];
    this.observe();
  }

  observe() {
    this.figures.forEach((figure) => {
      const image = figure.querySelector('img');
      if (!image) return;

      if (image.complete && image.naturalWidth) {
        this.classify(figure, image);
        return;
      }

      image.addEventListener(
        'load',
        () => this.classify(figure, image),
        { once: true }
      );
    });
  }

  classify(figure, image) {
    if (!image.naturalWidth || !image.naturalHeight) return;

    const ratio = image.naturalWidth / image.naturalHeight;
    figure.classList.toggle('project-figure--portrait', ratio < 0.95);
  }
}
