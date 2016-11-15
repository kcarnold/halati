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
        // {textIdx: 1, range: [4, 10], question: initialQuestions[3]},
      ],
      get allTags() {
        var tags = d3.set();
        this.questions.forEach(q => q.tags.forEach(t => tags.add(t)));
        var tagValues = tags.values();
        tagValues.sort();
        return tagValues;
      }
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
      tempAnnotation: null,//{textIdx: 1, range: [4, 10], questions: []},//, question: initialQuestions[3]},
      tagSearch: '',
      get curText() {return this.annotationsStore.texts[this.curTextIdx];},
      get curAnnotations() {
        return this.annotationsStore.annotations.filter(ann => ann.textIdx == this.curTextIdx);
      },
    });
  }
}

var uistate = new UiState(annotationsStore);
window.uistate = uistate;

var escapeRegExp = require('lodash.escaperegexp');

const AnnoEditDialog = observer(['uistate', 'annotationsStore'], class AnnoEditDialog extends Component {
  handleAddQuestion = (evt) => {
    console.log("Add question", this.newQuestionElt.value);
    evt.preventDefault();
  };

  handleAddAnnotation = evt => {
    transaction(() => {
      this.props.annotationsStore.annotations.push(this.props.uistate.tempAnnotation);
      this.props.uistate.tempAnnotation = null;
      this.props.tagSearch = '';
    });
  };

  render() {
    let {uistate, annotationsStore} = this.props;
    let {questions} = annotationsStore;
    let {tempAnnotation} = uistate;
    let [start, end] = tempAnnotation.range;
    let tags = annotationsStore.allTags;
    if (uistate.tagSearch) {
      let regex = new RegExp(uistate.tagSearch.trim().split(/\s+/).map(t => escapeRegExp(t)).join('|'));
      tags = tags.filter(t => !!regex.exec(t));
    }
    return <div className="AnnoEditDialog">
      <div className="text">{uistate.curText.slice(start, end)}</div>
      Answers the question(s):
      <hr/>
      <div>filter by tag: <input id="tag-filter" type="search" value={uistate.tagSearch} onInput={(evt) => {uistate.tagSearch = evt.target.value; return false;}} /></div>
      <div><input id="new-question" ref={(elt) => {this.newQuestionElt = elt;}} /><button onClick={this.handleAddQuestion}>Add Question</button></div>
      {tags.map(tag => <div key={tag} className="annoTag">
        <h1>{tag}</h1>
        {annotationsStore.questions.filter(q => q.tags.indexOf(tag) !== -1).map((question, i) => <label key={i} className="anno-question">
          <input type="checkbox" value={tempAnnotation.questions.indexOf(question.text) !== -1} onChange={evt => {
            if (evt.target.value) {
              tempAnnotation.questions.push(question.text);
            } else {
              tempAnnotation.questions.splice(tempAnnotation.indexOf(question.text), 1);
            }
          }} />
          {question.text}
          <div className="question-tags">{question.tags.join(', ')}</div>
        </label>)}
      </div>)}
      <button className="btn btn-default" onClick={e => {uistate.tempAnnotation = null; }}>Cancel</button>
      <button className="btn btn-primary" disabled={tempAnnotation.questions.length == 0} onClick={this.handleAddAnnotation}>Add annotation</button>
    </div>;
  }
});

function FA(name) {
  return <i className={"fa fa-"+name} />;
}

const MainText = observer(['uistate', 'annotationsStore'], class MainText extends Component {
  onMouseUp = (evt) => {
    let {uistate} = this.props;
    var range = window.getSelection().getRangeAt(0);
    var startTextOffset = +range.startContainer.parentNode.getAttribute('data-offset') + range.startOffset;
    var endTextOffset = +range.endContainer.parentNode.getAttribute('data-offset') + range.endOffset;
    if (startTextOffset === range.endOffset) return;
    uistate.tempAnnotation = {textIdx: uistate.curTextIdx, range: [startTextOffset, endTextOffset], questions: []};
  };

  render() {
    var annotated = [{text: uistate.curText, style: {}}];
    this.props.uistate.curAnnotations.forEach(function({name, range}, i) {
        let [start, end] = range;
        annotated = addFormatting(annotated, start, end, {background: colors[i]});
      });
    return <div className="real-text" onMouseUp={this.onMouseUp}>{formattedRanges(annotated)}</div>;
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
          <div className="col-md-9" id="text"><MainText /></div>
          <div className="col-md-3"><OverallQuestions/></div>
        </div>
        {uistate.tempAnnotation && <div className="overlay" />}
        {uistate.tempAnnotation && <AnnoEditDialog />}
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
