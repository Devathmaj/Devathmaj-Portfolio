// Minimal full-screen image preview used by the certificate plates.
export default class CertificateLightbox {
  constructor(root) {
    this.root = root;
    this.dialog = null;
    this.image = null;
    this.closeButton = null;
    this.returnFocus = null;
    this.previousOverflow = null;
  }

  build() {
    if (this.dialog) return;

    const dialog = document.createElement('dialog');
    dialog.className = 'image-lightbox';
    dialog.setAttribute('aria-label', 'Certificate preview');

    const closeButton = document.createElement('button');
    closeButton.className = 'image-lightbox__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close certificate preview');
    closeButton.append('Close');
    const closeMark = document.createElement('span');
    closeMark.setAttribute('aria-hidden', 'true');
    closeMark.textContent = '×';
    closeButton.append(closeMark);
    closeButton.addEventListener('click', () => this.close());

    const image = document.createElement('img');
    image.className = 'image-lightbox__image';
    image.alt = '';
    image.decoding = 'async';

    dialog.append(closeButton, image);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close();
    });
    dialog.addEventListener('close', () => this.restore());

    this.root.append(dialog);
    this.dialog = dialog;
    this.image = image;
    this.closeButton = closeButton;
  }

  open(source, { title = '', returnFocus = null } = {}) {
    this.build();
    if (this.dialog.open) return;

    const src = source.currentSrc || source.src;
    if (!src) return;

    this.image.src = src;
    this.image.alt = title ? `${title} certificate` : 'Certificate';
    const width = source.getAttribute('width');
    const height = source.getAttribute('height');
    if (width) this.image.setAttribute('width', width);
    if (height) this.image.setAttribute('height', height);

    this.dialog.setAttribute(
      'aria-label',
      title ? `Certificate preview: ${title}` : 'Certificate preview',
    );
    this.returnFocus = returnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    this.previousOverflow = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    this.dialog.showModal();
    this.closeButton.focus({ preventScroll: true });
  }

  close() {
    if (this.dialog?.open) this.dialog.close();
  }

  restore() {
    if (this.previousOverflow) {
      document.documentElement.style.overflow = this.previousOverflow.html;
      document.body.style.overflow = this.previousOverflow.body;
      this.previousOverflow = null;
    }

    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }

  destroy() {
    this.close();
    // Do not rely on the queued `close` event: restore immediately so a page
    // transition can never leave the document scroll-locked.
    this.restore();
    this.dialog?.remove();
    this.dialog = null;
    this.image = null;
    this.closeButton = null;
  }
}
