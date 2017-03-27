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
    });
  }
}

export const AnnotatableText = observer(class AnnotatableText extends Component {
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

let allStates = M.observable({});
function getStateFor(page, which, text) {
  let name = `${page}-${which}`;
  if (!allStates[name])
    allStates[name] = new State(text);
  return allStates[name];
}

class RatingOutput {
  constructor() {
    M.extendObservable(this, {
      data: new M.ObservableMap(),
    });
  }
}

let ratings = new RatingOutput();
window.ratings = ratings;

export const App = observer(class App extends Component {
  state = {pageNum: 0, consented: false};

  render() {
    let {data} = this.props;
    let {pages, attrs} = data;
    let {pageNum, consented} = this.state;
    let [textA, textB] = pages[pageNum];

    if (!consented) {
      return <Consent onConsented={() => {this.setState({consented: true});}} />;
    }

    return <div className="App">
      <h1>Instructions</h1>
      <ol>
        <li><b>Read</b> the two texts below. </li>
        <li><b>Highlight</b> all <em>factual details</em> that each text gives by <b>selecting a few words with your mouse</b>. (Click any highlight to remove it.)</li>
        <li><b>Rate</b> the two reviews according to the rubric below.</li>
      </ol>


      <div className="reviews">
        <div>A<AnnotatableText state={getStateFor(pageNum, 0, textA.text)} /></div>
        <div>B<AnnotatableText state={getStateFor(pageNum, 1, textB.text)} /></div>
      </div>

      <div>Which of these two has more detail about the...</div>

      <table className="ratings-table">
        <thead><tr><th></th><th>A</th><th>neither one does</th><th>B</th></tr></thead>
        <tbody>
          {attrs.map((attr, i) => <tr key={attr}>
            <td>{attr}</td>
            {['A', 'neither', 'B'].map(x => <td key={x}>
              <input type="radio" name={`${i}-A`}
                checked={ratings.data.get(`${attr}-${pageNum}`) === x}
                onChange={() => {console.log(attr, x); ratings.data.set(`${attr}-${pageNum}`, x);}} />
            </td>)}</tr>)}
        </tbody>
      </table>

      <div>
        <button onClick={(evt) => {this.setState({pageNum: pageNum - 1}); evt.preventDefault();}} disabled={pageNum===0}>Prev</button>
        Comparison {pageNum + 1} of {pages.length}
        {pageNum===pages.length - 1
         ? <div>Last one! See below.</div>
         : <button onClick={(evt) => {this.setState({pageNum: pageNum + 1}); evt.preventDefault();}}>Next</button>}
      </div>

      <input type="hidden" readOnly={true} name="results" value={JSON.stringify({highlights: allStates, ratings: ratings.data})} />

      <div style={{display: pageNum === pages.length - 1 ? 'block' : 'none'}}>
        <p>We&#39;re just developing this HIT, so we&#39;d appreciate your feedback: are the instructions clear? Is the payment fair? Did it feel too long or short? Any technical difficulties? Anything else?</p>
        <textarea cols="80" name="feedback" placeholder="optional feedback" rows="4"></textarea>
      </div>
    </div>;
  }
});

export default App;
