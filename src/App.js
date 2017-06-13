import React, { Component } from 'react';
import M from 'mobx';
import {observer} from 'mobx-react';
const d3 = require('d3');//import d3 from 'd3';
window.d3 = d3;

import Consent from './Consent';
import {addFormatting} from './styledRanges';

// var colors = d3.schemeCategory10; //['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

export class State {
  constructor(text) {
    M.extendObservable(this, {
      text: text,
      annotations: [],
      curTool: 'pos'
    });
  }
}

function toolColor(tool) {
  return {
    pos: '#ccff00',
    neg: 'red',
    fact: null
  }[tool];
}


function simplifyAnnotations(text, annotations) {
  let annotated = [{text, style: {}}];
  function joinStyle(prev, cur) {
    return {...prev, ...cur}; // let the later annotation override.
  }
  annotations.forEach((annotation) => {
    let {range, tool} = annotation;
    let [start, end] = range;
    annotated = addFormatting(annotated, start, end, {tool}, joinStyle);
  });
  let simplified = [], offset = 0;
  annotated.forEach(({text, style}) => {
    let {tool} = style;
    let thisEnd = offset + text.length;
    if (tool && tool !== 'fact') {
      if (simplified.length && simplified[simplified.length - 1].tool === tool && simplified[simplified.length-1].range[1] === offset) {
        // just merge.
        simplified[simplified.length-1].range[1] = thisEnd;
      } else {
        simplified.push({range: [offset, thisEnd], tool: tool});
      }
    }
    offset += text.length;
  });
  return simplified;
}

let interlockClick = 0;

export const AnnotatableText = observer(class AnnotatableText extends Component {
  onMouseUp = (evt) => {
    let {state} = this.props;
    var range = window.getSelection().getRangeAt(0);
    var startTextOffset = +range.startContainer.parentNode.getAttribute('data-offset') + range.startOffset;
    var endTextOffset = +range.endContainer.parentNode.getAttribute('data-offset') + range.endOffset;
    if (startTextOffset === endTextOffset) return;
    state.annotations.push({range: [startTextOffset, endTextOffset], tool: state.curTool});
    state.annotations = simplifyAnnotations(state.text, state.annotations);
    window.getSelection().removeAllRanges();
    interlockClick = +new Date();
  };

  onClickAnnotation(annotations) {
    if (+new Date() - interlockClick < 100) return;
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
      if (prev.annotations && cur.annotations) {
        res.annotations = prev.annotations.concat(cur.annotations);
      }
      return res;
    }
    state.annotations.forEach(function(annotation, i) {
        let [start, end] = annotation.range;
        let {tool} = annotation;
        annotated = addFormatting(annotated, start, end, {color: toolColor(tool), annotations: [annotation]}, joinStyle);
      });
    // if (state.annotations.length > 0) debugger
    let offset = 0;
    return <div className="annotated-text" onMouseUp={this.onMouseUp}>{
      annotated.map(({text, style}, i) => <span
        key={i} style={{background: style.color}} data-offset={(offset += text.length) - text.length} onClick={this.onClickAnnotation.bind(this, style.annotations)}>
        {text}
        </span>)
    }</div>;
  }
});

let allStates = M.observable([]);

export const init = data => {
  data.forEach(datum => {
    allStates.push(new State(datum.finalText));
  });
}

const Annotator = observer(class Annotator extends Component {
  render() {
    let {idx} = this.props;
    let state = allStates[idx];
    return <div className="TextBlock">
      <div className="tools">{['pos', 'neg', 'fact'].map(tool =>
        <button
          key={tool} className={tool === state.curTool ? 'cur' : ''}
          onClick={evt => {state.curTool = tool;}}
        >{tool}</button>)}</div>
      <AnnotatableText state={state} />
    </div>;
  }
});


export const App = observer(class App extends Component {
  state = {consented: true};

  render() {
    let {data} = this.props;
    let {consented} = this.state;

    if (!consented) {
      return <Consent onConsented={() => {
          this.setState({consented: true});
          setTimeout(() => {window.scrollTo(0, 0);}, 100);
        }} />;
    }


    return <div className="App">
      <div style={{background: 'yellow', boxShadow: '1px 1px 4px grey', padding: '5px'}}>
      <h1>Instructions</h1>
      <p><b>If you've done one of these before</b>, skim the texts to make sure you're not rating the same text twice. If so, try another HIT from this group.</p>
      </div>

      <div className="TextBlocks">{data.map((datum, idx) => <Annotator key={idx} idx={idx} datum={datum} />)}</div>

      <br/><br/>

      <input type="hidden" readOnly={true} name="results" value={JSON.stringify({allStates})} />
    </div>;
  }
});

export default App;
window.allStates = allStates;
