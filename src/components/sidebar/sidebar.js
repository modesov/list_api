import onChange from "on-change";
import { BaseComponent } from "../../common/base-component";
import sidebarHtml from './sidebar.html';
import './sidebar.css';
import { Loading } from "../loading/loading";
import { ItemCategory } from "../item-category/item-category";
import { getParams, updateURL } from "../../utils/utils";

export class Sidebar extends BaseComponent {
  state = {
    loading: false,
    categories: []
  }

  constructor(appState) {
    super('aside', 'sidebar');
    this.state = onChange(this.state, this.stateHook.bind(this));
    this.appState = appState;
    this.loadDataCategories();
  }

  async loadDataCategories() {
    this.state.loading = true;
    const categories = await this.loadCategories();
    this.state.loading = false;
    this.state.categories = categories.categories;
  }

  async loadCategories() {
    const result = await fetch('https://api.publicapis.org/categories');
    return result.json();
  }

  stateHook(path) {
    if (path === 'categories') {
      if (this.state.categories.length) {
        let category = getParams().category;

        if (category) {
          category = decodeURI(category.trim());
          const currentCategory = this.state.categories.find(el => el.toLowerCase().includes(category));
          this.appState.currentCategory = currentCategory ? currentCategory : null;
        } else {
          this.appState.currentCategory = null;
        }
      }

      this.render();
    }    
  }

  categoryHandler(event) {
    const el = event.target;
    if (el.classList.contains('item-category__btn')) {
      const category = el.innerText !== 'All' ? el.innerText : null;
      const params = {category: category?.split(' &')[0].toLowerCase(), page: null}
      updateURL(params);

      this.appState.currentCategory = category;
      this.appState.currentPage = 1;
    }
  }

  render() {
    if (this.state.loading) {
      this.el.innerHTML = '';
      this.el.append((new Loading).render());
      return this.el;
    }

    this.renderTemplate(sidebarHtml({}));
    const categoryList = this.el.querySelector('.sidebar__list');

    categoryList.append((new ItemCategory('All', !this.appState.currentCategory)).render());
    
    for(const category of this.state.categories) {
      categoryList.append((new ItemCategory(category, this.appState.currentCategory === category)).render());
    }

    categoryList.addEventListener('click', this.categoryHandler.bind(this));

    return this.el;
  }
}