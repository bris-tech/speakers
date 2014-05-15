var ko = ko || {}, Trello = Trello || {};
function ViewModel() {
	var self = this, meetupUsers = [], trelloCards = {}, trelloLists = {}, findSpeakers, addTrackedSpeaker;
	self.meetupKey = ko.observable(localStorage["meetupKey"] || "");
	self.loggedIn = ko.observable(false);
	self.notLoggedIn = ko.computed(function() {
		return !self.loggedIn();
	});
	self.connect = function() {
		if (!Trello.authorized()) {
			Trello.authorize({
				type: "popup",
				success: self.onAuthorize,
				scope: {write: true, read: true}
			});
		}
		localStorage["meetupKey"] = self.meetupKey();
	};
	self.potentialSpeakers = ko.observableArray([]);
	self.trackedSpeakers = ko.observableArray([]);
	self.loadedTrelloLists = ko.observable(false);
	self.loadedTrelloCards = ko.observable(false);
	self.loadedMeetup = ko.observable(false);
  self.filters = ko.observableArray((localStorage["filters"] || "^no$,^not?\\W,^[-.]$,sorry|shy").split(","));
	self.filters.subscribe(function() {
		localStorage["filters"] = self.filters();
	});
	findSpeakers = function() {
		var trackedSpeaker, i, meetupUser, trelloCard;
		if (self.loadedTrelloCards() && self.loadedTrelloLists() && self.loadedMeetup()) {
			meetupUsers.sort(function(a,b) {
				return a.name.localeCompare(b.name);
			});
			for (i = 0; meetupUser = meetupUsers[i]; i++) {
				trelloCard = trelloCards["meetupId-"+meetupUser["member_id"]];
				if (!trelloCard) {
					self.potentialSpeakers.push(meetupUser);
				} else {
					addTrackedSpeaker(trelloCard, meetupUser);
				}
			}
		}
	}
	addTrackedSpeaker = function(trelloCard, meetupUser) {
		trackedSpeaker = $.extend({state: trelloLists[trelloCard.idList]}, trelloCard, meetupUser);
		self.trackedSpeakers.push(trackedSpeaker);
	};
	self.speakers = ko.computed(function() {
		var regexes = [], filters = self.filters(), speakers = [], potentials = self.potentialSpeakers(), filtered, i, j, s, filter, regex;
		for (i=0; filter = filters[i]; i++) {
			regexes.push(new RegExp(filter, "i"));
		}
		for (i=0; s = potentials[i]; i++) {
			filtered = false;
			for (j=0; regex = regexes[j]; j++) {
				if (!s.answers || !s.answers[1] || !s.answers[1].answer || regex.test(s.answers[1].answer)) {
					filtered = true;
					break;
				}
			}
			if (!filtered) {
				speakers.push(s);
			}
		}
		return speakers;
	});
	self.loadedTrelloCards.subscribe(findSpeakers);
	self.loadedTrelloLists.subscribe(findSpeakers);
	self.loadedMeetup.subscribe(findSpeakers);
	self.onAuthorize = function() {
		var loadMeetup;
		self.loggedIn(true);
		Trello.get("/boards/VcltdZag/cards", function(data) {
			for (var i = 0, item; item = data[i]; i++) {
				trelloCards["meetupId-"+item.desc.replace(/ .+$/, "")] = item;
			}
			self.loadedTrelloCards(true);
		});
		Trello.get("/boards/VcltdZag/lists?fields=name", function(data) {
			for (var i = 0, item; item = data[i]; i++) {
				trelloLists[item.id] = item.name.replace(/ .+$/, "");
				if (item.name === "Interested") {
					self.interestedListId = item.id;
				}
			}
			self.loadedTrelloLists(true);
		});
		loadMeetup = function(data) {
			for (var i = 0, item; item = data.results[i]; i++) {
				meetupUsers.push(item);
			}
			if (data.meta.next) {
				$.ajax({url: data.meta.next, dataType: "jsonp"}).done(loadMeetup);
			} else {
				self.loadedMeetup(true);
			}
		};
		$.ajax({
			url: "https://api.meetup.com/2/profiles?group_urlname=bristech&only=profile_url,answers,name,member_id&sign=true&key="+localStorage["meetupKey"],
			dataType: "jsonp"
		}).done(loadMeetup);
	};
	self.newFilter = ko.observable();
	self.addFilter = function() {
		self.filters.push(self.newFilter());
		self.newFilter("");
	};
	self.removeFilter = function(data) {
		self.filters.remove(data);
	};
	self.addToTrello = function(meetupUser) {
		Trello.post("/lists/"+self.interestedListId+"/cards", {
			desc: meetupUser["member_id"] + " http://www.meetup.com/bristech/members/" + meetupUser["member_id"],
			name: meetupUser.name + " - " + meetupUser.answers[1].answer
		}, function(trelloCard) {
			self.potentialSpeakers.remove(function(item) { return item["member_id"] === meetupUser["member_id"]; });
			addTrackedSpeaker(trelloCard, meetupUser);
		}, alert);
	};
	if (localStorage["meetupKey"] && Trello.authorized()) {
		self.onAuthorize();
	} else if (localStorage["meetupKey"]) {
		self.connect();
	}
}
ko.applyBindings(new ViewModel());
