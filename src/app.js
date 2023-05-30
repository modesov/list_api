import { MainView } from "./views/main/main";

class App {
  #routes = [
    { path: '', view: MainView }
  ]

  appState = {
    favorites: [],
    currentCategory: null,
    currentPage: 1
  };

  constructor() {
    document.addEventListener('hashchange', this.route.bind(this));
    this.route();
  }

  route() {
    // console.log(this); //убрать bind в конструкторе и проверить контекст при hashchange
    if (this.currentView) {
      this.currentView.destroy();
    }

    const view = this.#routes.find(route => route.path === location.hash).view;
    this.currentView = new view(this.appState);
    this.currentView.render();
  }

}

new App();