import { BaseComponent } from "../../common/base-component";
import CardApiHtml from './card-api.html';
import './card-api.css'
export class CardApi extends BaseComponent {
  constructor(item, index) {
    super('li', 'card-api');
    this.item = { ...item, index: index };

    this.item.HTTPS = this.item.HTTPS ? 'yes' : 'no'; 
    this.item.Auth = this.item.Auth ? this.item.Auth : 'no'; 
  }

  render() {
    return this.renderTemplate(CardApiHtml({ ...this.item }));
  }
}