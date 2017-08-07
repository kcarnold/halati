import React from 'react';
import ReactDOM from 'react-dom';
import App, {init} from './App';

let data = JSON.parse(document.getElementById('data').textContent);
init(data);

ReactDOM.render(
  <App data={data} />,
  document.getElementById('root')
);

