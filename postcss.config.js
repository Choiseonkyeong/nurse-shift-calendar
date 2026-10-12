import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import fontScale from './postcss.fontScale.js';

export default {
  plugins: [tailwindcss(), fontScale(), autoprefixer()]
};
