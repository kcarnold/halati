import React, { Component } from 'react';
import {extendObservable, observable, computed, action, autorun} from 'mobx';
import {observer} from 'mobx-react';

var colors = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']; // colorbrewer set3

let lastColorIdx = 0;
function nextColor() {
  return colors[(lastColorIdx++) % colors.length];
}


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

class AnnotatorState {
  constructor() {
    extendObservable(this, {
      reviews: [],
      curReview: 0,
      get curText() {return this.reviews[this.curReview];},
      activeRegion: 0,
      regions: [],
      setActiveRegion: action(function(i) {
        this.activeRegion = i;
      }),
      setReviews: action(function(reviews) {
        this.reviews = reviews;
        this.regions.forEach(topic => {
          topic.ranges = makeEmptyRanges(reviews.length);
        });
      })
    });
  }
}

var state = new AnnotatorState();
state.setReviews(["never had korean chicken before but this was good in comparison to our homeland version. crispy and tender chicken that was not too greasy. we also ordered topoki, a saucy plate of some chewy doughy stuff, similar to the texture of mochi. \n\nthe lack of stars were due to the long wait (made to order), the cramped space, and the not being able to get more than one itsy container of sauce. let's get it straight - it's bbq sauce, not michael jackson's sweat.", "review 2"]);


var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;',
  "/": '&#x2F;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}

function formattedRanges(ranges) {
  return ranges.map(({text, style}, i) => <span style={style}>{text}</span>);
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
    state.setActiveRegion(this.props.idx);
  };

  handleEditTitle = () => {
    let newName = prompt('New name for this topic', this.props.topic.name);
    if (newName.length)
      this.props.topic.name = newName;
  };

  handleRemove = (evt) => {
    console.log(state.activeRegion, this.props.idx)
    if (state.activeRegion >= this.props.idx) {
      state.setActiveRegion(state.activeRegion - 1);
    }
    state.regions.splice(this.props.idx, 1);
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
          text={state.curText.slice(start, end)} />)}
      </div>
      </div>);
  }
});

const Sidebar = observer(class Sidebar extends Component {
  handleAddRegion = () => {
    this.props.regions.push(new Region(prompt("Name for this topic?"), nextColor(), makeEmptyRanges(state.reviews.length)));
    state.setActiveRegion(this.props.regions.length - 1);
  };

  render() {
    let {activeRegion, regions, curReview} = this.props;
    return <div>{regions.map((topic, i) => <SidebarTopic
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
      state.regions.map(function({name, color, ranges}, i) {
        var annotated = [{text: state.curText, style: {}}];
        ranges[state.curReview].forEach(function([start, end]) {
          annotated = addFormatting(annotated, start, end, {background: color});
        });
        return <div className="hl-layer">{formattedRanges(annotated)}</div>
      })}
      <div className="real-text">{state.curText}</div>
    </div>;
  }
});



class App extends Component {
  onMouseUp(evt) {
    var range = window.getSelection().getRangeAt(0);
    if (range.startContainer !== range.endContainer || range.startOffset === range.endOffset) return;
    if (state.activeRegion >= state.regions.length) {
      alert("Create a topic first, then select some text.")
    }
    state.regions[state.activeRegion].ranges[state.curReview].push([range.startOffset, range.endOffset]);
  }

  render() {
    return (
      <div className="App">
        <div className="row">
          <div className="col-md-9" id="text" onMouseUp={this.onMouseUp}><MainText />
          </div>
          <div className="col-md-3" id="sidebar">
            <Sidebar regions={state.regions} activeRegion={state.activeRegion} curReview={state.curReview} />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
