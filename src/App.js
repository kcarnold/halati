import React, { Component } from 'react';
import * as M from 'mobx';
import {observer} from 'mobx-react';
import Consent from './Consent';
import {seededShuffle} from './shuffle';

let logEntries = M.observable([]);
function log(entry) {
  logEntries.push({...entry, timestamp: +new Date()});
}

let state;

export const init = data => {
  log({type: 'init', data});
  state = new State(data, logEntries[0].timestamp);
  window.state = state;
  if (state.curPair === null) state.curPairIdx++;
};

class State {
  constructor(data, seed) {
    this.data = data;
    this.seed = seed;
    this.positives = M.observable.map();
    this.negatives = M.observable.map();
    this.detailPairs = M.observable.map();

    this.sentences = data.sentences.map((datum, idx) => ({...datum, idx}));
    this.orderedSentences = seededShuffle(`${seed}-order`, this.sentences);

    M.extendObservable(this, {
      curPairIdx: 0,
      get pairOrigIdx() {
        let {curPairIdx} = this;
        return this.orderedSentences[curPairIdx].idx;
      },
      get curPair() {
        let {curPairIdx, pairOrigIdx} = this;
        if (pairOrigIdx === this.sentences.length - 1) return null;
        let sents = this.sentences.slice(pairOrigIdx, pairOrigIdx + 2);
        return seededShuffle(`${this.seed}-pair${curPairIdx}`, sents);
      }
    });
  }
}

const LikertItem = ({itemName, labels, name, value}) => <div className="LikertItem">
  <h3>{itemName}</h3>
  <ul>
    {labels.map((label, idx) => <li key={idx}>
      <label>
        <input type="radio" checked={value === idx} onChange={evt => {console.log(name, idx);}} />
        <span>{label}</span>
      </label></li>)}
  </ul>
</div>;

export const App = observer(class App extends Component {
  state = {consented: true};

  render() {
    let {consented} = this.state;

    if (!consented) {
      return <Consent onConsented={() => {
          this.setState({consented: true});
          setTimeout(() => {window.scrollTo(0, 0);}, 100);
        }} />;
    }

    let {curPair} = state;
    let curValue = state.detailPairs.get(state.pairOrigIdx);

    return <div className="App">
      <div style={{background: 'yellow', boxShadow: '1px 1px 4px grey', padding: '5px'}}>
      <h1>Instructions</h1>
      <p><b>If you've done one of these before</b>, skim the texts to make sure you're not rating the same text twice. If so, try another HIT from this group.</p>
      </div>

      <div className="pair">
        <div>{curPair[0].sentence}</div>
        <div>{curPair[1].sentence}</div>
      </div>
      <LikertItem itemName="Which is more informative?" labels={["Left, much more", "Left, somewhat more", "Right, somewhat more", "Right, much more"]} value={0} />


      <br/><br/>

      <input type="hidden" readOnly={true} name="results" value={JSON.stringify({logEntries})} />
      <input type="hidden" readOnly={true} name="results" value={JSON.stringify({state})} />
    </div>;
  }
});

export default App;
window.logEntries = logEntries;
