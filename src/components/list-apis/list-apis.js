import { BaseComponent } from "../../common/base-component";
import { LIMIT_PER_PAGE } from "../../utils/constants";
import { translate } from "../../utils/utils";
import { CardApi } from "../card-api/card-api";
import { Loading } from "../loading/loading";
import './list-apis.css';

export class ListApis extends BaseComponent {
  constructor(appState, parentState) {
    super('div', 'list-apis');
    this.appState = appState;
    this.parentState = parentState;
    this.items = [];
  }

  async trans(item) {
    if (item.DescriptionRu) {
      return;
    }

    return await translate(item.Description);
  }

  render() {
    if (this.parentState.loading) {
      this.el.append((new Loading).render());
      return this.el;
    }

    const header = document.createElement('h1');
    header.innerText = this.appState.currentCategory ? `Api категории ${this.appState.currentCategory}` : 'Все api';
    this.el.append(header);

    const listElements = document.createElement('ul');
    listElements.classList.add('list-apis__list');
    
    if (!this.items.length) {
      const items = this.parentState.list?.slice(this.parentState.offset, this.parentState.offset + LIMIT_PER_PAGE);
      this.items = items ? items : [];
    }

    let i = 1 + this.parentState.offset;
    for(const item of this.items) {
      this.trans(item).then(data => {
        if (data?.sentences[0]?.trans) {
          item.DescriptionRu = data.sentences[0].trans;
        }
  
        listElements?.append((new CardApi(item, i)).render());
        i++;
      });      
    }

    this.el.append(listElements);
    return this.el;
  }
}
