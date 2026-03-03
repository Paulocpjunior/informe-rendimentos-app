const React = require('react');
const ReactDOMServer = require('react-dom/server');
require('@babel/register')({
  presets: ['@babel/preset-env', ['@babel/preset-react', {runtime: 'automatic'}]]
});
const App = require('./src/App.js').default;
console.log(ReactDOMServer.renderToString(React.createElement(App)));
