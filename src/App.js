import React, { Component } from 'react';
import {extendObservable, observable, action, autorun, toJS, transaction} from 'mobx';
import {observer, Provider} from 'mobx-react';
const d3 = require('d3');//import d3 from 'd3';
window.d3 = d3;

import {formattedRanges, addFormatting} from './styledRanges';

var colors = d3.schemeCategory10; //['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

var initialQuestions = [
        {text: "What kind of meal did you come for?", tags: ['food', 'occasion']},
        {text: "What kind of food were you hoping to get?", tags: ['food', 'expectations']},
        {text: "On what day of the week did you visit?", tags: ['occasion']},
        {text: "When did you come?", tags: ['occasion']}
      ];

class AnnotationStore {
  constructor() {
    extendObservable(this, {
      texts: [],
      questions: initialQuestions,
      annotations: [
        {textIdx: 1, range: [4, 10], question: initialQuestions[3]},
      ],
    });
  };

  fromJson(json) {
    transaction(() => {
      this.texts = json.texts;
    });
  };

  toJson() {
    return toJS(this);
  };
}

var annotationsStore = new AnnotationStore();
window.annotationsStore = annotationsStore;
if (window.localStorage.annotations){
  annotationsStore.fromJson(JSON.parse(window.localStorage.annotations));
}
autorun(function() {
  window.localStorage.annotations = JSON.stringify(annotationsStore.toJson());
});

class UiState {
  constructor(annotationsStore) {
    this.annotationsStore = annotationsStore;
    extendObservable(this, {
      curTextIdx: 1,
      curAnnotationIdx: 0,
      tempAnnotation: null,
      get curText() {return this.annotationsStore.texts[this.curTextIdx];},
      get curAnnotations() {
        return this.annotationsStore.annotations.filter(ann => ann.textIdx == this.curTextIdx);
      },
      get curAnnotation() {
        if (this.tempAnnotation !== null)
          return this.tempAnnotation;
        return this.curAnnotations[this.curAnnotationIdx];
      }
    });
  }
}

var uistate = new UiState(annotationsStore);
window.uistate = uistate;


const AnnoEditor = observer(['uistate'], class AnnoEditor extends Component {
  render() {
    let {uistate} = this.props;
    let {curAnnotation} = uistate;
    let [start, end] = curAnnotation.range;
    return <div className="annoEditor">
      <div>Text:</div>
      {uistate.curText.slice(start, end)}
      <div>Answers the question:</div>
      {curAnnotation.question.text}
    </div>;
  }
});

const QuestionsList = observer(['annotationsStore'], class QuestionsList extends Component {
  render() {
    let {annotationsStore} = this.props;
    let {questions} = annotationsStore;
    return <div className="QuestionsList">
      {questions.map((question, i) => <div key={i}>
        {question.text}
        ({question.tags.join(', ')})
      </div>)}
    </div>;
  }
});


const Sidebar = observer(['annotationsStore'], class Sidebar extends Component {
  render() {
    let {annotationsStore} = this.props;
    return <div>
      <AnnoEditor />
      <div>Questions:</div>
      <QuestionsList/>
      <div>Current annotations:</div>
    </div>;
  }
});

function FA(name) {
  return <i className={"fa fa-"+name} />;
}

const MainText = observer(['uistate', 'annotationsStore'], class MainText extends Component {
  render() {
    var annotated = [{text: uistate.curText, style: {}}];
    this.props.uistate.curAnnotations.forEach(function({name, range}, i) {
        let [start, end] = range;
        annotated = addFormatting(annotated, start, end, {background: colors[i]});
      });
    return <div className="real-text">{formattedRanges(annotated)}</div>;
  }
});


function doLoadData(data) {
  var filtered = data.replace(/[^]*\nBEGIN_DOCUMENT\n/, '');
  annotationsStore.fromJson(JSON.parse(filtered));
}

function handleFiles(files) {
  var file = files[0];
  var reader = new FileReader();
  reader.onload = evt => {
    doLoadData(reader.result);
  };
  reader.readAsText(file);
}

const RequestDatafile = observer(class RequestDatafile extends Component {
  handlePaste = (evt) => {
    setTimeout(() => {
      doLoadData(this.textarea.value);
    }, 10);
  }

  render() {
    return <div className="container">
      <div className="jumbotron">Select the data file: <input type="file" onChange={evt => handleFiles(evt.target.files)} /><br/> Or paste here:<br/> <textarea ref={e => this.textarea = e} onPaste={this.handlePaste} /></div>
    </div>;
  }
})

function simplifyRanges(text, ranges) {
  var annotated = [{text: uistate.curText, style: {}}];
  ranges.forEach(function([start, end]) {
    annotated = addFormatting(annotated, start, end, {marked: true});
  });
  var newRanges = [], offset = 0;
  annotated.forEach(({text, style}) => {
    if (style.marked) {
      if (newRanges.length && newRanges[newRanges.length - 1][1] === offset) {
        // extend the existing range
        newRanges[newRanges.length - 1][1] = offset + text.length;
      } else {
        newRanges.push([offset, offset + text.length]);
      }
    }
    offset += text.length;
  });
  return newRanges;
}

const OverallQuestions = observer(['annotationsStore'], class OverallQuestions extends Component {
  render() {
    let {annotationsStore} = this.props;
    return null;
    // return <div>
    //   {annotationsStore.questions.map((question, i) => <div key={question.id}>
    //     <label title={question.instructions}>{question.text + " "}
    //       <i className="fa fa-info-circle" title={question.instructions} /><br/>
    //       <input onChange={evt => {question.responses[curTextIdx] = +evt.target.value}} type="number" min={question.min} max={question.max} value={question.responses[curTextIdx] || ""} />
    //     </label></div>)}
    //   </div>;
  }
});


const App = observer(class App extends Component {
  onMouseUp(evt) {
    var range = window.getSelection().getRangeAt(0);
    var startTextOffset = +range.startContainer.parentNode.getAttribute('data-offset') + range.startOffset;
    var endTextOffset = +range.endContainer.parentNode.getAttribute('data-offset') + range.endOffset;
    if (startTextOffset === range.endOffset) return;
    if (uistate.activeTopic >= annotationsStore.topics.length) {
      alert("Create a topic first, then select some text.")
      return;
    }
    var ranges = annotationsStore.topics[uistate.activeTopic].ranges[uistate.curTextIdx];
    ranges.push([startTextOffset, endTextOffset]);
    annotationsStore.topics[uistate.activeTopic].ranges[uistate.curTextIdx] = simplifyRanges(uistate.curText, ranges);
    window.getSelection().removeAllRanges();
  }

  render() {
    let {curTextIdx} = uistate;
    if (annotationsStore.texts.length === 0) {
      return <RequestDatafile />;
    }
    return (
      <Provider annotationsStore={annotationsStore} uistate={uistate}>
      <div className="container">
        <div>
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx - 1}} disabled={uistate.curTextIdx === 0}>&lt;</button>
          Text {uistate.curTextIdx + 1} of {annotationsStore.texts.length}
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx + 1}} disabled={uistate.curTextIdx === annotationsStore.texts.length - 1}>&gt;</button>
        </div>
        <div className="row">
          <div className="col-md-6" id="text" onMouseUp={this.onMouseUp}><MainText />
          </div>
          <div className="col-md-3" id="sidebar">
            <Sidebar />
          </div>
          <div className="col-md-3">
            <OverallQuestions/>
          </div>
        </div>
        <textarea id="results" readOnly="readOnly" value={JSON.stringify(annotationsStore.toJson())} onClick={evt => evt.target.select()} />
        <button style={{position: 'fixed', right: 0, bottom: 0}} onClick={evt => {if (prompt("Type RESET to reset") === "RESET") {
          window.localStorage.clear(); window.location.reload();
        }}}>Reset</button>
      </div>
      </Provider>
    );
  }
});

export default App;
