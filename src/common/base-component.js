export class BaseComponent {
  constructor(tagName, className = null) {
    this.el = document.createElement(tagName);
    
    if (className) {
      this.el.classList.add(className);
    }
  }

  render() {
    return this.renderTemplate();
  }

  renderTemplate(html = '') {
    this.el.innerHTML = html;
    return this.el;
  }
}