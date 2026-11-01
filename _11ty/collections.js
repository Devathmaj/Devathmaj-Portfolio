export const collectionHostedProject = (collectionsApi) => {
  return collectionsApi.getFilteredByTag('project').filter((el) => {
    return el.page.outputPath;
  });
};
