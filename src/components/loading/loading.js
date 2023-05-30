import { BaseComponent } from "../../common/base-component";
import loadingHtml from './loading.html';
import './loading.css';

export class Loading extends BaseComponent {
  constructor() {
    super('div', 'loading');
  }
  
  render() {
      return this.renderTemplate(loadingHtml({}));
  }
}