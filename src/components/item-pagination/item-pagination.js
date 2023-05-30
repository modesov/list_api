import { BaseComponent } from "../../common/base-component";
import itemPaginationHtml from './item-pagination.html';
import './item-pagination.css';

export class ItemPagination extends BaseComponent {
  constructor(id, name, isActive = false) {
    super('li', 'item-pagination');
    if (isActive) {
      this.el.classList.add('item-pagination__active');
    }
    this.name = name;
    this.id = id;
  }

  render() {
    return this.renderTemplate(itemPaginationHtml({ name: this.name, id: this.id }))
  }
}