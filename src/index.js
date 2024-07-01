import React from 'react';
import ReactDOM from 'react-dom';
import App, {init} from './App';
import data from './sample_yelp_sentences_to_annotate.json';

// let dataRaw = document.getElementById('data').textContent;
// let data = JSON.parse(dataRaw);
init(data);

ReactDOM.render(
  <App data={data} />,
  document.getElementById('root')
);

