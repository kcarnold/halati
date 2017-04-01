import React, { Component } from 'react';
import M from 'mobx';
import {observer} from 'mobx-react';
const d3 = require('d3');//import d3 from 'd3';
window.d3 = d3;

import Consent from './Consent';
import {addFormatting} from './styledRanges';

// var colors = d3.schemeCategory10; //['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

let flips = [];
for (let i=0; i<100; i++) flips.push(Math.random() < .5);

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

const HighlightReminder = ({show}) => (show
  ? <div style={{color: 'red'}}>Remember to highlight the details you see in this writing (if any).</div>
  : null);

function responseOptions(attr, pageNum, opts, internalName) {
  return opts.map(x => <td key={x}>
    {x && <input type="radio"
        checked={ratings.data.get(`${attr}-${pageNum}`) === internalName[x]}
        onChange={() => {console.log(pageNum, attr, x, internalName[x]); ratings.data.set(`${attr}-${pageNum}`, internalName[x]);}} />
    }</td>);
}

export const RatingPage = observer(class RatingPage extends Component {
  render() {
    let {pageNum, page, attrs} = this.props;
    let [textA, textB] = page;
    let flipped = flips[pageNum];
    let stateA = getStateFor(pageNum, 0, textA.text);
    let stateB = getStateFor(pageNum, 1, textB.text);
    let internalName = {A: 'A', B: 'B', same: 'same'};
    if (flipped) {
      [stateA, stateB] = [stateB, stateA];
      internalName = {A: 'B', B: 'A', same: 'same'};
    }

    return <div className="RatingPage">
      <h3>Page {pageNum+1}</h3>
      <div className="reviews">
        <div>A<AnnotatableText state={stateA} /><HighlightReminder show={stateA.annotations.length === 0} /></div>
        <div>B<AnnotatableText state={stateB} /><HighlightReminder show={stateB.annotations.length === 0} /></div>
      </div>

      <div>Which of these two has more detail about the...</div>

      <table className="ratings-table">
        <thead><tr><th></th><th>A</th><th>same</th><th>B</th></tr></thead>
        <tbody>
          {attrs.map((attr, i) => <tr key={attr}>
            <td>{attr}</td>{responseOptions(attr, pageNum, ['A', 'same', 'B'], internalName)}
          </tr>)}
          <tr><td colSpan="4"><br/>Which is better written?</td></tr>
          <tr><td></td>
            {responseOptions('written', pageNum, ['A', null, 'B'], internalName)}
          </tr>
          <tr><td colSpan="4"><br/>Which is higher quality overall?</td></tr>
          <tr><td></td>{responseOptions('overall', pageNum, ['A', null, 'B'], internalName)}
          </tr>
        </tbody>
      </table>
    </div>;
  }
});

export const App = observer(class App extends Component {
  state = {consented: false};

  render() {
    let {data} = this.props;
    let {pages, attrs} = data;
    let {consented} = this.state;

    if (!consented) {
      return <Consent onConsented={() => {
          this.setState({consented: true});
          setTimeout(() => {window.scrollTo(0, 0);}, 100);
        }} />;
    }


    return <div className="App">
      <div style={{background: 'yellow', boxShadow: '1px 1px 4px grey'}}>
      <h1>Instructions</h1>
      <p><b>If you've done one of these before</b>, skim the texts to make sure you're not rating the same pair twice. If so, try another HIT from this group.</p>
      <p>For each pair of texts below...</p>
      <ol>
        <li><b>Read</b> the two texts.</li>
        <li><b>Highlight</b> all <em>details</em> that each text gives by <b>selecting words or phrases with your mouse</b>.
        <ul>
          <li><b>not a detail</b>: "I'll definitely be back!", "I come here all the time"</li>
          <li><b>a mediocre detail</b>: "The service was pretty fast", "My favorite dish is the veggie burger" (at least it tells you they serve veggie burgers)</li>
          <li><b>a better detail</b>: "The concrete walls felt cold.", "We waited 15 minutes for a seat."</li>
          <li>Click any highlight to remove it.</li>
          <li>You can be sloppy with the highlights, like only selecting part of a word, and highlighting something even if you're not sure how detailed it really is. It's mostly to help you.</li>
        </ul></li>
        <li><b>Rate</b> the two reviews according to the rubric below. <b>Don't penalize a review for being cut off mid-sentence</b>.</li>
      </ol>
      An example of highlighting details:
      <div className="annotated-text" style={{width: '400px', margin: '5px'}}><span data-offset={0}>i came here the other day w</span><span data-offset={27} style={{background: 'rgb(204, 255, 0)'}}>ith my friend. w</span><span data-offset={43}>e got a s</span><span data-offset={52} style={{background: 'rgb(204, 255, 0)'}}>eat pretty qui</span><span data-offset={66}>ck. we both got a pa</span><span data-offset={86} style={{background: 'rgb(204, 255, 0)'}}>sta </span><span data-offset={90}>and a </span><span data-offset={96} style={{background: 'rgb(204, 255, 0)'}}>sala</span><span data-offset={100}>d. it was</span><span data-offset={109} style={{background: 'rgb(204, 255, 0)'}}>n't too loud f</span><span data-offset={123}>or a long conversation, and we di</span><span data-offset={156} style={{background: 'rgb(204, 255, 0)'}}>dn't feel rus</span><span data-offset={169}>hed. </span></div>
      </div>

      {pages.map((page, pageNum) => <RatingPage key={pageNum} pageNum={pageNum} page={page} attrs={attrs} />)}

      <br/><br/>

      <input type="hidden" readOnly={true} name="results" value={JSON.stringify({highlights: allStates, ratings: ratings.data})} />
    </div>;
  }
});

export default App;
