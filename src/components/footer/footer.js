import { BaseComponent } from "../../common/base-component";
import footerHtml from './footer.html';
import './footer.css';

export class Footer extends BaseComponent {
  constructor(appState) {
    super('footer', 'footer');
    this.appState = appState;
  }

  render() {
    return this.renderTemplate(footerHtml({}))
  }
}