import React, { Component } from 'react';
import {extendObservable, action, autorun, toJS} from 'mobx';
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
      setTexts: action(function(texts) {
        this.texts = texts;
        this.topics.forEach(topic => {
          topic.ranges = makeEmptyRanges(texts.length);
        });
        this.questions.forEach(question => {
          question.responses = Array(texts.length);
        });
      })
    });
  };

  fromJson(json) {
    this.texts = json.texts;
    this.topics = json.topics;
    this.questions = json.questions;
    this.lastColorIdx = json.lastColorIdx
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
} else {
  annotationsStore.questions = [new Question('quality', 'Overall quality')];
  annotationsStore.setTexts(["never had korean chicken before but this was good in comparison to our homeland version. crispy and tender chicken that was not too greasy. we also ordered topoki, a saucy plate of some chewy doughy stuff, similar to the texture of mochi. \n\nthe lack of stars were due to the long wait (made to order), the cramped space, and the not being able to get more than one itsy container of sauce. let's get it straight - it's bbq sauce, not michael jackson's sweat.", "text 2"]);
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
  console.log("annotationsStore:", json);
  window.localStorage.annotations = json;
});


function formattedRanges(ranges) {
  return ranges.map(({text, style}, i) => <span key={i} style={style}>{text}</span>);
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
          onRemove={() => topic.ranges.splice(i, 1)}
          text={uistate.curText.slice(start, end)} />)}
      </div>
      </div>);
  }
});

const Sidebar = observer(class Sidebar extends Component {
  handleAddTopic = () => {
    this.props.topics.push(new Topic(prompt("Name for this topic?"), annotationsStore.nextColor(), makeEmptyRanges(annotationsStore.texts.length)));
    uistate.setActiveTopic(this.props.topics.length - 1);
  };

  render() {
    let {activeTopic, topics, curTextIdx} = this.props;
    return <div>
      <div className="sidebarGroup">
        <div>Overall questions:</div>
        {annotationsStore.questions.map((question, i) => <div key={question.id}>
          <label>{question.text}
            <input onChange={evt => {question.responses[curTextIdx] = +evt.target.value}} type="number" min="1" max="7" value={question.responses[curTextIdx] || ""} />
          </label></div>)}
      </div>

      <div>Topics:</div>
      {topics.map((topic, i) => <SidebarTopic
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
    return <div>{
      annotationsStore.topics.map(function({name, color, ranges}, i) {
        var annotated = [{text: uistate.curText, style: {}}];
        ranges[uistate.curTextIdx].forEach(function([start, end]) {
          annotated = addFormatting(annotated, start, end, {background: color});
        });
        return <div key={i} className="hl-layer">{formattedRanges(annotated)}</div>
      })}
      <div className="real-text">{uistate.curText}</div>
    </div>;
  }
});



const App = observer(class App extends Component {
  onMouseUp(evt) {
    var range = window.getSelection().getRangeAt(0);
    if (range.startContainer !== range.endContainer || range.startOffset === range.endOffset) return;
    if (uistate.activeTopic >= annotationsStore.topics.length) {
      alert("Create a topic first, then select some text.")
    }
    annotationsStore.topics[uistate.activeTopic].ranges[uistate.curTextIdx].push([range.startOffset, range.endOffset]);
  }

  render() {
    return (
      <div className="App">
        <div>
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx - 1}} disabled={uistate.curTextIdx === 0}>&lt;</button>
          Text {uistate.curTextIdx + 1} of {annotationsStore.texts.length}
          <button onClick={() => {uistate.curTextIdx = uistate.curTextIdx + 1}} disabled={uistate.curTextIdx === annotationsStore.texts.length - 1}>&gt;</button>
        </div>
        <div className="row">
          <div className="col-md-9" id="text" onMouseUp={this.onMouseUp}><MainText />
          </div>
          <div className="col-md-3" id="sidebar">
            <Sidebar topics={annotationsStore.topics} activeTopic={uistate.activeTopic} curTextIdx={uistate.curTextIdx} />
            <button onClick={evt => {window.localStorage.clear(); window.location.reload();}}>Reset</button>
          </div>
        </div>
        <textarea id="results" readOnly="readOnly" value={JSON.stringify(annotationsStore.toJson())} />
      </div>
    );
  }
});

export default App;
