export const convertSplitElIntoLines = (el) => {
  const words = el.querySelectorAll('.word');
  if (!words.length) return el.innerHTML;

  const lines = [];
  words.forEach((word) => {
    const lineIndex = getComputedStyle(word).getPropertyValue('--line-index');
    if (lines[lineIndex]) {
      lines[lineIndex].push(word);
    } else {
      lines[lineIndex] = [];
      lines[lineIndex].push(word);
    }
  });

  return lines
    .map((line) => {
      return `<div class="line">${line
        .map((word) => {
          return word.outerHTML;
        })
        .join(' ')}</div>`;
    })
    .join(' ');
};
