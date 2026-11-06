
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  // The GitHub Pages workflow sets VITE_BASE_PATH to /Index00/.
  // Local development stays at /.
  base: process.env.VITE_BASE_PATH || '/',
  server:{host:'0.0.0.0',port:5173,strictPort:true,
    proxy:{'/api':'http://localhost:3001'}},
  build:{target:'es2022',cssCodeSplit:true}
});
