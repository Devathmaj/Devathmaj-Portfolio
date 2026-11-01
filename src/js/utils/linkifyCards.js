const linkifyCards = (selector) => {
  const cards = document.querySelectorAll(selector);
  cards.forEach((card) => {
    let downTime;

    const link = card.querySelector('a');
    if (link) {
      card.classList.add('project-entry--clickable');

      card.addEventListener('mousedown', () => {
        downTime = Date.now();
      });

      card.addEventListener('mouseup', () => {
        const upTime = Date.now();
        if (upTime - downTime < 200) {
          link.click();
        }
      });
    }
  });
};
export default linkifyCards;
