import onChange from "on-change";
import { Header } from "../components/header/header";
import { Footer } from "../components/footer/footer";
import { Sidebar } from "../components/sidebar/sidebar";

export class AbstractView {
  constructor(appState, title) {
    this.app = document.getElementById('root');
    this.appState = appState;
    this.appState = onChange(this.appState, this.appStateHook.bind(this));
    this.header = this.getHeader();
    this.sidebar = this.getSidebar();
    this.footer = this.getFooter();
    this.setTitle(title);
  }

  appStateHook() {
    this.render();
  }

  setTitle(title) {
    document.title = title;
  }

  createEl() {
    return null;
  }

  render() {
    this.app.innerHTML = '';

    const wrapperBox = document.createElement('div');
    wrapperBox.classList.add('wrapper-box');

    if (this.header) {
      wrapperBox.append(this.header.render());
    }

    if (this.sidebar) {
      wrapperBox.append(this.sidebar.render());
    }    

    wrapperBox.append(this.createEl());
    
    if (this.footer) {
      wrapperBox.append(this.footer.render());
    }

    this.app.append(wrapperBox);
  }

  getHeader() {
    return new Header(this.appState);
  }

  getFooter() {
    return new Footer(this.appState);
  }

  getSidebar() {
    return new Sidebar(this.appState);
  }

  destroy() {
    return;
  }
}