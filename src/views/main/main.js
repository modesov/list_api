import onChange from "on-change";
import { AbstractView } from "../../common/view.js";
import { ListApis } from "../../components/list-apis/list-apis.js";
import { Pagination } from "../../components/pagination/pagination.js";
import { LIMIT_PER_PAGE } from "../../utils/constants.js";
import './main.css';
import { getParams, paramsToString, updateURL } from "../../utils/utils.js";

export class MainView extends AbstractView {
  state = {
    list: [],
    loading: false,
    offset:  0,
    count: 0
  };

  constructor(appState) {
    super(appState, 'Список api');
    this.state = onChange(this.state, this.stateHook.bind(this));
    this.loadDataApis();
  }

  async loadDataApis() {
    this.state.loading = true;
    const data = await this.loadListApis();
    this.state.loading = false;
    this.state.count = data.count;
    this.state.list = data.entries;
    
    let page = getParams().page;
    if (page <= 1) {
      updateURL({page: null});
      page = 1;
    }
    const countPage = Math.ceil(this.state.count / LIMIT_PER_PAGE);
    if (page > countPage) {
      page = countPage;
      updateURL({page: page});
    }

    this.appState.currentPage = page ? Number(page) : 1;
  }

  async loadListApis() {
    const param = paramsToString(getParams(), ['title', 'description', 'auth', 'https', 'cors', 'category']);
    const result = await fetch(`https://api.publicapis.org/entries${param}`);
    return result.json();
  }

  appStateHook(path) {
    if (path === 'currentCategory') {
      this.loadDataApis();
    }

    if (path === 'currentPage') {
      this.state.offset = this.appState.currentPage ? (this.appState.currentPage - 1) * LIMIT_PER_PAGE : 0;
    }
    
    this.render();
  }

  stateHook(path) {
    if (['list', 'offset'].includes(path)) {
      this.render();
    }    
  }

  createEl() {
    const main = document.createElement('main');
    main.classList.add('mainContainer');
    main.append((new ListApis(this.appState, this.state)).render());
    if (this.state.count > LIMIT_PER_PAGE && !this.state.loading) {
      main.append((new Pagination(this.appState, this.state)).render());
    }
    return main;    
  }
}