import { BaseComponent } from "../../common/base-component";
import FilterHtml from './filter.html';
import './filter.css';

export class Filter extends BaseComponent {
  constructor(parentState) {
    super('div', 'filter');
    this.parentState = parentState;
  }  

  handleFilter(event) {
    this.parentState.filter[event.target.name] = event.target.value;
  }

  render() {
    this.renderTemplate(FilterHtml({}));

    const selectedAuth = this.parentState.filter.auth;
    const selectedCors = this.parentState.filter.cors;
    const selectedHttps = this.parentState.filter.https;

    if (selectedAuth) {
      const elAuth = this.el.querySelector(`#auth_select option[value=${selectedAuth}]`);
      if (elAuth) {
        elAuth.selected = true;
      }
    }
    
    if (selectedCors) {
      const elCors = this.el.querySelector(`#cors_select option[value=${selectedCors}]`);

      if (elCors) {
        elCors.selected = true;
      }
    }

    if (selectedHttps) {
      const elHttps = this.el.querySelector(`#https_select option[value=${selectedHttps}]`);
      
      if (elHttps) {
        elHttps.selected = true;
      }
    }

    
    this.el.querySelector('.filter__form').addEventListener('input', this.handleFilter.bind(this));
    return this.el;
  }
}