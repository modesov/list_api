import { BaseComponent } from "../../common/base-component";
import headerHtml from './header.html';
import './header.css';

export class Header extends BaseComponent {
  constructor(appState) {
    super('header', 'header');
    this.appState = appState;
  }

  render() {
    return this.renderTemplate(headerHtml({}));
  }
}