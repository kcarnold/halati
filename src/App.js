import React, { Component } from 'react';
import M from 'mobx';
import {observer} from 'mobx-react';
const d3 = require('d3');//import d3 from 'd3';
window.d3 = d3;

import {addFormatting} from './styledRanges';

var colors = d3.schemeCategory10; //['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3


export class State {
  constructor(text, changeCallback) {
    M.extendObservable(this, {
      text: text,
      annotations: [],
    });

    M.autorun(() => {
      changeCallback(this.annotations);
    })
  }
}

export const App = observer(class App extends Component {
  onMouseUp = (evt) => {
    let {state} = this.props;
    var range = window.getSelection().getRangeAt(0);
    var startTextOffset = +range.startContainer.parentNode.getAttribute('data-offset') + range.startOffset;
    var endTextOffset = +range.endContainer.parentNode.getAttribute('data-offset') + range.endOffset;
    if (startTextOffset === endTextOffset) return;
    state.annotations.push({range: [startTextOffset, endTextOffset]});
    window.getSelection().removeAllRanges();
  };

  onClickAnnotation(annotations) {
    if (!annotations)
      return;
    let {state} = this.props;
    let idx = state.annotations.indexOf(annotations[0]);
    console.assert(idx !== -1);
    state.annotations.splice(idx, 1);
  }

  render() {
    let {state} = this.props;
    var annotated = [{text: state.text, style: {}}];
    function joinStyle(prev, cur) {
      let res = {...prev, ...cur};
      if (prev.color && cur.color) {
        res.color = d3.interpolateCubehelix(prev.color, cur.color)(.5);
      }
      if (prev.annotations && cur.annotations) {
        res.annotations = prev.annotations.concat(cur.annotations);
      }
      return res;
    }
    state.annotations.forEach(function(annotation, i) {
        let [start, end] = annotation.range;
        annotated = addFormatting(annotated, start, end, {color: '#ccff00', annotations: [annotation]}, joinStyle);
      });
    let offset = 0;
    return <div className="annotated-text" onMouseUp={this.onMouseUp}>{
      annotated.map(({text, style}, i) => <span
        key={i} style={{background: style.color}} data-offset={(offset += text.length) - text.length} onClick={this.onClickAnnotation.bind(this, style.annotations)}>
        {text}
        </span>)
    }</div>;
  }
});

export default App;
