import React, { Component } from 'react';
import {extendObservable, observable, action, autorun, toJS, transaction} from 'mobx';
import {observer} from 'mobx-react';

var colors = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

class Topic {
  constructor(name, color, ranges) {
    extendObservable(this, {
      name: name,
      color: color,
      ranges: ranges || []
    });
  }
}

function makeEmptyRanges(n) {
  let ranges = [];
  for (let i=0; i<n; i++) ranges.push([]);
  return ranges;
}

class Question {
  constructor(id, text) {
    this.id = id;
    this.text = text;
    extendObservable(this, {
      responses: []
    });
  }
}

class AnnotationStore {
  constructor() {
    extendObservable(this, {
      texts: [],
      topics: [],
      questions: [],
      lastColorIdx: 0,
    });
  };

  fromJson(json) {
    transaction(() => {
      this.texts = json.texts;
      this.topics = json.topics || [];
      this.questions = json.questions;
      this.lastColorIdx = json.lastColorIdx || 0;
      this.questions.forEach(question => {
        question.responses = question.responses || observable(Array(this.texts.length));
      });
    });
  };

  toJson() {
    return toJS(this);
  };

  nextColor() {
    var idx = this.lastColorIdx;
    this.lastColorIdx = idx + 1;
    return colors[idx % colors.length];
  };
}

var annotationsStore = new AnnotationStore();
window.annotationsStore = annotationsStore;
if (window.localStorage.annotations){
  annotationsStore.fromJson(JSON.parse(window.localStorage.annotations));
}

class UiState {
  constructor(annotationsStore) {
    this.annotationsStore = annotationsStore;
    extendObservable(this, {
      curTextIdx: 0,
      get curText() {return this.annotationsStore.texts[this.curTextIdx];},
      activeTopic: 0,
      setActiveTopic: action(function(i) {
        this.activeTopic = i;
      })
    });
  }
}

var uistate = new UiState(annotationsStore);
window.uistate = uistate;


autorun(function() {
  var json = JSON.stringify(annotationsStore.toJson());
  window.localStorage.annotations = json;
});


function formattedRanges(ranges) {
  var offset = 0;
  return ranges.map(({text, style}, i) => <span key={i} style={style} data-offset={(offset += text.length) - text.length}>{text}</span>);
}

function joinStyle(a, b) { return {...a, ...b};}

function addFormatting(existingRanges, start, end, fmt) {
  let res = [];
  for (let existingRangeIdx = 0; existingRangeIdx < existingRanges.length; existingRangeIdx++) {
    let range = existingRanges[existingRangeIdx];
    let textLen = range.text.length;
    if (start > 0) {
      // before start.
      if (textLen <= start) {
        // Pass through unchanged text.
        res.push(range);
      } else {
        // Break apart this range.
        res.push({text: range.text.slice(0, start), style: range.style});
        if (end < textLen) {
          // Range also ends within this block.
          res.push({text: range.text.slice(start, end), style: joinStyle(range.style, fmt)});
          res.push({text: range.text.slice(end), style: range.style});
        } else {
          res.push({text: range.text.slice(start), style: joinStyle(range.style, fmt)});
        }
      }
    } else if (end > 0) {
      // within range.
      if (textLen <= end) {
        res.push({text: range.text, style: joinStyle(range.style, fmt)});
      } else {
        // Break apart.
        if (end > 0) {
          res.push({text: range.text.slice(0, end), style: joinStyle(range.style, fmt)});
        }
        res.push({text: range.text.slice(end), style: range.style});
      }
    } else {
      // Pass through remaining text.
      res.push(range);
    }
    start -= textLen;
    end -= textLen;
  }
  return res;
}

const TopicInstance = observer(class TopicInstance extends Component {
  render() {
    return <div><button onClick={this.props.onRemove}>x</button> {this.props.text}</div>;
  }
});

const SidebarTopic = observer(class SidebarTopic extends Component {
  handleClick = () => {
    uistate.setActiveTopic(this.props.idx);
  };

  handleEditTitle = () => {
    let newName = prompt('New name for this topic', this.props.topic.name);
    if (newName.length)
      this.props.topic.name = newName;
  };

  handleRemove = (evt) => {
    if (!confirm("Are you sure you want to remove the topic \""+this.props.topic.name+"\"?"))
      return;
    if (uistate.activeTopic >= this.props.idx) {
      uistate.setActiveTopic(uistate.activeTopic - 1);
    }
    annotationsStore.topics.splice(this.props.idx, 1);
    evt.stopPropagation();
  };

  render() {
    let {isActive, topic, curTextIdx} = this.props;
    return (
      <div className={"sidebarGroup " + (isActive ? "active" : "")}>
        <div
          className="topic"
          style={{background: topic.color}}
          onClick={this.handleClick}>
          <span>{topic.name}</span>
          <button onClick={this.handleEditTitle}>{FA('edit')}</button>
          <button onClick={this.handleRemove}>{FA('remove')}</button>
        </div>
      <div>
        {topic.ranges[curTextIdx].map(([start, end], i) => <TopicInstance
          key={i}
          onRemove={() => topic.ranges[curTextIdx].splice(i, 1)}
          text={uistate.curText.slice(start, end)} />)}
      </div>
      </div>);
  }
});

const Sidebar = observer(class Sidebar extends Component {
  handleAddTopic = () => {
    this.props.annotationsStore.topics.push(new Topic(prompt("Name for this topic?"), this.props.annotationsStore.nextColor(), makeEmptyRanges(this.props.annotationsStore.texts.length)));
    uistate.setActiveTopic(this.props.topics.length - 1);
  };

  render() {
    let {annotationsStore, activeTopic, curTextIdx} = this.props;
    return <div>
      <div>Topics:</div>
      {annotationsStore.topics.map((topic, i) => <SidebarTopic
      key={i}
      idx={i} isActive={i === activeTopic}
      topic={topic} curTextIdx={curTextIdx} />)}
      <button onClick={this.handleAddTopic}>{FA('plus')} Add Topic</button>

    </div>;
  }
});

function FA(name) {
  return <i className={"fa fa-"+name} />;
}

const MainText = observer(class MainText extends Component {
  render() {
    var annotated = [{text: uistate.curText, style: {}}];
    this.props.annotationsStore.topics.forEach(function({name, color, ranges}) {
        ranges[uistate.curTextIdx].forEach(function([start, end]) {
          annotated = addFormatting(annotated, start, end, {background: color});
        });
      });
    return <div className="real-text">{formattedRanges(annotated)}</div>;
  }
});


function handleFiles(files) {
  var file = files[0];
  var reader = new FileReader();
  reader.onload = evt => {
    console.log("got data");
    var data = JSON.parse(reader.result);
    annotationsStore.fromJson(data);
  };
  reader.readAsText(file);
}

const RequestDatafile = observer(class RequestDatafile extends Component {
  handlePaste = (evt) => {
    setTimeout(() => {
      var pasted = this.textarea.value;
      var filtered = pasted.replace(/[^]*\nBEGIN_DOCUMENT\n/, '');
      annotationsStore.fromJson(JSON.parse(filtered));
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
      <div className="container">
        <div>
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx - 1}} disabled={uistate.curTextIdx === 0}>&lt;</button>
          Text {uistate.curTextIdx + 1} of {annotationsStore.texts.length}
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx + 1}} disabled={uistate.curTextIdx === annotationsStore.texts.length - 1}>&gt;</button>
        </div>
        <div className="row">
          <div className="col-md-6" id="text" onMouseUp={this.onMouseUp}><MainText annotationsStore={annotationsStore} />
          </div>
          <div className="col-md-3" id="sidebar">
            <Sidebar annotationsStore={annotationsStore} topics={annotationsStore.topics} activeTopic={uistate.activeTopic} curTextIdx={uistate.curTextIdx} />
          </div>
          <div className="col-md-3">
            <div>Overall questions:</div>
            {annotationsStore.questions.map((question, i) => <div key={question.id}>
              <label title={question.instructions}>{question.text + " "}
                <i className="fa fa-info-circle" title={question.instructions} /><br/>
                <input onChange={evt => {question.responses[curTextIdx] = +evt.target.value}} type="number" min={question.min} max={question.max} value={question.responses[curTextIdx] || ""} />
              </label></div>)}
          </div>
        </div>
        <textarea id="results" readOnly="readOnly" value={JSON.stringify(annotationsStore.toJson())} onClick={evt => evt.target.select()} />
        <button style={{position: 'fixed', right: 0, bottom: 0}} onClick={evt => {if (prompt("Type RESET to reset") === "RESET") {
          window.localStorage.clear(); window.location.reload();
        }}}>Reset</button>
      </div>
    );
  }
});

export default App;
