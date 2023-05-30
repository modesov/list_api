import { BaseComponent } from "../../common/base-component";
import { LIMIT_PER_PAGE } from "../../utils/constants";
import { updateURL } from "../../utils/utils";
import { ItemPagination } from "../item-pagination/item-pagination";
import './pagination.css';

export class Pagination extends BaseComponent {
  constructor(appState, parentState) {
    super('ul', 'pagination')
    this.appState = appState;
    this.parentState = parentState;
  }

  nextHandler() {
    const newOffset = this.parentState.offset + LIMIT_PER_PAGE;
    if (newOffset < this.parentState.count) {
      this.parentState.offset = newOffset;
    }
  }

  previousHandler() {
    let newOffset = this.parentState.offset - LIMIT_PER_PAGE;

    if (newOffset < 0) {
      newOffset = 0;
    }

    this.parentState.offset = newOffset
  }

  paginationHandler(event) {
    const el = event.target;
    if (el.classList.contains('item-pagination__btn')) {
      const id = el.dataset.id;

      if (!isNaN(id)) {
        this.parentState.offset = (+id -1) * LIMIT_PER_PAGE;
      } else if (id === 'next') {
        this.nextHandler();
      } else if (id === 'previous') {
        this.previousHandler();
      }

      const page = (this.parentState.offset / LIMIT_PER_PAGE) + 1;

      updateURL({page: page > 1 ? page : null});

      this.appState.currentPage = page
    }    
  }

  render() {
    this.el.append((new ItemPagination('next', '>>')).render());

    const countPage = Math.ceil(this.parentState.count / LIMIT_PER_PAGE);
    
    console.log(this.appState.currentPage);

    for (let i = 1; i <= countPage; i++ ) {
      this.el.append((new ItemPagination(i, i, this.appState.currentPage === i)).render());
    }

    this.el.append((new ItemPagination('previous', '<<')).render());

    this.el.addEventListener('click', this.paginationHandler.bind(this));
    
    return this.el;
  }
}