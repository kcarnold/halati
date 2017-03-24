import React from 'react';
import ReactDOM from 'react-dom';
import {App, State} from './App';

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap/dist/css/bootstrap-theme.css';

Array.from(document.querySelectorAll('.textToAnnotate')).forEach((elt) => {
  let outputNode = document.createElement('input');
  document.querySelector('#outputs').appendChild(outputNode);
  let state = new State(elt.textContent, annotations => {
      outputNode.value = JSON.stringify(annotations);
  });
  ReactDOM.render(
    <App state={state} />,
    elt
  );
});

