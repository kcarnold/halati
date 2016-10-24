import React, { Component } from 'react';
import {extendObservable, observable, computed, action, autorun, toJS} from 'mobx';
import {observer} from 'mobx-react';

var colors = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

class Region {
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

class AnnotationStore {
  constructor() {
    extendObservable(this, {
      reviews: [],
      regions: [],
      lastColorIdx: 0,
      setReviews: action(function(reviews) {
        this.reviews = reviews;
        this.regions.forEach(topic => {
          topic.ranges = makeEmptyRanges(reviews.length);
        });
      })
    });
  };

  fromJson(json) {
    this.reviews = json.reviews;
    this.regions = json.regions;
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
  annotationsStore.setReviews(["never had korean chicken before but this was good in comparison to our homeland version. crispy and tender chicken that was not too greasy. we also ordered topoki, a saucy plate of some chewy doughy stuff, similar to the texture of mochi. \n\nthe lack of stars were due to the long wait (made to order), the cramped space, and the not being able to get more than one itsy container of sauce. let's get it straight - it's bbq sauce, not michael jackson's sweat.", "review 2"]);
}

class UiState {
  constructor(annotationsStore) {
    this.annotationsStore = annotationsStore;
    extendObservable(this, {
      curReview: 0,
      get curText() {return this.annotationsStore.reviews[this.curReview];},
      activeRegion: 0,
      setActiveRegion: action(function(i) {
        this.activeRegion = i;
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
    uistate.setActiveRegion(this.props.idx);
  };

  handleEditTitle = () => {
    let newName = prompt('New name for this topic', this.props.topic.name);
    if (newName.length)
      this.props.topic.name = newName;
  };

  handleRemove = (evt) => {
    if (uistate.activeRegion >= this.props.idx) {
      uistate.setActiveRegion(uistate.activeRegion - 1);
    }
    annotationsStore.regions.splice(this.props.idx, 1);
    evt.stopPropagation();
  };

  render() {
    let {isActive, topic, curReview} = this.props;
    return (
      <div className={isActive ? "active" : ""}>
        <div
          className="region"
          style={{background: topic.color}}
          onClick={this.handleClick}>
          {topic.name}
          <button onClick={this.handleEditTitle}>{FA('edit')}</button>
          <button onClick={this.handleRemove}>{FA('remove')}</button>
        </div>
      <div>
        {topic.ranges[curReview].map(([start, end], i) => <TopicInstance
          key={i}
          onRemove={() => topic.ranges.splice(i, 1)}
          text={uistate.curText.slice(start, end)} />)}
      </div>
      </div>);
  }
});

const Sidebar = observer(class Sidebar extends Component {
  handleAddRegion = () => {
    this.props.regions.push(new Region(prompt("Name for this topic?"), annotationsStore.nextColor(), makeEmptyRanges(annotationsStore.reviews.length)));
    uistate.setActiveRegion(this.props.regions.length - 1);
  };

  render() {
    let {activeRegion, regions, curReview} = this.props;
    return <div>{regions.map((topic, i) => <SidebarTopic
      key={i}
      idx={i} isActive={i === activeRegion}
      topic={topic} curReview={curReview} />)}
      <button onClick={this.handleAddRegion}>{FA('plus')} Add Topic</button>
    </div>;
  }
});

function FA(name) {
  return <i className={"fa fa-"+name} />;
}

const MainText = observer(class MainText extends Component {
  render() {
    return <div>{
      annotationsStore.regions.map(function({name, color, ranges}, i) {
        var annotated = [{text: uistate.curText, style: {}}];
        ranges[uistate.curReview].forEach(function([start, end]) {
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
    if (uistate.activeRegion >= annotationsStore.regions.length) {
      alert("Create a topic first, then select some text.")
    }
    annotationsStore.regions[uistate.activeRegion].ranges[uistate.curReview].push([range.startOffset, range.endOffset]);
  }

  render() {
    return (
      <div className="App">
        <div className="row">
          <div className="col-md-9" id="text" onMouseUp={this.onMouseUp}><MainText />
          </div>
          <div className="col-md-3" id="sidebar">
            <Sidebar regions={annotationsStore.regions} activeRegion={uistate.activeRegion} curReview={uistate.curReview} />
            <button onClick={evt => {window.localStorage.clear(); window.location.reload();}}>Reset</button>
          </div>
        </div>
      </div>
    );
  }
});

export default App;
