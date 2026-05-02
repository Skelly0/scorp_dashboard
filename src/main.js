import App from './App.svelte';
import './styles/global.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
