function ViewModel() {
	var self = this;
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
	var meetupUsers = [];
	var trelloCards = {};
	self.loadedTrello = ko.observable(false);
	self.loadedMeetup = ko.observable(false);
	self.filters = ko.observableArray(localStorage["filters"] || ["^no$", "^not?\W", "^[-.]$", "sorry|shy"]);
	self.filters.subscribe(function() {
		localStorage["filters"] = self.filters();
	});
	function findSpeakers() {
		if (self.loadedTrello() && self.loadedMeetup()) {
			for (var i = 0, meetupUser; meetupUser = meetupUsers[i]; i++) {
				if (!trelloCards["meetupId-"+meetupUser.member_id]) {
					self.potentialSpeakers.push(meetupUser);
				}
			}
		}
	}
	self.speakers = ko.computed(function() {
		var regexes = [], filters = self.filters();
		for (var i=0, filter; filter = filters[i]; i++) {
			regexes.push(new RegExp(filter, "i"));
		}
		var speakers = [], potentials = self.potentialSpeakers();
		for (var i=0, s; s = potentials[i]; i++) {
			var filtered = false;
			for (var j=0, regex; regex = regexes[j]; j++) {
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
	self.loadedTrello.subscribe(findSpeakers);
	self.loadedMeetup.subscribe(findSpeakers);
	self.onAuthorize = function() {
		self.loggedIn(true);
		Trello.get("/boards/VcltdZag/cards", function(data) {
			for (var i = 0, item; item = data[i]; i++) {
				trelloCards["meetupId-"+item.desc] = item;
			}
			self.loadedTrello(true);
		});
		$.ajax({
			url: "https://api.meetup.com/2/profiles?group_urlname=bristech&only=profile_url,answers,name,member_id&sign=true&key="+localStorage["meetupKey"],
			dataType: "jsonp"
		}).done(function(data) {
			for (var i = 0, item; item = data.results[i]; i++) {
				meetupUsers.push(item);
			}
			self.loadedMeetup(true);
		});
	};
	self.newFilter = ko.observable();
	self.addFilter = function() {
		self.filters.push(self.newFilter());
		self.newFilter("");
	};
	self.removeFilter = function(data) {
		self.filters.remove(data);
	};
	if (localStorage["meetupKey"] && Trello.authorized()) {
		self.onAuthorize();
	} else if (localStorage["meetupKey"]) {
		self.connect();
	}
}
ko.applyBindings(new ViewModel());