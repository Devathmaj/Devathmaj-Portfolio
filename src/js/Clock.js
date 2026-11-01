export default class Clock {
  constructor(el) {
    this.el = el;
    this.init();
  }
  init() {
    this.updateTime();
    setInterval(this.updateTime.bind(this), 20000);
  }
  updateTime() {
    const time = this.time;
    this.el.innerHTML = time;
  }
  get time() {
    const timeZone = this.el.dataset.clockTimezone;

    if (this.el.dataset.clockFormat === 'date-time') {
      return `${new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...(timeZone ? { timeZone } : {}),
      })} UTC`;
    }

    return new Date().toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      ...(timeZone ? { timeZone } : {}),
    });
  }
}
