export const mockData = {
  '.gitignore': {
    file: {
      contents:
        '# Logs\nlogs\n*.log\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\nlerna-debug.log*\n\nnode_modules\ndist\ndist-ssr\n*.local\n\n# Editor directories and files\n.vscode/*\n!.vscode/extensions.json\n.idea\n.DS_Store\n*.suo\n*.ntvs*\n*.njsproj\n*.sln\n*.sw?\n',
    },
  },
  'README.md': {
    file: {
      contents:
        '# React + Vite\n\nThis template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.\n\nCurrently, two official plugins are available:\n\n- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh\n- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh\n\n## Expanding the ESLint configuration\n\nIf you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.\n',
    },
  },
  'eslint.config.js': {
    file: {
      contents:
        "import js from '@eslint/js'\nimport globals from 'globals'\nimport reactHooks from 'eslint-plugin-react-hooks'\nimport reactRefresh from 'eslint-plugin-react-refresh'\nimport { defineConfig, globalIgnores } from 'eslint/config'\n\nexport default defineConfig([\n  globalIgnores(['dist']),\n  {\n    files: ['**/*.{js,jsx}'],\n    extends: [\n      js.configs.recommended,\n      reactHooks.configs['recommended-latest'],\n      reactRefresh.configs.vite,\n    ],\n    languageOptions: {\n      ecmaVersion: 2020,\n      globals: globals.browser,\n      parserOptions: {\n        ecmaVersion: 'latest',\n        ecmaFeatures: { jsx: true },\n        sourceType: 'module',\n      },\n    },\n    rules: {\n      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],\n    },\n  },\n])\n",
    },
  },
  'index.html': {
    file: {
      contents:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
    },
  },
  'package.json': {
    file: {
      contents:
        '{\n  "name": "000-base",\n  "private": true,\n  "version": "0.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "lint": "eslint .",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^19.2.4",\n    "react-dom": "^19.2.4"\n  },\n  "devDependencies": {\n    "@eslint/js": "^10.0.1",\n    "@types/react": "^19.2.14",\n    "@types/react-dom": "^19.2.3",\n    "@vitejs/plugin-react": "^6.0.1",\n    "eslint": "^10.1.0",\n    "eslint-plugin-react-hooks": "^7.0.1",\n    "eslint-plugin-react-refresh": "^0.5.2",\n    "globals": "^17.4.0",\n    "vite": "^8.0.3"\n  }\n}\n',
    },
  },
  src: {
    directory: {
      'App.jsx': {
        file: {
          contents:
            "// useState aus React importieren — ermöglicht uns, State in Funktionskomponenten zu verwenden\nimport { useState } from 'react';\nimport LightBulb from './components/LightBulb.jsx';\n\n// limit ist eine Konstante außerhalb der Komponente — sie ändert sich nie und löst kein Re-Render aus\nconst limit = 10;\n\nfunction App() {\n  // Erster useState-Aufruf: speichert, ob die Lampe an (true) oder aus (false) ist.\n  // - 'lightSwitch' ist der aktuelle Wert (startet mit false = aus)\n  // - 'setLightSwitch' ist die Funktion, um ihn zu ändern\n  const [lightSwitch, setLightSwitch] = useState(false);\n\n  // Zweiter useState-Aufruf: speichert, wie oft die Lampe eingeschaltet wurde.\n  // Eine Komponente kann beliebig viele useState-Aufrufe haben — jeder verwaltet seinen eigenen Wert.\n  const [count, setCount] = useState(0);\n\n  function handleLightSwitchClick() {\n    // Solange das Limit noch nicht erreicht ist, wird der Schalter umgeschaltet (true ↔ false).\n    // Die Callback-Form ((l) => !l) liest immer den aktuellsten Wert — sicherer als direkt '!lightSwitch'.\n    if (count < limit) {\n      setLightSwitch((l) => !l);\n    } else {\n      // Limit überschritten: Lampe bleibt aus\n      setLightSwitch(false);\n    }\n\n    // Zähler erhöhen, aber nur wenn die Lampe gerade ausgeschaltet ist (also beim Einschalten).\n    // lightSwitch zeigt hier noch den alten Wert — React aktualisiert State erst nach dem Re-Render.\n    if (!lightSwitch) {\n      setCount((c) => c + 1);\n    }\n  }\n\n  return (\n    <div>\n      <h1>React: useState</h1>\n      <button\n        // Wenn count über dem Limit liegt, wird der Button deaktiviert\n        disabled={count > limit}\n        onClick={handleLightSwitchClick}\n        type=\"button\"\n      >\n        {/* Beschriftung wechselt je nach aktuellem State */}\n        {lightSwitch ? 'Switch off' : 'Switch on'}\n      </button>\n      <button\n        onClick={() => {\n          // Reset setzt beide State-Variablen auf ihre Ausgangswerte zurück.\n          // React bündelt diese beiden Änderungen in einem einzigen Re-Render.\n          setCount(0);\n          setLightSwitch(false);\n        }}\n        type=\"button\"\n      >\n        Reset\n      </button>\n      {/* LightBulb bekommt den aktuellen State als Prop übergeben */}\n      <LightBulb lightSwitch={lightSwitch} />\n    </div>\n  );\n}\n\nexport default App;\n",
        },
      },
      components: {
        directory: {
          'LightBulb.jsx': {
            file: {
              contents:
                'const LightBulb = ({ lightSwitch }) => {\n  return (\n    // CSS-Klasse dynamisch einfügen mittels State\n    <div className={`container ${lightSwitch ? \'night\' : \'\'}`}>\n      <div className="bulb-light">\n        <div id="light" />\n        <div id="bulb">\n          <div className="bulb-top">\n            <div className="reflection" />\n          </div>\n          <div className="bulb-middle-1" />\n          <div className="bulb-middle-2" />\n          <div className="bulb-middle-3" />\n          <div className="bulb-bottom" />\n        </div>\n\n        <div id="base">\n          <div className="screw-top" />\n          <div className="screw-a" />\n          <div className="screw-b" />\n          <div className="screw-a" />\n          <div className="screw-b" />\n          <div className="screw-a" />\n          <div className="screw-b" />\n          <div className="screw-c" />\n          <div className="screw-d" />\n        </div>\n      </div>\n    </div>\n  );\n};\n\nexport default LightBulb;\n',
            },
          },
        },
      },
      'index.css': {
        file: {
          contents:
            'body {\n  margin: 0;\n  background: #007398;\n}\n\n.container {\n  padding-top: 5rem;\n  text-align: center;\n  margin: 20px auto;\n}\n\n.bulb-light {\n  position: relative;\n  border: 0;\n  background: transparent;\n  margin: 0 auto !important;\n  padding: 0 !important;\n  cursor: pointer;\n  display: block;\n  z-index: 1;\n}\n\n#light {\n  -moz-opacity: 0;\n  -khtml-opacity: 0;\n  opacity: 0;\n  position: absolute;\n  top: 5px;\n  left: 0;\n  right: 0;\n  box-shadow: 0px 0px 500px rgba(255, 210, 00, 1), inset 0px 0px 500px 90px rgba(255, 210, 00, 0.42);\n  -moz-box-shadow: 0px 0px 500px rgba(255, 210, 00, 1), inset 0px 0px 500px 90px rgba(255, 210, 00, 0.42);\n  -webkit-box-shadow: 0px 0px 500px rgba(255, 210, 00, 1), inset 0px 0px 500px 90px rgba(255, 210, 00, 0.42);\n  -moz-border-radius: 999px;\n  -webkit-border-radius: 999px;\n  -khtml-border-radius: 999px;\n  border-radius: 999px;\n  width: 290px;\n  height: 290px;\n  background: none;\n  margin: 0 auto;\n  text-align: center;\n  z-index: 2;\n}\n\n#bulb {\n  opacity: 1;\n  z-index: 3;\n}\n\n.bulb-top {\n  position: relative;\n  border: 0;\n  width: 300px;\n  height: 300px;\n  margin: 0 auto;\n  padding: 0;\n  -moz-border-radius: 999px;\n  -webkit-border-radius: 999px;\n  -khtml-border-radius: 999px;\n  border-radius: 999px;\n  background: #e7e7e7;\n  box-shadow: inset 0px 10px 15px -5px rgba(10, 30, 60, 0.1);\n  -moz-box-shadow: inset 0px 10px 15px -5px rgba(10, 30, 60, 0.1);\n  -webkit-box-shadow: inset 0px 20px 40px -10px rgba(10, 30, 60, 0.1);\n}\n\n.reflection {\n  position: absolute;\n  top: 50px;\n  left: 50px;\n  background: rgba(255, 255, 255, 0.8);\n  width: 50px;\n  height: 50px;\n  -moz-border-radius: 999px 400px;\n  -webkit-border-radius: 999px 400px;\n  -khtml-border-radius: 999px 400px;\n  border-radius: 999px 400px;\n}\n\n.bulb-middle-1 {\n  margin: -75px auto 0 auto;\n  width: 190px;\n  height: 0;\n  border-left: 35px solid transparent;\n  border-right: 35px solid transparent;\n  border-top: 55px solid #e7e7e7;\n}\n\n.bulb-middle-2 {\n  margin: -22px auto 0 auto;\n  width: 178px;\n  height: 0;\n  border-left: 19px solid transparent;\n  border-right: 19px solid transparent;\n  border-top: 50px solid #e7e7e7;\n}\n\n.bulb-middle-3 {\n  margin: -20px auto 0 auto;\n  width: 182px;\n  height: 0;\n  border-left: 5px solid transparent;\n  border-right: 5px solid transparent;\n  border-top: 30px solid #e7e7e7;\n}\n\n.bulb-bottom {\n  width: 184px;\n  height: 65px;\n  margin: -8px auto 0 auto;\n  padding: 0;\n  -moz-border-radius: 0 0 999px 999px;\n  -webkit-border-radius: 0 0 999px 999px;\n  -khtml-border-radius: 0 0 999px 999px;\n  border-radius: 0 0 999px 999px;\n  background: #e7e7e7;\n  box-shadow: inset 0px -10px 14px -7px rgba(10, 30, 60, 0.1);\n  -moz-box-shadow: inset 0px -10px 14px -7px rgba(10, 30, 60, 0.1);\n  -webkit-box-shadow: inset 0px -10px 14px -7px rgba(10, 30, 60, 0.1);\n}\n\n#base {\n  position: relative;\n  z-index: 2;\n}\n\n.screw-top {\n  margin: -18px auto -4px auto;\n  padding: 0;\n  width: 132px;\n  height: 0;\n  border-left: 15px solid transparent;\n  border-right: 15px solid transparent;\n  border-top: 21px solid #d3d3d3;\n  -moz-border-radius: 999px;\n  -webkit-border-radius: 999px;\n  -khtml-border-radius: 999px;\n  border-radius: 999px;\n}\n\n.screw-a {\n  background: #ddd;\n  width: 150px;\n  height: 15px;\n  -moz-border-radius: 999px;\n  -webkit-border-radius: 999px;\n  -khtml-border-radius: 999px;\n  border-radius: 999px;\n  margin: -1px auto 0px;\n  padding: 0;\n  transform: rotate(-3deg);\n  -ms-transform: rotate(-3deg);\n  -webkit-transform: rotate(-3deg);\n  /*\n  box-shadow: inset 0px -2px 10px 0px rgba(10,30,60,0.2), \n    inset -20px 0px 60px -20px rgba(0,0,0,0.5); \n  -moz-box-shadow: inset 0px -2px 10px 0px rgba(10,30,60,0.2), \n    inset -20px 0px 60px -20px rgba(0,0,0,0.5);  \n  -webkit-box-shadow: inset 0px -2px 10px 0px rgba(10,30,60,0.2), \n    inset -20px 0px 60px -20px rgba(0,0,0,0.5);\n  */\n}\n\n.screw-b {\n  background: #d9d9d9;\n  width: 135px;\n  height: 15px;\n  margin: -1px auto 0px;\n  padding: 0;\n  transform: rotate(-3deg);\n  -ms-transform: rotate(-3deg);\n  -webkit-transform: rotate(-3deg);\n  /*\n  box-shadow: inset -15px 0px 55px -20px rgba(0,0,0,0.5); \n  -moz-box-shadow: inset -15px 0px 55px -20px rgba(0,0,0,0.5);  \n  -webkit-box-shadow: inset -15px 0px 55px -20px rgba(0,0,0,0.5);\n  */\n}\n\n.screw-c2 {\n  background: #ddd;\n  width: 135px;\n  height: 20px;\n  margin: -1px auto 0px;\n  padding: 0;\n  -moz-border-radius: 0 0 999px 999px;\n  -webkit-border-radius: 0 0 999px 999px;\n  -khtml-border-radius: 0 0 999px 999px;\n  border-radius: 0 0 999px 999px;\n  transform: rotate(-3deg);\n  -ms-transform: rotate(-3deg);\n  -webkit-transform: rotate(-3deg);\n}\n\n.screw-c {\n  margin: -1px auto 0px;\n  padding: 0;\n  width: 78px;\n  height: 0;\n  border-left: 30px solid transparent;\n  border-right: 30px solid transparent;\n  border-top: 20px solid #ddd;\n  -moz-border-radius: 8px;\n  -webkit-border-radius: 8px;\n  -khtml-border-radius: 8px;\n  border-radius: 8px;\n  transform: rotate(-3deg);\n  -ms-transform: rotate(-3deg);\n  -webkit-transform: rotate(-3deg);\n}\n\n.screw-d {\n  margin: 0 auto;\n  padding: 0;\n  width: 15px;\n  height: 0;\n  border-left: 30px solid transparent;\n  border-right: 30px solid transparent;\n  border-top: 15px solid #444;\n  transform: rotate(-3deg);\n  -ms-transform: rotate(-3deg);\n  -webkit-transform: rotate(-3deg);\n}\n\n.night #light {\n  -moz-opacity: 1;\n  -khtml-opacity: 1;\n  opacity: 1;\n}\n\nbody,\n.bulb-top,\n.bulb-bottom {\n  -webkit-transition: background 0.5s ease-in-out;\n  -moz-transition: background 0.5s ease-in-out;\n  -o-transition: background 0.5s ease-in-out;\n  transition: background 0.5s ease-in-out;\n}\n\n.bulb-middle-1,\n.bulb-middle-2,\n.bulb-middle-3 {\n  -webkit-transition: border 0.5s ease-in-out;\n  -moz-transition: border 0.5s ease-in-out;\n  -o-transition: border 0.5s ease-in-out;\n  transition: border 0.5s ease-in-out;\n}\n\n.night .bulb-top,\n.night .bulb-bottom {\n  background: #fe3;\n}\n\n.night .bulb-middle-1 {\n  border-top: 55px solid #fe3;\n}\n\n.night .bulb-middle-2 {\n  border-top: 50px solid #fe3;\n}\n\n.night .bulb-middle-3 {\n  border-top: 30px solid #fe3;\n}\n',
        },
      },
      'main.jsx': {
        file: {
          contents:
            "import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport './index.css'\nimport App from './App.jsx'\n\ncreateRoot(document.getElementById('root')).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n)\n",
        },
      },
    },
  },
  'vite.config.js': {
    file: {
      contents:
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\n// https://vite.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n})\n",
    },
  },
};
