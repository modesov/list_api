import { BaseComponent } from "../../common/base-component";
import itemCategoryHtml from './item-category.html';
import './item-category.css';

export class ItemCategory extends BaseComponent {
  constructor(name, isActive = false) {
    super('li', 'item-category');
    if (isActive) {
      this.el.classList.add('item-category__active');
    }
    this.name = name;
  }

  render() {
    return this.renderTemplate(itemCategoryHtml({name: this.name}));
  }
}