class VideoView extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: 'open'
    });
    shadow.innerHTML = `
      <style>
        :host {
          position: relative;
          overflow: hidden;
          display: flex;
        }
        ::slotted(video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .button {
          background-color: rgba(128, 128, 128, 0.5);
          border-radius: 50%;
          padding: 10px;
          opacity: 0;
          fill: #fff;
          cursor: pointer;
        }
        :host(:hover) .button {
          opacity: 0.5;
        }
        .button:hover {
          opacity: 1 !important;
        }
        #close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 24px;
          z-index: 1;
        }
        :host(:not([controls*="close"])) #close {
          display: none;
        }
        #toolbar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          position: absolute;
          left: 0;
          bottom: 0;
          padding: 20px 0;
          z-index: 1;
        }
        #mute {
          width: 24px;
        }
        :host([data-muted=true]) #mute {
          fill: red;
        }
        :host(:not([controls*="mute"])) #mute {
          display: none;
        }
      </style>
      <div style="width: 100%; height: 100%;">
        <slot></slot>
        <svg id="close" class="button" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <polygon points="28.71 4.71 27.29 3.29 16 14.59 4.71 3.29 3.29 4.71 14.59 16 3.29 27.29 4.71 28.71 16 17.41 27.29 28.71 28.71 27.29 17.41 16 28.71 4.71"/>
        </svg>
        <div id="toolbar">
          <svg id="mute" class="button" viewBox="0 0 896 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M128 384H0v256h128l256 192h64V192h-64L128 384zM864 416l-64-64-96 96-96-96-63 63.5 95 96.5-96 96 64 64 96-96 96 96 64-64-96-96L864 416z"/>
          </svg>
        </div>
      </div>
    `;
    this.onCloseRequested = new Event();
  }
  connectedCallback() {
    this.shadowRoot.getElementById('close').addEventListener('click', () => {
      this.onCloseRequested.emit();
    });
    this.shadowRoot.getElementById('mute').addEventListener('click', () => {
      const v = this.querySelector('video');
      v.muted = v.muted === false;
      this.dataset.muted = v.muted;
    });
    // remove the entire element if video element is removed
    this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => {
      const v = this.querySelector('video');
      if (!v) {
        this.remove();
      }
    });
  }
  set(video) {
    this.appendChild(video);
  }
  set srcObject(o) {
    this.querySelector('video').srcObject = o;
  }
  play() {
    this.querySelector('video').play();
  }
  set onloadedmetadata(c) {
    this.querySelector('video').onloadedmetadata = c;
  }
}
window.customElements.define('video-view', VideoView);
