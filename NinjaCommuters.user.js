// ==UserScript==
// @name          Ninja Commuters
// @namespace     http://dominicklim.com/userscripts
// @description   Leverages Google Maps API and piggybacks off of Ninja Courses to show how long it takes to get to classes.
// @include       http://ninjacourses.com
// @include       http://www.ninjacourses.com
// @include       https://ninjacourses.com
// @include       https://www.ninjacourses.com
// @include       http://ninjacourses.com/schedule/*
// @include       http://www.ninjacourses.com/schedule/*
// @include       https://ninjacourses.com/schedule/*
// @include       https://www.ninjacourses.com/schedule/*
// @include       http://schedulebuilder.berkeley.edu/schedule/*
// @include       http://www.schedulebuilder.berkeley.edu/schedule/*
// @include       https://schedulebuilder.berkeley.edu/schedule/*
// @include       https://www.schedulebuilder.berkeley.edu/schedule/*
// ==/UserScript==

var BUILDING_CORRECTIONS = {
    "gpb":"Genetics and Plant Biology",
    "valley lsb":"Valley Life Sciences Building",
    "wheeler aud":"Wheeler Hall",
    "morrison":"Morrison Hall",
    "hertz":"Morrison Hall",
    "unit iii din":"RES HALL UNIT III DINING",
    "rec sprt fac":"Recreational Sports Facility",
    "spieker pool":"Spieker Aquatics Complex",
    "tan":"Tan Hall",
    "lhs":"Lawrence Hall of Sciences",
    "univ hall":"University Hall",
    "gspp":"Goldman School of Public Policy",
    "durant":"Durant Hall",
    "kerr":"Kerr Field",
    "latimer":"University of California : Department of Chemistry, Latimer Hall",
    "lsa":"Life Sciences Addition",
    "mlk st union":"Martin Luther King Student Union",
    "pac":"Film ARC St Pacific Film Archive",
    "chavez":"Cesar E. Chavez Student Center",
    "donner lab":"Donner Laboratory",
    "dwinelle an":"Dwinelle Annex",
    "gilman":"Gilman Hall",
    "bancroft lib":"Bancroft Library",
    "bechtel aud":"Bechtel Engineering Center",
    "berk art mus":"Berkeley Art Museum",
    "bot garden":"Botanical Gardens",
    "soda":"Soda Hall",
    "off campus":"2150 Shattuck Ave",
    "hearst min":"Department of Materials Science and Engineering"
  };

var HOME_ADDRESS_KEY = 'homeAddress';
var SHOW_COMMUTE_TIMES_KEY = 'showCommuteTimes';
var MINUTES_TO_FIRST_CLASS_KEY = 'minutesToFirstClass';
var TRUE_STRING = "true";
var FALSE_STRING = "false";

var preferences = new UserPreferences();

// Access user preferences (backed by localStorage)
function UserPreferences() {
  var that = this;
  var defaults = {};
  defaults[HOME_ADDRESS_KEY] = "";
  defaults[SHOW_COMMUTE_TIMES_KEY] = "true";
  defaults[MINUTES_TO_FIRST_CLASS_KEY] = "";

  this.getPreference = function(name) {
    if (that.isPreferenceDefined(name)) {
      return localStorage[name];
    } else if (defaults.hasOwnProperty(name)) {
      return defaults[name];
    } else {
      return null;
    }
  };

  this.isPreferenceDefined = function(name) {
    return localStorage.hasOwnProperty(name);
  };

  this.setPreference = function(name, preference) {
    if (defaults[name] === preferences) {
      return;
    } else {
      localStorage[name] = preference;
    }
  };

  this.togglePreference = function(name) {
    var preference = that.getPreference(name);

    if (preference === TRUE_STRING) {
      localStorage[name] = FALSE_STRING;
    } else {
      localStorage[name] = TRUE_STRING;
    }
  };

  this.isPreferenceTrue = function(name) {
    return that.getPreference(name) === TRUE_STRING;
  }
}

// Object for manipulating a schedule's sections
function Sections(className) {
  var sections = document.getElementsByClassName(className);
  var groups = null;

  this.grouped = function() {
    if (groups === null) {
      var offsetLeft;
      var day;

      groups = {};

      for (var i = 0; i < sections.length; i++) {
        offsetLeft = sections[i].offsetLeft;

        if (offsetLeft !== undefined) {
          if (!groups.hasOwnProperty(offsetLeft)) {
            groups[offsetLeft] = [];
          }

          groups[offsetLeft].push(new Section(sections[i]));
        }
      }

      for (var groupKey in groups) {
        groups[groupKey] = new Day(groups[groupKey]);
      }
    }

    return groups;
  };
}

// Object that provides
function Day(sections) {
  sortSections();

  this.addDurationOverlays = function() {
    var section;
    var nextSection;

    for (var i = 0; i < sections.length; i++) {
      section = sections[i];

      if (!section.location()) {
        continue;
      }

      if (i === 0 && preferences.isPreferenceDefined(HOME_ADDRESS_KEY)) {
        section.addDurationOverlayFromHome();
      }

      nextSection = sections[i + 1];

      if (nextSection) {
        if (nextSection.location()) {
          section.addDurationOverlayToNext(nextSection);
        }
      }
    }
  };

  function sortSections() {
    sections.sort(function (a, b) {
      return a.elt.offsetTop - b.elt.offsetTop;
    });
  };
}

var BORDER_HEIGHT = 3;
var BERKELEY_TIME = 10;
var CONTENT_CLASS = 'schedule-section-content';
var LOCATION_CLASS = 'location';
var HALF_HR_CLASS = 'schedule-half-hour schedule-hour';

// Object that encapsulates the section div element of a schedule, and provides
// useful methods to extract data about it and manipulate it
function Section(elt) {
  this.elt = elt;
  var location = null;
  var durationFromHome = null;
  var durationToNext = null;
  var next_ = null;
  var content = null;
  var href = null;
  var homeAddress = new Address(preferences.getPreference(HOME_ADDRESS_KEY));
  var minutesToFirstClass = preferences.getPreference(MINUTES_TO_FIRST_CLASS_KEY);

  var that = this;

  var HALF_HR_HEIGHT = document.getElementsByClassName(HALF_HR_CLASS)[0].offsetHeight;
  var PIXELS_PER_MIN = HALF_HR_HEIGHT / 30;

  this.location = function() {
    if (location === null) {
      location = elt.firstChildOfClass(LOCATION_CLASS);
      location = (typeof(location) === 'undefined') ? false : new Address(location.innerHTML.sansNumberWords());
    }

    return location;
  };

  this.getDurationFromHome = function(fn) {
    if (durationFromHome === null) {
      homeAddress.getDuration(that.location(), function (duration) {
        durationFromHome = duration;
        fn(duration);
      });
    } else {
      fn(durationFromHome);
    }
  };

  this.getDurationToNext = function(next, fn) {
    if (next_ !== next || durationToNext === null) {
      next_ = next;
      (that.location()).getDuration(next.location(), function (duration) {
        durationToNext = duration;
        fn(duration);
      });
    } else {
      fn(durationToNext);
    }
  };

  this.minutesAvailable = function(next) {
    var eltBottom = elt.offsetTop + elt.offsetHeight + BORDER_HEIGHT;
    var pixelsToNext = next.elt.offsetTop - eltBottom;
    var minutesAvailable = (pixelsToNext / PIXELS_PER_MIN) + BERKELEY_TIME;

    return minutesAvailable;
  };

  this.content = function() {
    if (content === null) {
      content = elt.firstChildOfClass(CONTENT_CLASS);
    }

    return content;
  };

  this.href = function() {
    if (href === null) {
      href = elt.firstChildWithTag('a').getAttribute('href');
    }

    return href;
  };

  this.addDurationOverlayFromHome = function() {
    that.getDurationFromHome(function (duration) {
      that.addDurationOverlay(homeAddress, minutesToFirstClass, duration);
    });
  };

  this.addDurationOverlayToNext = function(next) {
    that.getDurationToNext(next, function (duration) {
      next.addDurationOverlay(that.location(), that.minutesAvailable(next), duration);
    });
  };

  this.addDurationOverlay = function(from, minutesAvailable, secondsRequired) {
    var minutesRequired = Math.floor(secondsRequired / 60);
    var minutesToSpare = minutesAvailable - minutesRequired;
    var fromLocation = from.isEqual(homeAddress) ? "Home" : from.displayName;
    var background = document.createElement("a");
    var backgroundClass = "background";
    var detailMinutes = "<p class='details minutes'>" + minutesRequired + " min</p>";
    var detailFrom = "<p class='details'>from " + fromLocation + "</p>";
    var detailAvailable = "<p class='details'>You have " + minutesAvailable + " min</p>";
    var durationParent = "<div class='duration'>" + detailMinutes + detailFrom + detailAvailable + "</div>";

    backgroundClass += preferences.isPreferenceTrue(SHOW_COMMUTE_TIMES_KEY) ? " highlighted" : "";
    if (minutesToSpare < 0) {
      backgroundClass += " bad";
    } else if (minutesToSpare < 3) {
      backgroundClass += " okay";
    }

    background.className = backgroundClass;
    background.setAttribute('href', that.href());
    background.innerHTML = durationParent;
    elt.appendChild(background);
  };
}

// Object that makes working with addresses easier
function Address(building) {
  this.displayName = building;
  var building_ = building;
  var localizedInBerkeley_ = null;
  var that = this;

  this.localizedInBerkeley = function () {
    if (localizedInBerkeley_ === null) {
      if (building_) {
        if (building_.indexOf(',') === -1) {
          var key = this.cleaned();
          localizedInBerkeley_ = BUILDING_CORRECTIONS[key] || building_;
          localizedInBerkeley_ += ", berkeley, ca";
        }
      } else {
        localizedInBerkeley_ = "berkeley, ca";
      }
    }

    return localizedInBerkeley_;
  };

  this.getDuration = function(destination, callback) {
    $.ajax({
      dataType: "JSON",
      url: that.directionsURL(destination),
      context: document.body,
      type: "GET",
      crossDomain: true,
      complete: function (data) {
        if (data) {
          var json = $.parseJSON(data["responseText"])
            , routes = json["routes"]
            , legs = routes[0]["legs"]
            , duration = 0;

          for (var i = 0; i < legs.length; i++) {
            duration += legs[i]["duration"]["value"];
          }

          callback(duration);
        } else {
        }
      }
    });
  };

  this.cleaned = function() {
    return (building_.replace(/(^\s+|\s+$)/g,'')).toLowerCase();
  };

  this.isEqual = function(addr) {
    return that.cleaned() === addr.cleaned();
  }

  this.directionsURL = function(destination) {
    return "https://maps.googleapis.com/maps/api/directions/json?v=3&origin="+that.localizedInBerkeley()+"&destination="+destination.localizedInBerkeley()+"&sensor=false&mode=walking";
  };
}

// Helpers
function toggleCommuteTimes() {
  var all = document.getElementsByClassName('background');

  preferences.togglePreference(SHOW_COMMUTE_TIMES_KEY);
  var showCommuteTimes = preferences.isPreferenceTrue(SHOW_COMMUTE_TIMES_KEY);
  var toggleVerb = showCommuteTimes ? "Hide" : "Show";

  for (var i = 0; i < all.length; i++) {
    var className = all[i].className;
    var highlightedClass = " highlighted";
    if (className.indexOf(highlightedClass) !== -1) {
      className = className.replace(highlightedClass, "");
    }
    if (showCommuteTimes) {
      className += " highlighted";
    }
    all[i].className = className;
  }

  document.getElementById("toggle-duration").innerHTML = toggleVerb + " Commute Times";

  return false;
}

function checkIfReceivedSchedule() {
  var receivedSchedules = $("#schedule-wrapper");

  while (receivedSchedules.length === 0) {
    setTimeout(checkIfReceivedSchedule, 500);
    return;
  }

  didReceiveSchedule();
}

var SECTION_CLASS_NAME = 'schedule-section-wrapper';

function didReceiveSchedule() {
  storeInput();
  resetUI();

  var days = new Sections(SECTION_CLASS_NAME).grouped();

  for (var dayKey in days) {
    days[dayKey].addDurationOverlays();
  }

  $("li.page").bind("click", checkIfReceivedSchedule);
}

function storeInput() {
  var minutes = parseInt($("#first-class").val());
  var address = $("#where-live").val();

  preferences.setPreference(HOME_ADDRESS_KEY, address);
  preferences.setPreference(MINUTES_TO_FIRST_CLASS_KEY, minutes);
}

function resetUI() {
  var toggleVerb = preferences.isPreferenceTrue(SHOW_COMMUTE_TIMES_KEY) ? "Hide" : "Show";

  $("a.background").remove();
  $("#toggle-duration").remove();
  $("div#course-pane").append("<a id='toggle-duration' href='#'>" + toggleVerb + " Commute Times</a>");
  $("#toggle-duration").click(toggleCommuteTimes);
}

function inputElement(name, placeholder, preferenceKey) {
  var element = document.createElement("input");
  element.setAttribute("type", "text");
  element.setAttribute("id", name);
  element.setAttribute("class", "djl-input");
  element.setAttribute("name", name);
  element.setAttribute("placeholder", placeholder);
  element.setAttribute("value", preferences.getPreference(preferenceKey));

  return element;
}


// Prototype extensions
Array.prototype.getUnique = function(){
  var u = {}, a = [];
  for(var i = 0, l = this.length; i < l; ++i){
    if(u.hasOwnProperty(this[i])) {
      continue;
    }

    a.push(this[i]);
    u[this[i]] = 1;
  }
  return a;
}

String.prototype.sansNumberWords = function() {
  var words = this.split(" ");

  for (var i = words.length - 1; i >= 0; i--) {
    if (/\d/.test(words[i])) {
      words.splice(i, 1);
    }
  }

  return words.join(" ");
};

Element.prototype.firstChildOfClass = function(className) {
  return this.getElementsByClassName(className)[0];
};

Element.prototype.firstChildWithTag = function(tagName) {
  return this.getElementsByTagName(tagName)[0];
};

// On load
window.addEventListener("load", function(e) {
  var css = 'a.background { background: #27AE60; color: white; width: 100%; height: 100%; margin: 0px auto; position: absolute; top: 0; left: 0; opacity: 0.1; text-align: center;} a.background.bad {background: #C0392B;} a.background.okay {background: #F39C12;} a.background.last-class {background: #9B59B6;} div.duration {pointer-events: none; position: absolute; bottom: 0; margin: 0px auto; text-align: center; display: block; width: 100%; cursor: default;} a.background:hover {opacity: 0.8;} a.background.highlighted {opacity: 0.8;} a.background.highlighted:hover {opacity: 0.2;} p.details {margin: 0px auto; font-size: 0.65em;} p.details.minutes {font-size: 1em; font-weight: bold;} input.djl-input {width: 100%;}'
    , head = document.getElementsByTagName('head')[0]
    , style = document.createElement('style');

  style.type = 'text/css';
  if (style.styleSheet){
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }

  head.appendChild(style);

  var form = document.createElement("form");
  form.setAttribute("id", "home-search");
  form.setAttribute("action", "");
  form.setAttribute("method", "get");
  form.setAttribute("onsubmit", "return false;");
  
  var whereLive = inputElement("where-live", "Where do you live?", HOME_ADDRESS_KEY);
  var firstClass = inputElement("first-class", "Max commute for first class? (minutes)", MINUTES_TO_FIRST_CLASS_KEY);

  var searchDiv = document.createElement("div");
  searchDiv.appendChild(whereLive);
  searchDiv.appendChild(firstClass);

  var clearDiv = document.createElement("div");
  clearDiv.setAttribute("class", "clear-both");

  form.appendChild(searchDiv);
  form.appendChild(clearDiv);

  document.getElementById("course-pane").appendChild(form);
}, false);

$("#generate-submit").click(checkIfReceivedSchedule);
