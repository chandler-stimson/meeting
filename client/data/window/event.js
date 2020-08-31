class Event {
  constructor() {
    this.callbacks = [];
  }
  addListener(c) {
    this.callbacks.push(c);
  }
  emit(...args) {
    for (const c of this.callbacks) {
      c(...args);
    }
  }
}
