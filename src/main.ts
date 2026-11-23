import { createApp } from 'vue';
import App from './App.vue';
import { applyGameTextureDefaults } from './renderer';
import { isDebugMode, type IRegistrySnapshot } from './services';
import { registrySnapshot } from './store';
import './styles/main.css';

declare global {
    interface Window {
        fontViewerDebug?: { snapshot: () => IRegistrySnapshot };
    }
}

applyGameTextureDefaults();

if (isDebugMode()) {
    window.fontViewerDebug = { snapshot: registrySnapshot };
}

createApp(App).mount('#app');
