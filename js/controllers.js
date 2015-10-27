"use strict";

angular.module('kcApp.dashboard')

.controller('DashboardQuotesController', ['$scope', '$http', 'currentSession', 'Quote', 'RelativeTime',
	function($scope, $http, currentSession, Quote, RelativeTime) {

		var quoteEndStates = ['DEAL WON','AGENT - REJECTED','CUSTOMER - REJECTED'];
		var unreadCount;
		var $countEl = $('.js-quote-count');

		$scope.bizid = currentSession.user.bizid;
		$scope.relativeTime = RelativeTime;

		$scope.quoteStatusList = ['NEW','PROCESSING'].concat(quoteEndStates);
		$scope.filtersList = ['ALL','READ','UNREAD', 'DELETED'];

		$scope.quotes = [];
		$scope.currentQuote = null;

		Quote.query({
			bizid: $scope.bizid
		}, function(response) {
			response.forEach(updateHtmlClass);
			$scope.quotes = response;
			$scope.filteredQuote = $scope.quotes;
			// if ($scope.filteredQuote && $scope.filteredQuote.length > 0) {
			//     $scope.setCurrentQuote($scope.filteredQuote[0]);
			// } else {
			//     $scope.currentQuote = null;
			// }
		});


		/* --- action end points  --- */

		$scope.setCurrentQuote = function(quote) {
			$scope.currentQuote = quote;

			// update the quote view_status in the db
			if(quote.view_status === 'UNREAD') {
				updateQuote({ 'view_status' : 'READ' });
				updateUnreadCount();
			}

			// Reset the note form
			resetAddNoteForm();
			$('.quote-display').addClass('active').on('scroll', function(e) {
				e.stopPropagation();
			});
		};

		$scope.isCurrentQuote = function (quote) {
			return $scope.currentQuote && ($scope.currentQuote.quote_id === quote.quote_id);
		};

		function resetAddNoteForm() {
			if($scope.note) $scope.note.text = '';
		}


		/* ------ CRUD ops ------ */

		// TODO: Validate the state changes before doing this*
		$scope.setQuoteStatus = function(status) {
			var currViewStatus = $scope.currentQuote.view_status;

			var quote = {};
			quote.quote_status = status;
			if(currViewStatus == 'UNREAD') {
				quote.view_status = 'READ';
			}

			updateQuote(quote);
		};

		$scope.deleteCurrentQuote = function(){
			updateQuote({ 'view_status': 'DELETED' });
		};

		// updates the current quote
		function updateQuote(quote) {

			// default params
			quote.bizid = $scope.bizid;
			quote.id = $scope.currentQuote.quote_id;

			// Update the current quote in db as well as in UI model
			Quote.update(quote, function(response){
				if(response && response.quote_id) {
					$scope.currentQuote.view_status = response.view_status;
					$scope.currentQuote.quote_status = response.quote_status;
					updateHtmlClass($scope.currentQuote);
				}
			});
		}
		$scope.formVisible = null;
		$scope.showForm = function() {
			$scope.formVisible = true;
		}

		// Adds new note to the current quote
		$scope.addNewNote = function() {
			var quote = {};
			quote.bizid = $scope.bizid;
			quote.id = $scope.currentQuote.quote_id;
			quote.note = $('#quoteNote').val();

			// Add note to the DB and the UI model
			Quote.saveNote(quote, function(response){
				if(response && response.quote_id) {
					$scope.currentQuote.biz_note = response.biz_note;
				}
			});

			resetAddNoteForm();
			$scope.formVisible = null;
			//logStatus();
		};

		$scope.closeNote = function() {
			$scope.formVisible = null;
		}

		// $scope.getNote = function() {
		//     $scope.quoteNote = $('.quote-add-note').val().trim();
		// }


		/* --- Filtering criteria --- */

		$scope.filterCriteria = null;

		$scope.setFilterCriteria = function(criteria) {
			$scope.currentQuote = null;
			$scope.filterCriteria = criteria;
			$scope.filteredQuote = $scope.$eval("quotes | filter:quotesFilter");
			// if ($scope.filteredQuote.length) {
			//     $scope.setCurrentQuote($scope.filteredQuote[0]);
			// } else {
			//     $scope.currentQuote = null;
			// }
		};

		$scope.quotesFilter = function(quote) {
			var fltr = $scope.filterCriteria;
			return fltr ? (quote.quote_status === fltr) : true;
		};

		/* --- Selection Criteria --- */

		$scope.toggleAllQuotesSelection = function(e) {
			var state = e.target.checked;
			$('.quote-item-checkbox').prop('checked', state);
		};

		$scope.updateSelectedQuotesViewStatus = function(status) {
			var ids = [];
			$('.quote-item-checkbox:checked').each(function(i, cb){
				var qid = $(cb).attr('data-qid');
				ids.push(qid);
			});

			if(ids && ids.length > 0 && status) {
				var body = {};
				body.bizid = $scope.bizid;
				body.quote_ids = ids;
				body.view_status = status;

				Quote.updateBulk(body, function(response){
					if(ids.length == response.count) {
						updateModeObjects(ids, {'view_status' : status});
					}
				});
			}
		};


		/* ------ Utility Methods -------- */

		// updates the model objects in the UI to be in sync with backend
		function updateModeObjects(ids, obj) {
			if(!ids || ids.length <= 0 || !obj)
			  return;

			var qs = $scope.quotes.filter(function(q){
				return (ids.indexOf(q.quote_id) != -1);
			});

			qs.forEach(function(q){
				if(obj.view_status)
				  q.view_status = obj.view_status;

				if(obj.quote_status)
				  q.quote_status = obj.quote_status;
			});
		}

		function htmlClass(str) {
			return str.toLowerCase().replace(/\s/g, '');
		}

		function updateHtmlClass(q) {
			q._quote_class = htmlClass(q.quote_status);
			q._view_class = htmlClass(q.view_status);
			if (quoteEndStates.indexOf(q.quote_status) !== -1) {
				q._isEnd = true;
			}
		}

		// Validate the allowed states for the current quote
		$scope.statusValidator = function(status) {
			var q = $scope.currentQuote, indx, currentIndx, isEnd;
			if (!q) {
				return true;
			}
			// If the status is the current status of the quote, don't show it
			if (q.quote_status === status) {
				return false;
			}
			// Index of the passed status
			indx = $scope.quoteStatusList.indexOf(status);
			// Index of the current quote's status
			currentIndx = $scope.quoteStatusList.indexOf(q.quote_status);
			// If requesting any of the previous state, don't allow
			if (indx < currentIndx) {
				return false;
			}
			// If the current quote's status is any of the end states, don't allow
			// new or processing
			if (currentIndx > 1) {
				return false;
			}
			return true;
		};

		$scope.closeQuoteView = function() {
			$('.quote-display').off('scroll').removeClass('active');
		};

		function updateUnreadCount() {
			$countEl.text(function(i, count) {
				unreadCount = parseInt(count, 10);
				unreadCount -= 1;
				return unreadCount ? unreadCount : 0;
			});
			if (!unreadCount) {
				$countEl.parent().hide();
			}
		}
	}
])

.controller('suggestProfilePic', ['$scope', '$http','$rootScope','$timeout',
	function($scope, $http, $rootScope, $timeout) {
		$scope.businessObj = { chosen_profile_pic: '' };
		$rootScope.suggestAvatar = false;
		$scope.numTries = 0;
		var spinner;
		$scope.getProfile = function(){
			if (!spinner) {
				var target = $('.crawled-avatar')[0];
				spinner = new Spinner({color: '#fff'}).spin(target);
			}
			$http.get('/business/dashboard/profile/suggest-avatar?bizid='+$("#bizID").val())
				.success(function(response) {
					if (response.status == "success" ){
						$rootScope.suggestAvatar = true;
						var onboardMsgShown = $(".signup-alert").hasClass('in');
						$scope.business.crawled_images = response.crawled_images;
						$scope.businessObj.img_list = response.crawled_images_cloudinary;
						$scope.businessObj.crawledCDN_images = response.crawled_images;
						$scope.businessObj.navbarUrl = response.navbarUrl;

						if(!onboardMsgShown) {
							if ($scope.business.crawled_images.length >= 1 ){
								spinner.stop();
								// $('.file-upload').css('z-index', 1)
								$('.que-mark').css('z-index', 3);
								$('.crawled-avatar img').attr('src', getCollageUrl($scope.businessObj.img_list));
							}
						}
					} else if(response.status == "error") {
						console.log($scope.numTries);
						if ($scope.numTries < 3) {
							$scope.numTries++;
							$timeout(function() { $scope.getProfile(); }, 15000); // wait 15 seconds than call ajax request again
						} else {
							spinner.stop();
						}
					}
				})
				.error(function() {
					spinner.stop();
				});
		};
		$scope.initProfilePic = function(){
				$('.que-mark').css('z-index', 3);
				$('.crawled-avatar img').attr('src', getCollageUrl($scope.businessObj.img_list));
		}

		$scope.showPopup = function() {
			$("#suggestProfilePic-widget").modal();
		}

		$timeout(function(){
			if (!$scope.businessObj.img_list.length) {
				$scope.getProfile();
			} else {
				$scope.initProfilePic();
			}
		}, 10)


		function getCollageUrl(crawled_images) {
			return $.cloudinary.url(crawled_images[0], {
						type : 'fetch',
						secure:'true',
						transformation: [
								  {width: 155, height: 170, crop: "fill"}
								 ]});
		}
		$scope.getCdnAvatar = function() {
			var checkedInput = $('input[name="chosen_profile_pic"]:checked');
			$scope.cdnURL = checkedInput.attr("data-crawled-img");
			$scope.navURL = checkedInput.attr("data-navbar-img");
			$scope.cloundinaryURL = checkedInput.val();
		}

		$scope.closeSuggestion = function(){
			$("#suggestProfilePic-widget").modal('toggle');
		}

		$scope.updateAvatar = function(){
			$http.post('/business/dashboard/profile/update_crawled_image',{"avatarURI":$scope.cdnURL})
				.success(function(response) {
					$('.js-profile-avatar').attr('src', $scope.cloundinaryURL);
					$('.js-navbar-avatar').attr('src', $scope.navURL );
					$('.crawled-avatar-container').remove();
					$("#suggestProfilePic-widget").modal('toggle');
				})
		}
	}
])

.controller('DashboardController', ['$scope', '$http',
	function($scope, $http) {
		// Spinner
		var spinner;

		$scope.business = {};
		$scope.is_crawled_image = "true";
		$scope.crawled_images = [];

		$scope.saveAvatar = function(form) {
			var $form = $(document.forms.dashboardAvatarForm);
			var $progress = $('.js-image-progress'),
				$percent = $progress.find('.js-percent');

			function setProgress(percent) {
				var percentVal = percent + '%';
				$progress.attr('aria-valuenow', percent).css('width', percentVal);
				$percent.text(percentVal);

				if (percent) {
					$progress.show();
				} else {
					$progress.hide();
				}
			}

			function updateImage(response) {
				$('.js-profile-avatar').attr('src', response.profileUrl);
				$('.js-navbar-avatar').attr('src', response.navbarUrl);
				if ( $('#suggestProfilePic-widget').hasClass('in') ) {
					$('.crawled-avatar-container').remove();
					$("#suggestProfilePic-widget").modal('toggle');
				}
				setProgress(0);
				spinner.stop();
			}

			$form.ajaxSubmit({
				beforeSend: function() {
					setProgress(0);
					if (!spinner) {
						var target = $('.file-upload-wrapper')[0];
						spinner = new Spinner({color: '#fff'}).spin(target);
					}
				},
				error: function(err) {
					if (err.status === 413) {
						alert("Image too large! Please upload an image smaller than 8MB");
					} else {
						alert("Error uploading image!");
					}
					setProgress(0);
					spinner.stop();
				},
				success: function(res, textStatus, xhr) {
					// The great IE does not throw the error if its a 413
					// The success handler is invoked with the nginx html error
					// as the response. Hence, we have to check for the error code
					// here as well
					try {
						res = JSON.parse(res);
						// If we get the URL directly from the request, update it
						if (res.status === 'success') {
							if (res.message === 'streaming_upload') {
								updateImage(res);
							}
							// Get the new avatar url, but give the task manager
							// sometime to upload it. Ideally, this should be a refresh
							else if (res.message === 'queued_upload') {
								$http.get('/business/dashboard/profile/avatar').success(updateImage);
							}
						} else {
							alert("Error uploading image!");
						}
					} catch(e) {
						if (res.toLowerCase().indexOf("413 request entity too large") !== -1) {
							alert("Image too large! Please upload an image smaller than 8MB");
						}
					}
				},
				uploadProgress: function(event, position, total, percentComplete) {
					setProgress(percentComplete);
				}
			});
		};

		$('.file-input-label,.camera-bg')
		.on('mouseover',function(){
			$('.camera-bg').removeClass('hide');
		})
		.on('mouseout',function(){
			$('.camera-bg').addClass('hide');
		})
	}
])

.controller('DashboardLocationController', ['$scope', '$rootScope',
	function($scope, $rootScope) {
		$scope.locations = [];
		$scope.currentLocation = null;

		$rootScope.$on('initializeLocations', function(event, locations) {
			if(locations.length ===1 && !locations[0].address.city && !locations[0].address.state) {
				return;
			}
			locations.forEach(function(loc, i) {
				var displayLabel = '';
				displayLabel += loc.address.street1 ? loc.address.street1 + ', ' : '';
				displayLabel += loc.address.street2 ? loc.address.street2 + ', ' : '';
				displayLabel += loc.address.city ? loc.address.city + ', ' : '';
				displayLabel += loc.address.state ? loc.address.state + ', ' : '';
				displayLabel += loc.address.zipcode ? loc.address.zipcode : '';
				// loc.displayLabel = loc.address.city && loc.address.state
				// 	? (loc.address.street1 + ', ' + loc.address.street2 + ', ' + loc.address.city + ', ' + loc.address.state + ', ' + loc.address.zipcode)
				// 	: ('Location ' + (i + 1))
				loc.displayLabel = displayLabel;
				if (loc.is_default) {
					$scope.currentLocation = loc;
				}
			});
			$scope.locations = locations;

		});

		$scope.setLocation = function(location) {
			// Clear out the carrier & service selectize
			// object on location change.
			$scope.categorySelectize = '';
			$scope.serviceSelectize = '';
			$rootScope.$broadcast('setCurrentLocation', location);
			$scope.currentLocation = location;
		};

		$scope.showAddLocations = function(showExistingLocations) {
			$rootScope.$broadcast('showAddLocations',{showExistingLocations: showExistingLocations});
		};
	}
])

.controller('DashboardProfileController', ['$scope', '$http', '$timeout', 'BusinessProfile', 'SelectizeSuggestCity','$rootScope',
	function($scope, $http, $timeout, BusinessProfile, SelectizeSuggestCity, $rootScope) {
		var biz = $scope.business = {};
		// Reference to all selectize boxes
		// We are saving references to all the selectize
		// boxes for the category and service here
		$scope.selectize = {};
		$scope.locSelectize = {};
		$scope.social = {};
		// Active location points to the current active location
		var activeLocation = $scope.activeLocation = {};

		$scope.work_time =  {
			day : "",
			start_time : "",
			end_time : ""
		};
		$scope.weekArr = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

		// All these objets are for clonning business object, on which we edit
		// and copy again this object back to business object while updating
		// profile, so that we can prevent modifying biz object for cancel event.
		$scope.cp_work_time = {};
		$scope.cp_address = {};
		$scope.cp_name = {};
		$scope.cp_contact = {};
		$scope.cp_note = {};
		$scope.cp_groups = {};
		$scope.cp_team = {};

		// Modes -> view/edit/add
		var section = $scope.section = {
			main: 'view',
			contact: 'view',
			services: 'view',
			carriers: 'view',
			team:  'view'
		};

		var socialProviders = {
			facebook: 'https://facebook.com/',
			gplus: 'https://plus.google.com/',
			linkedin: 'https://linkedin.com/',
			twitter: 'https://twitter.com/'
		};

		var socialProvidersRegex = {
			facebook: /(http(s)?:\/\/)?(www.)?facebook.com\/?/,
			gplus: /(http(s)?:\/\/)?(www.)?plus.google.com\/?/,
			linkedin: /(http(s)?:\/\/)?(www.)?linkedin.com\/?/,
			twitter: /(http(s)?:\/\/)?(www.)?twitter.com\/?/
		};

		var addressFields = ['street1','street2','city','state','zipcode'];

		BusinessProfile.query(function(res) {
			$scope.business = biz = res.business;
			// Delete "all" services
			delete res.services.all;
			$scope.servicesList = res.services;
			// Set the default location as active
			for (var i = biz.locations.length - 1; i >= 0; i--) {
				if(biz.locations[i].is_default) {
					$scope.activeLocation = $scope.defaultLocation = biz.locations[i];
					if($scope.activeLocation.team.length) {
						$scope.loadTeamAvatars();
					} else {
						$scope.teams = [];
					}
				}
			}

			$rootScope.$broadcast('initializeLocations', biz.locations);
			loadLocationInfo();
		});

		$scope.loadTeamAvatars = function() {
			$scope.teams =  angular.copy($scope.activeLocation.team);
			for (var i = 0;  i <= $scope.teams.length-1; i++) {
				if($scope.teams[i].avatarUrl) {
					$scope.teams[i].avatarUrl = 'https://res.cloudinary.com/knowncircle/image/fetch/c_thumb,g_faces,h_52,w_52,z_0.8/'+$scope.teams[i].avatarUrl;
				} else {
					$scope.teams[i].avatarUrl = window.kcApp.staticUrl;
				}
			}
		};

		$rootScope.$on('setCurrentLocation', function(event, location) {
			$scope.activeLocation = location;
			loadLocationInfo();
			if($scope.activeLocation.team.length) {
				$scope.loadTeamAvatars();
			} else {
				$scope.teams = [];
			}
		});

		$rootScope.$on('showAddLocations', function(event, args) {
			$scope.showAddLocations(args.showExistingLocations);
		});

		if ($('.signup-alert').length) {
			$('.signup-alert').modal({ backdrop: 'static', keyboard: false })
				.one('click', '.btn-ok', function (e) {
					if(!$scope.emailSign) {
						$scope.checkSignatureFields();
					}
					if ($("#suggestProfilePic-widget").length && $rootScope.suggestAvatar) {
					}
				});
		}

		var locationRegex = /\d$/;
		var locationSelectize = {
			copyClassesToDropdown: false,
			valueField: 'text',
			labelField: 'text',
			delimiter: '|',
			create: false,
			highlight: false,
			maxItems: 1,
			loadThrottle: 300,
			load: SelectizeSuggestCity,
			onChange: function(location) {
				var sel = $scope.locSelectize[this.settings.selObj];
				if (!location) {
					sel.clearOptions();
					return;
				}
				// If location doesn't contain a zipcode
				if (!locationRegex.test(location)) {
					var zipcodes = sel.options[location].zipcodes;
					if (zipcodes && zipcodes.length) {
						sel.clearOptions();
						$.map(zipcodes, function(zip) {
							sel.addOption({
								text: location + ', ' + zip
							});
						});
						sel.focus();
						sel.setValue(location + ', ' + zipcodes[0]);
					}
				}
			}
		};

		$scope.selectizeCities = function() {
			$scope.locSelectize = {};
			$timeout(function() {
				$('.location.row').each(function(index){
					var loc = 'location' + index;
					var opts = angular.copy(locationSelectize);
					opts.selObj = loc;
					var locationVal = $(this).find('.js-location').val();
					// console.log(locationVal);
					if(!$(this).find('.js-location')[0].selectize) {
						$scope.locSelectize[loc] = $(this).find('.js-location').selectize(opts)[0].selectize;
						$scope.locSelectize[loc].setValue(locationVal);
					}
				});
			}, 5);
		}

		$scope.toggleOtherLocations = function() {
			$('.other-locations').toggle();
		}

		$scope.showOtherLocations = function() {
			$('.other-locations').show();
			$timeout(function() {
				angular.element(document).on('click', $scope.hideOtherLocations);
			}, 10);
		}

		$scope.hideOtherLocations = function() {
			$('.other-locations').hide();
			angular.element(document).off('click', $scope.hideOtherLocations);
		}

		$scope.showAddLocations = function(showExistingLocations) {
			$scope.isEditingLocations = showExistingLocations;
			if(showExistingLocations)
				$('.js-loc-modal-title').html('Add/Edit Locations');
			else
				$('.js-loc-modal-title').html('Add Locations');
			if(!$scope.$modal)
				$scope.$modal = $('.js-add-locations');
			$scope.locations = [];
			if($scope.isEditingLocations) {
				angular.forEach($scope.business.locations, function(location) {
					var loc = [];
					angular.forEach(['city','state','zipcode'], function(field) {
						if (location.address[field]) {
							this.push(location.address[field]);
						}
					}, loc);
					$scope.locations.push({
						_id: location._id,
						is_default: location.is_default,
						street1: location.address.street1,
						street2: location.address.street2,
						city: loc.join(', '),
						locationCode: location.location
					});
				});
			}else {
				$scope.locations.push({
					street1: '',
					street2: '',
					city: '',
					locationCode: ''
				});
			}
			$scope.$modal.modal('show');
			$scope.selectizeCities();
		};

		$scope.closeLocationsModal = function() {
			if(!$scope.$modal)
				$scope.$modal = $('.js-add-locations');
			$scope.locSelectize = {};
			// $scope.locations = [];
			$scope.$modal.modal('hide');
		}

		function convertToSlug(text) {
		    return text
		        .toLowerCase()
		        .replace(/ /g,'-')
		        .replace(/[^\w-]+/g,'');
		}

		function getNewLocation(location) {
			var loc = location.city.split(/,\s?/);
			var newLocation = {
				address: {
					street1: location.street1,
					street2: location.street2,
					city: loc[0],
					state: loc[1],
					zipcode: loc[2]
				},
				location: location.location,
				bizid: $scope.business.bizid,
				groups: $scope.defaultLocation.groups || [],
				personal_note: $scope.defaultLocation.personal_note || '',
				phone: $scope.defaultLocation.phone || '',
				services: $scope.defaultLocation.services || {},
				social: $scope.defaultLocation.social || {},
				team: [],
				timezone: $scope.defaultLocation.timezone || '',
				website: $scope.defaultLocation.website || '',
				working_hrs: $scope.defaultLocation.working_hrs || []
			}
			return newLocation;
		}

		function validateNewLocations() {
			var validLocations = true;
			angular.forEach($scope.locations, function(location) {
				if(!location.city) {
					validLocations = false;
					return;
				}
			});
			return validLocations;
		}

		$scope.saveLocations = function() {
			var locationCounts = {};
			if(!$scope.isEditingLocations) {
				for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
					var slug = convertToSlug($scope.business.locations[i].address.city.split(/,\s?/)[0]);
					locationCounts[slug] = locationCounts[slug] ? locationCounts[slug]+1 : 1;
				};
			}
			for (var i = 0, length = $scope.locations.length; i < length; i++) {
				var slug = convertToSlug($scope.locations[i].city.split(/,\s?/)[0]);
				locationCounts[slug] = locationCounts[slug] ? locationCounts[slug]+1 : 1;
				$scope.locations[i].location = slug + '-' + locationCounts[slug];
			};
			if($scope.isEditingLocations) {
				for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
					for (var j = $scope.locations.length - 1; j >= 0; j--) {
						if($scope.business.locations[i]._id === $scope.locations[j]._id && $scope.locations[j].city) {
							$scope.business.locations[i].address.street1 = $scope.locations[j].street1;
							$scope.business.locations[i].address.street2 = $scope.locations[j].street2;
							var loc = $scope.locations[j].city.split(/,\s?/);
							$scope.business.locations[i].address.city = loc[0];
							$scope.business.locations[i].address.state = loc[1];
							$scope.business.locations[i].address.zipcode = loc[2];
							$scope.business.locations[i].location = $scope.locations[j].location;
							if($scope.locations[j]._id && $scope.locations[j]._id === $scope.activeLocation._id) {
								$scope.activeLocation.address.street1 = $scope.locations[j].street1;
								$scope.activeLocation.address.street2 = $scope.locations[j].street2;
								$scope.activeLocation.address.city = loc[0];
								$scope.activeLocation.address.state = loc[1];
								$scope.activeLocation.address.zipcode = loc[2];
								$scope.activeLocation.location = $scope.locations[j].location;
							}
							$scope.locations[j].edited = true;
						}
					};
				};
				var hasDefault = false;
				for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
					hasDefault = $scope.business.locations[i].is_default;
					if($scope.business.locations[i].deleted && !hasDefault){
						$scope.business.locations.splice(i, 1);
					}
				};
				for (var i = $scope.locations.length - 1; i >= 0; i--) {
					if(!$scope.locations[i].edited && $scope.locations[i].city){
						$scope.business.locations.push(getNewLocation($scope.locations[i]));
					}
				};
			}else {
				for (var i = $scope.locations.length - 1; i >= 0; i--) {
					$scope.business.locations.push(getNewLocation($scope.locations[i]));
				};
			}
			// console.log(JSON.parse(JSON.stringify($scope.business)));
			if($scope.business.locations.length){
				$scope.save()
					.then(function(res, status) {
						if(res.data.status === 'success'){
							$scope.business = res.data.business;
							for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
								if($scope.business.locations[i].is_default) {
									$scope.activeLocation = $scope.defaultLocation = $scope.business.locations[i];
									// Strangely social & services properties are not there(if empty)
									// in the business.locations object even it was sent from node
									// controller. That's why adding those properties explicitly.
									if(!$scope.activeLocation.social) {
										$scope.activeLocation['social'] = {};
									}
									if(!$scope.activeLocation.services) {
										$scope.activeLocation['services'] = {};
									}
									updateProfession($scope.business.locations[i].services, true);
								}
							}
							$scope.closeLocationsModal();
							$rootScope.$broadcast('initializeLocations', $scope.business.locations);
							setAddress($scope.activeLocation.address);
							// $rootScope.$broadcast('setCurrentLocation', $scope.business.locations[$scope.business.locations.length-1]);
						}
					});
			} else {
				console.log('Something went terribly wrong...trying to save profile with 0 locations');
			}
		}

		$scope.removeLocation = function(selectedIndex) {
			if($scope.locations.length > 1){
				var locationCode = $scope.locations[selectedIndex].locationCode;
				if(locationCode){
					for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
						if($scope.business.locations[i].location === locationCode){
							if($scope.business.locations[i].is_default){
								alert('You cannot delete the default location. Please change the default location and delete this.');
								return;
							}
							$scope.business.locations[i].deleted = true;
						}
					};
				}
				$scope.locations.splice(selectedIndex, 1);
				delete($scope.locSelectize['location'+selectedIndex]);
			}else {
				alert('You have to have at least one location');
			}

		}

		$scope.addNewLocation = function() {
			var hasEmptyCity = !(validateNewLocations());
			if(hasEmptyCity){
				alert('Please fill in empty locations before adding a new one');
				return;
			}
			$scope.locations.push({street1: '', street2: '', city: '', locationCode: 'new'});
			$scope.selectizeCities();
		}

		// $scope.setDefaultLocation = function() {
		// 	console.log($scope.activeLocation.location);
		// 	var promise = $http.post('/business/profile/' + biz.bizid + '/location', $scope.activeLocation.location);
		// 	promise.success(function(data, status) {
		// 		angular.forEach($scope.business.locations, function(location) {
		// 			location.is_default = false;
		// 		});
		// 		$scope.activeLocation.is_default = true;
		// 	});
		// 	promise.error(function(error, status) {
		// 	})
		// 	promise.then(function() {

		// 	});
		// }

		$scope.saveSignature = function() {
			var selected_fields = ["ownerName", "name", "address", "phone", "kc"];
			var template_name =  "split_card";
			$http.post('grow/email_signature', {template_name: template_name, selected_fields: selected_fields})
			.success(function(response, status) {
				//location.reload();
			}).error(function(error, status) {

			});
		};

		$scope.checkSignatureFields = function() {
			var bAddr = $scope.activeLocation.address;
			var addr = [bAddr.street1, bAddr.street2, bAddr.city, bAddr.state, bAddr.zipcode].filter(function(a){ if(a) return a; }).join(" ");
			if($scope.business.name && addr && $scope.activeLocation.phone) {
				$scope.saveSignature();
			}
		};

		function loadLocationInfo() {
			// Cleanup
			$scope.activeLocation.services = $scope.activeLocation.services || {};
			$scope.activeLocation.groups = $scope.activeLocation.groups || [];
			$scope.activeLocation.social = $scope.activeLocation.social || {};
			setAddress($scope.activeLocation.address);
			cleanupBizUrls();
			cleanupSocialUrls();
		}

		$scope.servicesForCategory = function(naics) {
			return $scope.servicesList[naics].services;
		};

		$scope.$watch('mode', function(mode) {
			switch (mode)
			{
				case 'mode.edit.business_name':
					$scope.cp_name.name = $scope.business.name;
				break;

				case 'mode.edit.address':
					if (!$scope.selectize.addr) {
						$timeout(function() {
							var opts = angular.copy(locationSelectize);
							opts.selObj = 'addr';
							$scope.locSelectize.addr = $('.js-location-addr').selectize(opts)[0].selectize;
						}, 5);
					}
					$scope.cp_address = angular.copy($scope.activeLocation.address);
				break;

				case 'mode.edit.contact':
					cleanupSocialUrls();
					$scope.cp_contact.phone = $scope.activeLocation.phone;
					$scope.cp_contact.website = $scope.activeLocation.website;
				break;

				case 'mode.edit.working_hrs':
					$scope.cloned_WHL= angular.copy($scope.activeLocation.working_hrs);
					if (!$scope.working_hrs_array || $scope.working_hrs_array.length == 0){
						$timeout(function() {
							//$scope.working_hrs_array  = ( $scope.working_hrs_array ) ? $scope.working_hrs_array  : $scope.business.working_hrs || '';
							$scope.working_hrs_array  =  $scope.activeLocation.working_hrs || [];
						}, 5);
					}
				break;
			}
		});

		// clear working hrs array on location change.
		$scope.clearWorkingHrs = function() {
			$scope.working_hrs_array = [];
		}

		$scope.$watch('section.main', function(m) {
			if (m === 'edit') {
				// if (!$scope.selectize.location) {
				// 	$timeout(function() {
				// 		var opts = angular.copy(locationSelectize);
				// 		opts.selObj = 'location2';
				// 		$scope.selectize.location2 = $('.js-location2').selectize(opts)[0].selectize;
				// 	}, 5);
				// }

				$scope.cp_address = angular.copy($scope.business.address);
				$scope.cp_name.name = $scope.business.name;
			}
		});

		$scope.unescape = function(text) {
			return (text || '').replace(new RegExp('\r?\n','g'), '<br/>');
		};

		$scope.setMode = function(mode) {
			$scope.mode = mode || null;
		};
		$scope.setModeNull = function(){
			$scope.mode = null;
		}

		function setAddress(address) {
			if(!address)
				return;
			var addr = [];
			angular.forEach(addressFields, function(k) {
				if (address[k] && address[k].trim()) {
					addr.push(address[k]);
				}
			});
			$scope.activeLocation.addr = addr;
			// Location denotes the value of the city input which is city, state, zipcode
			var location = [];
			angular.forEach(['city','state','zipcode'], function(field) {
				if (address[field]) {
					this.push(address[field]);
				}
			}, location);
			$scope.activeLocation.address.location = location.join(', ');
		}

		$scope.$watch('activeLocation.services', updateProfession);

		function updateProfession(services, editLocation) {
			if($scope.activeLocation.is_default || editLocation == true){
				var profession = [];
				angular.forEach(services, function(v, naics) {
					if ($scope.servicesList.hasOwnProperty(naics)) {
						profession.push($scope.servicesList[naics].profession);
					}
				});
				$scope.business.profession = profession.join(', ');
			}
		}

		$scope.saveBusinessName = function() {
			$scope.business.name = $scope.cp_name.name;
			$scope.save()
				.then(function() {
					$scope.mode = null;
					$scope.section.main = 'view';
				});
		}

		$scope.saveAddress = function(addr) {
			$scope.activeLocation.address = $scope.cp_address;
			var loc = $scope.cp_address.location.split(/,\s?/);
			$scope.activeLocation.address.city = loc[0];
			$scope.activeLocation.address.state = loc[1];
			$scope.activeLocation.address.zipcode = loc[2];
			$scope.activeLocation.address.location = loc;
			$scope.save()
				.then(function(res, status) {
					if(res.data.status === 'success'){
						$scope.business = res.data.business;
						setAddress($scope.cp_address);
						for (var i = $scope.business.locations.length - 1; i >= 0; i--) {
							if($scope.business.locations[i].is_default) {
								updateProfession($scope.business.locations[i].services, true);
							}
						}
						$rootScope.$broadcast('initializeLocations', $scope.business.locations);
						$scope.mode = null;
						$scope.section.addr = 'view';
					}
				});
		};

		function cleanupURL(url) {
			if (url && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
				url = 'http://' + url;
			}
			return url;
		}

		function cleanupBizUrls() {
			$scope.activeLocation.website = cleanupURL($scope.activeLocation.website);
		}

		$scope.getSocialURL = function(provider) {
			var cleanURL = $scope.activeLocation.social[provider].replace(socialProvidersRegex[provider], '');
			return socialProviders[provider] + cleanURL;
		};

		// Cleanup the social urls for display in edit interface
		// In the edit interface the model is social and not business.social
		// This is because we need to prefix the missing social providers with
		// their base URL
		function cleanupSocialUrls() {
			angular.forEach(socialProviders, function(v, k) {
				if ($scope.activeLocation.social[k]) {
					$scope.social[k] = cleanupURL($scope.activeLocation.social[k]);
				} else {
					$scope.social[k] = v;
				}
			});
		}

		function setSocialUrls() {
			angular.forEach($scope.social, function(v, k) {
				if (!v || !v.trim()) {
					$scope.activeLocation.social[k] = '';
				} else {
					// If they have added their handle to the URL, it is valid.
					var cleanURL = v.replace(socialProvidersRegex[k], '');
					if (cleanURL) {
						$scope.activeLocation.social[k] = cleanupURL(v);
					}
				}
			});
		}

		function formatPhoneNumber(n) {
			//var n = $('#phone').val();
			var s2 = (""+n).replace(/\D/g, '');
			var m = s2.match(/^(\d{3})(\d{3})(\d{4})$/);
			//$scope.activeLocation.phone = (!m) ? null : "(" + m[1] + ") " + m[2] + " " + m[3];
			return (!m) ? null : "(" + m[1] + ") " + m[2] + " " + m[3];
		}

		function updateWorkingHrs(){
			// Sync Business Object Working Hrs with Temporary working hours list before save
			$scope.activeLocation.working_hrs = $scope.working_hrs_array;
		}

		$scope.addWorkingTime = function(){
			// WHL - Working Hours List
			// Use local WHL if there else copy from business WHL
			//$scope.working_hrs_array  =( $scope.working_hrs_array ) ? $scope.working_hrs_array  : $scope.business.working_hrs || [];


			//Clone dummy obj.
			$scope.cp_work_time= angular.copy($scope.work_time);
			//Added validation to have all the 3 filed
			if ( $scope.activeLocation.day && $scope.activeLocation.start_time && $scope.activeLocation.end_time) {
				$scope.cp_work_time.day = $scope.activeLocation.day;
				$scope.cp_work_time.start_time = $scope.activeLocation.start_time;
				$scope.cp_work_time.end_time = $scope.activeLocation.end_time;
				//Remove duplicate entry
				$.grep($scope.working_hrs_array, function(obj) {
					if( obj.day == $scope.activeLocation.day) {
						$scope.removeWorkingTime($scope.activeLocation.day)
						return obj.day == $scope.activeLocation.day;
					} else
						return obj.day == $scope.activeLocation.day;
				});
				//Pushing to temporary WHL
				$scope.working_hrs_array.push($scope.cp_work_time);
				/*console.log("BizObj",$scope.business.working_hrs);
				console.log("Temp",$scope.working_hrs_array);
				console.log('copyofBiz', $scope.cloned_WHL);*/

				var cnt =  $scope.weekArr.indexOf($scope.activeLocation.day)+1;
				$scope.activeLocation.day = $scope.weekArr[cnt] ? $scope.weekArr[cnt] : 'Mon';

			}
		}

		$scope.removeWorkingTime = function(day){
			//Clone temp WHL
			$scope.working_hrs_array  = ( $scope.working_hrs_array ) ? $scope.working_hrs_array  : $scope.activeLocation.working_hrs || [];
			$scope.working_hrs_array = $.grep($scope.working_hrs_array, function(item) {
								  //console.log(item.day, day);
								  return item.day !== day;
							});
		}

		$scope.resetWHL = function(){
			$scope.working_hrs_array  = $scope.cloned_WHL || '';
			$scope.activeLocation.working_hrs  = $scope.cloned_WHL || '';
		}

		$scope.save = function(sec) {
			if (sec === 'contact') {
				$scope.activeLocation.phone = formatPhoneNumber($scope.cp_contact.phone, 'cp_contact.phone');
				$scope.activeLocation.website = $scope.cp_contact.website;
				cleanupBizUrls();
				// When saving, we need to validate the urls in $scope.social.
				// and check if any of the url has changed. Only then do we save the url
				setSocialUrls();
				if(!$scope.emailSign) {
					$scope.checkSignatureFields();
				}

			} else if (sec === 'work_time') {
				updateWorkingHrs();
			} else if (sec === 'note') {
				$scope.activeLocation.personal_note = $scope.cp_note.personal_note;
			} else if (sec === 'carriers') {
				$scope.activeLocation.groups = $scope.cp_groups.groups;
			} else if (sec === 'team') {
				var contact = $scope.cp_team.email;
				if(contact && !validateEmail(contact) && !validatePhone(contact)) {
					alert('Please enter a valid Email or Phone number');
					return;
				}
				if(validatePhone(contact)) {
					$scope.cp_team.email = formatPhoneNumber(contact);
				}
				if(!$scope.cp_team.avatarUrl) {
					$scope.cp_team.avatarUrl = '';
				}
				$scope.activeLocation['team'].push($scope.cp_team);
				$scope.cp_team = {};
				$scope.setMode();
				$scope.section.team = "";
				$scope.loadTeamAvatars();
			}
			// Save
			var promise = $http.post('/business/profile/' + biz.bizid, $scope.business);
			promise.success(function(data, status) {
				$('.js-profile-completion').text(data.business.profileCompletion + '%');
			});
			promise.error(function(error, status) {
			})
			promise.then(function() {
				section[sec] = 'view';
			});
			return promise;
		};

		var servicesOption = {
			create: true,
			multiple: true,
			valueField: 'text',
			labelField: 'text',
			optgroupField: 'category',
			optgroupValueField: 'id',
			optgroupLabelField: 'name',
			render: {
				optgroup_header: function(item, escape) {
					return '<div class="optgroup-header">' +
						'<input type="checkbox" class="select-all">' +
						escape(item.name) +
						'</div>';
				}
			},
			onInitialize: function() {
			},
			plugins: ['optgroup_columns', 'remove_button']
		};

		// $scope.selectizeCommon = {
		// 	create: true
		// };

		$scope.newCategory = {};
		$scope.currentCategory = {};

		$scope.addCategory = function() {
			section.services = 'add';
			if (!$scope.categorySelectize) {
				$timeout(function() {
					$scope.categorySelectize = $('#addNewCategory').selectize()[0].selectize;
				}, 5);
			} else {
				// Using timeout to prevent the $apply in progress error.
				$timeout(function() {
					// Clear both the Category & service selectize objects
					// and also clear the Category selectize field which was
					// filled with the previously added category data.
					$scope.categorySelectize.clear();
					$scope.newCategory.category = '';
					$scope.serviceSelectize = '';
				}, 5);
			}
		};

		$scope.deleteCategory = function(naics) {
			if (!confirm("Delete this category? This action cannot be un-done!")) {
				return false;
			}
			var cat = $scope.activeLocation.services[naics];
			var selectizeCat = $scope.selectize[naics];
			delete $scope.activeLocation.services[naics];
			delete $scope.selectize[naics];
			// Delete carrier groups while deleting the Insurance Category.
			if (naics == '524210') {
				$scope.activeLocation.groups = [];
				var selectizeCarriers = $scope.selectize.carriers;
				$scope.selectize.carriers = '';
			}
			$scope.serviceSelectize = '';
			biz.naics_code.splice(biz.naics_code.indexOf(naics), 1);

			$scope.save()
				.error(function() {
					$scope.activeLocation.services[naics] = cat;
					biz.naics_code.push(naics);
					$scope.selectize[naics] = selectizeCat;
					if (naics == '524210') {
						$scope.selectize.carriers = selectizeCarriers;
					}
				})
				.then($scope.clearCurrent)
				.then(updateProfession($scope.activeLocation.services));
		};

		$scope.saveCategory = function() {
			var naics = $scope.newCategory.category;
			// Validate naics
			if (!$scope.servicesList.hasOwnProperty(naics)) {
				return false;
			}
			$scope.activeLocation.services[naics] = $scope.newCategory.services;
			if ($scope.business.naics_code.indexOf(naics) === -1) {
				$scope.business.naics_code.push(naics);
			}
			$scope.save()
				.error(function() {
					delete $scope.activeLocation.services[naics];
					$scope.business.naics_code.pop();
				})
				.then($scope.clearCurrent)
				.then(function() {
					$scope.section.services = 'view';
					//updateProfession(biz.services);
					updateProfession($scope.activeLocation.services)
				});
		};

		$scope.updateCategory = function() {
			var naics = $scope.currentCategory.naics;
			var backup = angular.copy($scope.activeLocation.services[naics]);
			$scope.activeLocation.services[naics] = $scope.currentCategory.services;
			$scope.save()
				.error(function() {
					$scope.activeLocation.services[naics] = backup;
				})
				.then($scope.clearCurrent);
		};

		$scope.getCurrentMode = function(naics) {
			return $scope.currentCategory && $scope.currentCategory.naics === naics ? 'edit' : 'view'
		};

		$scope.clearCurrent = function() {
			$scope.currentEdit = null;
		};

		$scope.editCategory = function(naics, $index) {
			$scope.currentCategory.naics = naics;
			$scope.currentCategory.services = $scope.activeLocation.services[naics];
			// Initialize the selectize
			if (!$scope.selectize[naics]) {
				$timeout(function() {
					$scope.selectize[naics] = {
						category: $('.js-category-' + naics).selectize()[0].selectize,
						services: $('.js-services-' + naics).selectize(servicesOption)[0].selectize
					};
					addExistingServices($scope.selectize[naics].services, naics);
				}, 5);
			}
			// Add services
			$scope.currentEdit = $index;
		};

		function addExistingServices(sel, naics) {
			// First add all the options available for the service
			angular.forEach($scope.servicesList[naics].services, function(v, k, i) {
				// Add the option group
				sel.addOptionGroup(k, {$order: i, name: k.toUpperCase()});
				// Add all the services
				angular.forEach(v, function(s) {
					sel.addOption({text: s, category: k});
					// sel.addItem(s);
				});
			});
			// Add a custom option group
			sel.addOption("others", {name: "Others"});
			$timeout(function() {
				// Next add all the options for the particular business
				angular.forEach($scope.activeLocation.services[naics], function(s) {
					sel.addOption({text: s});
					sel.addItem(s);
				});
			}, 1);
		}

		$scope.$watch('currentCategory.services',function(val){
			$timeout(function() {
				if(Object.keys($scope.selectize)[0]){
					var naics = Object.keys($scope.selectize)[0];
					var selectize = $scope.selectize[naics].services;
					selectize.$dropdown.on('mousedown', '.select-all', function(e){
						e.preventDefault();
						e.stopPropagation();
						if (!e.target.checked) {
							$(e.target).parent().siblings().each(function(i, el) {
								selectize.addItem(el.getAttribute('data-value'));
							});
						}
					});
				}
			},5);
		});

		$scope.$watch('newCategory.category', function(cat) {
			if (!cat) {
				// Empty the serviceSelectize while deleting the
				// entered category, so that again we can
				// re-initialize the serviceSelectize while
				// adding a new category.
				$scope.serviceSelectize = '';
				return;
			}
			$timeout(function() {
				if (!$scope.serviceSelectize) {
					$scope.serviceSelectize = $('#addNewServices').selectize(servicesOption)[0].selectize;
					$scope.serviceSelectize.$dropdown.on('mousedown', '.select-all', selectAllInCategory);
				}
				// Clear the selectize
				$scope.serviceSelectize.clearOptions();
				$scope.serviceSelectize.clearOptionGroups();
				// For the services, add the category as the key
				angular.forEach($scope.servicesList[cat].services, function(v, k, i) {
					// Add the option group
					$scope.serviceSelectize.addOptionGroup(k, {$order: i, name: k.toUpperCase()});
					// Add all the services
					angular.forEach(v, function(s) {
						$scope.serviceSelectize.addOption({text: s, category: k});
					});
				});
			}, 5);
		});

		$scope.editCarriers = function() {
			if (!$scope.selectize.carriers) {
				$scope.selectize.carriers = $('.js-carriers').selectize({
					create: true,
					labelField: 'value',
					valueField: 'value',
					options: $scope.activeLocation.groups.map(function(g) { return {value: g}; })
				})[0].selectize;
			}
			$timeout(function() {
				$scope.activeLocation.groups.forEach(function(g) {
					$scope.selectize.carriers.addItem(g);
				});
				$scope.section.carriers = 'edit';
			}, 5);

			$scope.cp_groups.groups = $scope.activeLocation.groups;
		};

		$scope.editNote = function() {
			$scope.cp_note.personal_note = $scope.activeLocation.personal_note;
		};


		function selectAllInCategory(e) {
			e.preventDefault();
			e.stopPropagation();

			if (!e.target.checked) {
				$(e.target).parent().siblings().each(function(i, el) {
					$scope.serviceSelectize.addItem(el.getAttribute('data-value'));
				});
			}
		}

		$scope.currentTeam = {};

		function validateEmail(email) {
			var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
			return re.test(email);
		}


		function validatePhone(phone) {
			//var re = /^\d{10}$/;
			var re = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
			return re.test(phone.replace(/\s+/g, ''));
		}


		$scope.clearCurrentTeam = function() {
			$scope.currentTeam = {};
			$scope.currentTeamEdit = null;
			$('.add-section .file-upload').css({'background': ""});
		};

		$scope.editTeam = function(index) {
			$timeout(function() {
				$scope.currentTeam = {};
				$scope.currentTeam = $scope.activeLocation.team[index];
				// if($scope.currentTeam.avatarUrl) {
				// 	$scope.currentTeam.avatarUrl = 'https://res.cloudinary.com/knowncircle/image/fetch/c_thumb,g_faces,h_85,w_85,z_0.8/'+$scope.currentTeam.avatarUrl;
				// } else {
				// 	$scope.currentTeam.avatarUrl = window.kcApp.staticUrl;
				// }
				$scope.currentTeamEdit = index;
			}, 5);
		};

		$scope.updateTeam = function(index) {
			var backup = angular.copy($scope.activeLocation.team[index]);
			// $scope.currentTeam.avatarUrl = $('.update-section img').attr('src');
			var contact = $scope.currentTeam.email;
			if(contact && !validateEmail(contact) && !validatePhone(contact)) {
				alert('Please enter a valid Email or Phone number');
				return;
			}

			if(validatePhone(contact)) {
				$scope.currentTeam.email = formatPhoneNumber(contact);
			}

			$scope.activeLocation.team[index] = $scope.currentTeam;
			$scope.save()
				.error(function() {
					$scope.activeLocation.team[index] = backup;
				})
				.then($scope.clearCurrentTeam)
				.then($scope.loadTeamAvatars);
		};

		$scope.deleteMember = function(index) {
			var backup = angular.copy($scope.activeLocation.team[index]);
			$scope.activeLocation.team.splice(index, 1);
			$scope.save()
				.error(function() {
					$scope.activeLocation.team.push(backup);
				})
				.then($scope.clearCurrentTeam)
				.then($scope.loadTeamAvatars);
		};

		// Reference to the current team image being set
		// so that we can save it when "Done is clicked"
		var uploadedTeamAvatarUrl = null;

		$scope.uploadTeamAvatar = function(type, event) {
			var spinner;
			var timestamp = +new Date();
			var filename = [
				$scope.activeLocation.location || 'default',
				[$scope.activeLocation.team.length, timestamp].join('_')
			].join('/');

			var $form = $(event.target).parents('form');

			uploadedTeamAvatarUrl = filename;
			$form.attr({
				action: '/business/profileAvatar/' + biz.bizid + '?type=team&filename=' + encodeURIComponent(filename)
			});

			$form.ajaxSubmit({
				beforeSend: function() {
					// setProgress(0);
					if (!spinner) {
						var target = $(event.target).parent().parent()[0];
						spinner = new Spinner({color: '#fff'}).spin(target);
					}
				},
				error: function(err) {
					if (err.status === 413) {
						alert("Image too large! Please upload an image smaller than 8MB");
					} else {
						alert("Error uploading image!");
					}
				},
				success: function(res, textStatus, xhr) {
					try {
						res = JSON.parse(res);
						if (res.status === 'success') {
							if (res.message === 'streaming_upload') {
								setTeamAvatar(res);
							} else {
								var gridfilename = encodeURIComponent('biz/team/' + biz.bizid + '/' + filename);
								// Get the new avatar url, but give the task manager
								// sometime to upload it. Ideally, this should be a refresh
								$http.get('/business/dashboard/team/avatar?filename=' + gridfilename)
									.success(function(response) {
										setTeamAvatar(response);
									});
							}
						} else {
							alert("Error uploading image!");
						}
					} catch(e) {
						if (typeof res === 'string' && res.toLowerCase().indexOf("413 request entity too large") !== -1) {
							alert("Image too large! Please upload an image smaller than 8MB");
						} else {
							alert("Error uploading image!");
						}
					}
					//spinner.stop();
				}
			});

			function setTeamAvatar(response) {
				if($scope.section.team === 'add') {
					$scope.cp_team.avatarUrl = response.url;
				} else {
					$scope.currentTeam.avatarUrl = response.url;
				}
				spinner.stop();
			}
		};
	}
])

.controller('DashboardGrowToolsController', ['$scope', '$http',
	function($scope, $http) {
		$scope.saveTempSignature = function() {
			if(!$scope.emailSign) {
				if($('.biz-name').val() && $('.biz-address').val() && $('.biz-phone').val()) {
					var selected_fields = ["ownerName", "name", "address", "phone", "kc"];
					var template_name =  "split_card";
					$http.post('grow/email_signature', {template_name: template_name, selected_fields: selected_fields})
					.success(function(response, status) {
						location.reload();
					}).error(function(error, status) {

					});
				}
			}
		};

		if ($('.signin-modal .alert-modal').length) {
			$('.signin-modal .alert-modal').modal({ backdrop: 'static', keyboard: false })
							.one('click', '.btn-ok', function (e) {
								$scope.saveTempSignature();
							});
		}
	}
])

.controller('DashboardSettingsController', ['$scope',
	function($scope) {
		$scope.settings = {};
		$scope.saveChanges = function(e) {
			e.preventDefault();
			//var form = $scope.form;
			var $currentPassword = $scope.settings.currentPassword;
			var $newPassword = $scope.settings.password;
			var $confirmPassword = $scope.settings.confirmPassword;

			$('#currentPassword, #confirmPassword, #accountPassword').removeClass('required');
			if($newPassword !== undefined) {
				if($newPassword.length !== 0) {
					if($currentPassword === undefined || $currentPassword.length === 0) {
						$('#currentPassword').addClass('required').focus();
						return false;
					} else if($newPassword === $currentPassword) {
						$('#accountPassword').addClass('required').focus();
						return false;
					} else if($newPassword !== $confirmPassword) {
						$('#confirmPassword').addClass('required').focus();
						return false;
					} else {
						document.forms.dashboardSettingsForm.submit();
					}
				} else {
					//document.forms.dashboardSettingsForm.submit();
					if($confirmPassword === undefined || $confirmPassword.length === 0) {
						$('#confirmPassword').addClass('required').focus();
					}
					$('#accountPassword').addClass('required').focus();
					return false;
				}
			} else if($currentPassword !== undefined) {
				if($currentPassword.length !== 0) {
					if($confirmPassword === undefined || $confirmPassword === 0) {
						$('#confirmPassword').addClass('required').focus();
					}
					if($newPassword === undefined || $newPassword === 0) {
						$('#accountPassword').addClass('required').focus();
					}
					return false;
				}
			} else if($confirmPassword !== undefined) {
				if($confirmPassword.length !== 0) {
					if($newPassword === undefined || $newPassword === 0) {
						$('#accountPassword').addClass('required').focus();
					}
					if($currentPassword === undefined || $currentPassword === 0) {
						$('#currentPassword').addClass('required').focus();
					}
					return false;
				}
			} else {
				document.forms.dashboardSettingsForm.submit();
			}
		};

		$scope.passwordMatch = function() {
			if($scope.settings.password && $scope.settings.confirmPassword) {
				if ($scope.settings.password !== $scope.settings.confirmPassword) {
					$scope.passwordMismatch = true;
					$scope.dashboardSettingsForm.confirmPassword.$setValidity('required', false);
					$('#confirmPassword').focus();
					return false;
				} else {
					$scope.dashboardSettingsForm.confirmPassword.$setValidity('required', true);
					$scope.passwordMismatch = false;
				}
			}
		}

		// Passwords are debounced to 400ms. Keep watching the Passwords
		// and validate as necessary
		$scope.$watch('settings.confirmPassword',  function(confirmPassword) {
			// If empty, reset state to valid
			if ($scope.settings.confirmPassword) {
				$scope.passwordMatch();
			}
		});

		$scope.$watch('settings.password',  function(password) {
			// If empty, reset state to valid
			if ($scope.settings.password) {
				$scope.passwordMatch();
			}
		});
	}
])

.controller('DashboardReportsController', ['$scope', 'currentSession', 'Reports', 'RelativeTime',
	function($scope, currentSession, Reports, RelativeTime) {

		$scope.bizid = currentSession.user.bizid;
		$scope.analytics = null;
		$scope.activeCount = 0;

		Reports.query({
			bizid: $scope.bizid
		}, function(r) {
			if(r.result) {
			   $scope.analytics = r.result;
			   updateTabData();
			} else {
				// TODO donno what to do
			}
		});

		$scope.tabsList = ['week', 'month', 'year', 'alltime'];
		$scope.typesList = ['kc', 'ref', 'qrec', 'qproc'];

		$scope.tab = "week";
		$scope.type = "kc";

		$scope.setTab = function(tab) {
			if($scope.tab != tab) {
				$scope.tab = tab;
				updateTabData();
			}
		};

		$scope.setType = function(type) {
			if(!$scope.isType(type)) {
				$scope.type = type;
				updateTabData();
			}
		};

		$scope.isType = function(t) {
			return (t === $scope.type);
		};


		// Setting up the data

		$scope.tabData = {
			'kc' : [], 'ref' : [], 'qrec': [], 'qproc': []
		};

		$scope.plotData = {};


		/* --- Utility Methods --- */

		function updateTabData() {
			if(!$scope.analytics || !$scope.analytics.counts)
			  return;

			var sl = sampleLength($scope.tab);
			var ix = getIndex($scope.tab);

			var cts = $scope.analytics.counts;

			// get the samples
			var td = {};
			td.kc = cts['kc' + ix].slice(0, sl);
			td.ref = cts['ref' + ix].slice(0, sl);
			td.qrec = cts['qrec' + ix].slice(0, sl);
			td.qproc = cts['qproc' + ix].slice(0, sl);

			// set it to tabData
			$scope.tabData = td;

			var pd = {};
			pd.timestamp_ms = $scope.analytics.timestamp_ms;
			pd.labels = {
				week: weekDayLabels(pd.timestamp_ms),
				month: monthLabels(pd.timestamp_ms),
				year: yearLabels(pd.timestamp_ms),
				alltime:  alltimeLabels(pd.timestamp_ms)
			};
			pd.type = $scope.type;
			pd.tab = $scope.tab;
			pd.data = td[$scope.type];

			$scope.plotData = pd;
			$scope.getCount();
		};

		var kDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		var kMonthLabels = ['Jan','Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		function dateFullForm(d) {
			return kMonthLabels[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
		}

		function weekDayLabels(timestamp_ms) {
			var labels = [];
			for (var i = 0; i < 7; ++i) {
				var d = new Date(timestamp_ms - i * 24 * 60 * 60 * 1000);
				labels.unshift(dateFullForm(d));
			}
			return labels;
		}

		function monthLabels(timestamp_ms) {
			var labels = [];
			for (var i = 0, j = 0; i < 30; ++i, ++j) {
				var d = new Date(timestamp_ms - i * 24 * 60 * 60 * 1000);
				labels.unshift(dateFullForm(d));
			}
			return labels;
		}

		function yearLabels(timestamp_ms) {
			var labels = [];
			for (var i = 0; i < 12; ++i) {
				var d = new Date(timestamp_ms - i * 30 * 24 * 60 * 60 * 1000);
				labels.unshift(kMonthLabels[d.getMonth()] + ' ' + d.getFullYear());
			}
			return labels;
		}

		function alltimeLabels(timestamp_ms) {
			var labels = [];
			for (var i = 0; i < 10; ++i) {
				var d = new Date(timestamp_ms - i * 36525 * 24 * 60 * 60 * 10);
				labels.unshift(d.getFullYear());
			}
			return labels;
		}

		function sampleLength(t) {
			if(t === 'week') return 7;
			else if(t === 'month') return 30;
			else if(t === 'year') return 12;
			else return 10;
		};

		function getIndex(t) {
			if(t === 'alltime') return 2;
			else if(t === 'year') return 1;
			else return 0;
		};

		$scope.total = function(arr) {
			return (arr && arr.length > 0) ? arr.reduce(function(sum, i) { return sum + i; }) : 0;
		};

		$scope.getCount = function() {
			$scope.activeCount = $scope.total($scope.tabData[$scope.type]);
		};
	}
])

.controller('RequestEndorsement', ['$scope', '$http','selectizeService',
	function($scope,$http,selectizeService) {
		$scope.thank = {};
		$scope.importContact = true;

		// to show/hide import contacts

		$scope.showImportContacts = function(e){
			//alert($scope.importContact);
			$scope.importContact = !$scope.importContact;
			e.stopPropagation();
		};

		// Setting options for selectize box
		$scope.emailSelectize = {
					plugins: ['remove_button'],
					persist: true,
					valueField: 'name',
					labelField: 'name',
					create: true,
					onItemRemove: function(value){
						this.removeOption(value);
						$scope.toListCounter();
					},
					onItemAdd: function(val,el){
						if(this.options[val] && this.options[val].email){
							$(el).attr('title',this.options[val].email);
						}
						$scope.toListCounter();
					}
		};
		$scope.toListCounter = function(){
			if(Object.keys(selectizeService.getSelectizeObject().options).length){
				$scope.toListEmpty = false;
			}
			else{
				$scope.toListEmpty = true;
			}
		};

		// Intialize quill editor
		$scope.quill = '#editor';

		// To avail selectize availavle across controller using selectize service.

		$scope.$watch('toListBox',  function(toListBox) {

			if ($scope.toListBox) {
				selectizeService.selectize  = $scope.toListBox;
			}
		});

		$scope.thank={};
		$scope.request={};

		//for annoymous user mailers
		$scope.$watch('annonymous_user.name',  function(username) {
			if( $scope.cur_user_bizid === "null" && $scope.thank.type === "undefined") {
				if (!username)
					username = '';
				$scope.subject = username+" is requesting a quick "+$scope.request.type;
			}

		});


		// to open mail contact list popup window
		$scope.authorizeMail = function(server, e){
			e.preventDefault();
			$('.maillist .import-from').removeClass('import-from');
			$(e.target).addClass('import-from');
			var mailerWindow = window.open("/auth/"+server, "mailingList", "directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=1,width=620,height=660" );
				//mailerWindow.moveTo(1300, 1300);
		};

		$scope.setImportFrom = function(e) {
			$('.maillist .import-from').removeClass('import-from');
			$(e.target).addClass('import-from');
		};

		$scope.callme = function(message){
			$(".ajax-loader").removeClass('hide');
			$(message).each(function( index ) {
				selectizeService.selectize.addOption({'name':this.name,'email':this.email});
			});
			$.each(selectizeService.selectize.options, function( key, value ) {
				selectizeService.selectize.addItem(this.name);
			});
			$(".ajax-loader").addClass('hide');
		};

		// Annoymous user also can use the grow network tools like thank you card, endoresment, referral with required fields of email and name.
		// In such cases bizId will be null, and we are validation this to compare with normal login in senario.

		//console.log("1156 bizid1 :",  $("input[name='bizid1']").val() );
		if (!$scope.bizid){

			var $ownerName = $('#annonymous-name'),
				$contactEmail = $('#annonymous-email'),
				$ownerErrorText = $('#annonymous-name ~ .error-text'),
				$emailErrorText = $('#annonymous-email ~ .error-text');

			// popover for Profile name
			$ownerName.popover({
				content: "Your name will be used in this email.",
				placement: "bottom",
				trigger: "focus"
			});
			$contactEmail.popover({
				title: "Your Email will not be shown on public profile page.",
				content: "Please use a valid address for login and communication with KnownCircle.",
				placement: "bottom",
				trigger: "focus"
			});

			$ownerName.on('keydown input',function(){
				$(this).removeClass('error-input');
				$(this).next('.popover').removeClass('in').hide();
				$ownerErrorText.text("");
			});
			$contactEmail.on('keydown input',function(){
				$(this).removeClass('error-input');
				$(this).next('.popover').removeClass('in').hide();
				$emailErrorText.text("");
			});

			$("#annonymous-name,#annonymous-email").on("click",function(e){
				e.stopPropagation();
				//$("#loginPopover").removeClass('in').hide();
				if(! $(this).next('.popover').hasClass('in')){
					$('.popover.in').removeClass('in').hide();
					$(this).next('.popover').addClass('in').show();
				}
			});

		}

		window.emailSelectCallback = function(data) {
			$scope.callme(data);
		};

		var selected_fields = [];
		var template_name = $('.template-name').val();
		var $selectedField = $('.selected-fields');
		var count = $selectedField.length;
		for(var i=0; i<count; i++) {
			if($selectedField.eq(i).val() == 'true') {
				selected_fields.push($selectedField.eq(i).attr('name'));
			}
		}
		$scope.kc_description = '';
		$scope.previewSignature = function() {
			if(template_name){
				$http.post('/business/dashboard/grow/email_signature/preview', {template_name: template_name, selected_fields: selected_fields})
				.success(function(response, status) {
					$('.mail-footer .template-container').html(response);
					$scope.kc_description = $('.mail-footer').html();
				}).error(function(error, status) {

				});
			} else{
				$scope.kc_description = $('.mail-footer').html();
			}
		};

		$scope.kc_giftCard_attachment = '';
		$scope.getGiftCardAttachment = function() {
			$scope.kc_giftCard_attachment = $('#giftcard').html();
			return $scope.kc_giftCard_attachment;
		};
		$scope.getGiftAmount = function() {
			$scope.gift_amount = $('.price').html();
			return $scope.gift_amount;
		};



		$scope.previewSignature();

		//Knowncircle description to be added at end of mail content.
		//$scope.kc_description = "<div style='line-height:25px;color: #666;min-height: 20px;padding: 19px;margin-bottom: 20px;background-color: #f5f5f5;border: 1px solid #e3e3e3;border-radius: 4px;-webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05);'><img style='width: 150px;height: 31px; margin: 0 10px 0 0;  opacity: 0.5;vertical-align:middle' src='https://cdn.knowncircle.com/mailers/ico_logo_3.png' class='logo-img'>KnownCircle™ is an innovative social referral network where consumers can discover and connect with professional service providers that are most trusted by their friends and family.</div>";
		$scope.requestRef = {};

		$scope.toListEmpty = true;
		// This function will trigger a send mail to selected contacts.
		$scope.sendRequest = function(e, bizid, endorsementFor){
			$scope.bizid = (bizid === 'false') ? false : true;
			$scope.is_gift_attached =false;
    		$scope.receipientsList  = selectizeService.getSelectizeObject();

    		if ($scope.receipientsList && Object.keys($scope.receipientsList.options).length){
	    		$scope.requestRef.mailContent = $scope.quillEditorBox.getHTML();
	    		$scope.requestRef.mailContent += $scope.getGiftCardAttachment();
	    		$scope.requestRef.mailContent += $scope.kc_description;
	    		$scope.requestRef.subject = $scope.subject;
	    		$scope.requestRef.gift_amount = $scope.getGiftAmount();

				$scope.requestRef.refer = (function(){
					return $.map(selectizeService.getSelectizeObject().options,function(val, index){
						var emailObj = {};
						emailObj.name = val.name;
						emailObj.email = val.email || val.name;
						return emailObj
					});
				})();

				$scope.referUrl = $scope.bizid ? '/business/dashboard/grow/request-endorsement/refer-friends' : '/business/grow/ext_tools/pop_status';

				if (!$scope.bizid){
					if ($scope.annonymousForm.$valid) {
						$scope.requestRef.annonymous_user_name = $scope.annonymous_user.name;
						$scope.requestRef.annonymous_user_email = $scope.annonymous_user.email;
					} else {
						alert("Please enter valid name and email");
						return false;
					}
				}

				$scope.is_gift_attached = ($("#giftAttached").length) ? true : false;

				if($scope.is_gift_attached){
					if(!$scope.biz.cc_info){
						alert("Please add your credit card details before sending gift cards. Thank you.");
						return false;
					}
				}

				$http.post($scope.referUrl, $scope.requestRef)
				.success(function(response, status) {
					if (response && response.status !== 'error') {
								if (response.show ){
									if( response.show == "signup" ){
										angular.element('.signup-modal-container').scope().business.ownerName = $scope.annonymous_user.name;
										angular.element('.signup-modal-container').scope().business.email = $scope.annonymous_user.email;
										$('.signup-modal').modal();

									} else if ( response.show == "login" ){

										var email = $scope.annonymous_user.email;
										$('.login-modal #claim_username').val(email);
										angular.element('.login-modal-container').scope().business.username = email;
										$('.login-modal #claim_username').trigger('input');
										$('.login-modal #claim_password').trigger('input');
										$('.login-modal').modal();

									}
								} else {
									$('.alert-modal').modal({ backdrop: 'static', keyboard: false })
										.one('click', '.btn-ok', function (e) {
											window.location.href = "/business/dashboard/grow";
										});
								}

						$scope.bizIdValue =  $('input[name="bizid"]').val();

						if($scope.bizid && endorsementFor) {
							// Mixpanel
							var details = {
								bizid: bizid,
								type: endorsementFor
							};
							kcApp.mixpanel.thankyouNote(details);
						} else if ($scope.bizIdValue) {
							// Mixpanel
							var details = {
								bizid: $('input[name="bizid"]').val(),
								email_recipients: selectizeService.getSelectizeObject().getValue(),
								imported_from: $('.import-from').data('import')
							};
							// Mixpanel
							if($('.page-wrap').hasClass('request_endorsement')) {
								kcApp.mixpanel.addToKCRequest(details);
							} else {
								kcApp.mixpanel.referralRequest(details);
							}
						} else {
							//window.location.href = "/business/dashboard/grow";
						}

						// callback && callback(null);
					}
					else {
						// In case of error, show the addtokc button to
						// give the user another chance to try
						//alert(response);
						// callback && callback(response.err);
					}
				}).error(function(error, status) {
					//alert(response);
					// callback && callback(error);
				});
			}
		};
		$scope.convertCsvToJson = function(e) {
			document.forms.dashboardCSVForm.submit();
		}
		$scope.openCustomizeThankYouModal = function(){
			$('#customizeThankYouEmail').modal('show');
		}

		$scope.openCustomizeThankYouModal();

		$scope.closeCustomizeThankYouModal = function(e) {
			$('#customizeThankYouEmail').modal('hide');
		};
		function generate_mail_list(input,$target){
			$target.html("");
			for(var i=0;i<input.length;i++){
				var content = '<li>\
				<input type="checkbox" name="'+input[i].name+'" value="'+input[i].email+'" id="'+input[i].email+'" class="email-input">\
				<label for="'+input[i].email+'" class="name")>'+input[i].name+'</label>\
				<label for="'+input[i].email+'" class="email pull-right")>'+input[i].email+'</label>
				</li>'
				$target.append(content);
			 }
		}
		$scope.openChooseCustomerEmail = function(){
			$.ajax({
			  method: "GET",
			  url: "/business/dashboard/grow/thank_consumer/contacts",
			  success: function(data){
				generate_mail_list(data.circles,$('.referred-mail-list'));
				generate_mail_list(data.referals,$('.endorsed-mail-list'));
			  }
			});
			$('#chooseCustomerEmail').modal('show');
		}

		$scope.closeChooseCustomerEmail = function(e) {
			$('#chooseCustomerEmail').modal('hide');
		};
	}
 ])

.controller('CustomizeThankyouController', ['$scope',
	function($scope) {
		// Thank you cards are served from https://cdn.knowncircle.com/mailers/thank-you/{num}.png
		// Currently, we have 1-9 cards
		var cardBaseURL = "https://s3.amazonaws.com/images.knowncircle.com/mailers/thank-you/v1/";
		var cardType = $scope.$parent.thank.type;
		cardBaseURL +=  cardType + '/';
		// Generate the individual card URLs
		var cardCount = {
			referral: 4,
			business: 4
		};
		var cards = [];
		for (var i = 1; i <= cardCount[cardType]; i += 1) {
			cards.push(i);
		}
		var thanku_cards = $scope.thankYouCards = cards.map(function(num) {
			return cardBaseURL + num + '.png';
		});

		//Update src of mail banner image once customization is complete
		$('.done-btn').on('click',function(){
			// var url = $('.item.active img').attr('src');
			var index = $('.item.active').attr('data-index');
			$('#editor img.thank-you-img').attr('src', getUrl(thanku_cards[index]));
		});
		var spinner;
		//Update src of carousel images when preview button is clicked
		$scope.previewCard = function(){
			if (spinner) {
				spinner.stop();
			}
			var target = $('#myCarousel')[0];
			spinner = new Spinner({color: '#fff'}).spin(target);
			var $active = $('.item.active');
			var activeIndex = $active.attr('data-index');
			$active.find('.thank-you-img').attr('src', function() {
				return getUrl(thanku_cards[activeIndex]);
			});
			$active.find('.thank-you-img').load(function() {
				spinner.stop();
			});
		};

		function getUrl(url) {
			var font = $('.choose-font').val();
			var size = $('.choose-size').val();
			var text = $('.thank-text').val();
			// TODO: temporary fix. Strip out special chars
			text = text.replace(/[^A-Za-z0-9 .-\\n]/g, '');
			text = encodeURIComponent(text);
			//Replace '?' in url as the content following it would be
			//mistook as url parameters
			text = text.replace(/\?/g,'%3F');

			//fetch url from cloudinary
			var cloudinary_url = $.cloudinary.url(url, {
				type : 'fetch',
				secure:'true',
				transformation :[
					{
						overlay: "text:"+font+"_"+size+"_center:"+text,
						gravity: 'north_west',
						color: '#fff',
						x: 180,
						y: 420,
						width : 340,
						crop : 'fit'
					}
				]
			});
			return cloudinary_url;
		}

		$("#myCarousel").bind('slid.bs.carousel', function(e) {
			$scope.previewCard();
		});

		setTimeout(function() {
			$("#myCarousel").carousel('pause');
		}, 5);
	}
])

.controller('ChooseCustomerEmail', ['$scope','selectizeService',
	function($scope,selectizeService) {
		$scope.closeChooseCustomerEmail = function(e) {
			$('#chooseCustomerEmail').modal('hide');
			$scope.query = '';
			changeNumberSelected();
		};
		$('.referred-select-all').on('click',function(){
			if(this.checked) { // check select status
				$('.referred-mail-list li').not('.hide').find('.email-input')
				.each(function() {
					this.checked = true;  //select all checkboxes
				});
			}else{
				$('.referred-mail-list li').not('.hide').find('.email-input')
				.each(function() {
					this.checked = false; //deselect all checkboxes
				});
			}
			changeNumberSelected();
		});
		$('.endorsed-select-all').on('click',function(){
			if(this.checked) { // check select status
				$('.endorsed-mail-list li').not('.hide').find('.email-input')
				.each(function() {
					this.checked = true;  //select all checkboxes
				});
			}else{
				$('.endorsed-mail-list li').not('.hide').find('.email-input')
				.each(function() {
					this.checked = false; //deselect all checkboxes
				});
			}
			changeNumberSelected();
		});

		$('body').on('change','.referred-mail-list .email-input,.endorsed-mail-list .email-input',function(){
			changeNumberSelected();
		});

		var changeNumberSelected = function(){
			$('.referred-container .no-selected').text($('.referred-mail-list .email-input:checked').length);
			$('.endorsed-container .no-selected').text($('.endorsed-mail-list .email-input:checked').length);
		}
		changeNumberSelected();

		$scope.postMessage = function(){
			$scope.emailList = $.map($(".email-input:checked"),function(value,index){
				var emailObj={};
				emailObj.email = value.value;
				emailObj.name=value.name || value.value;
				selectizeService.getSelectizeObject().addOption(emailObj);
				selectizeService.getSelectizeObject().addItem(emailObj.name);
				return emailObj;
			});
			$scope.closeChooseCustomerEmail();
		};

		$scope.filterEmail = function(){
			$('#chooseCustomerEmail li').removeClass('hide');
			// $('.email-input:checked,#referred-input:checked,#endorsed-input:checked')
			// .each(function(){
			// 	this.checked = false
			// });
			// changeNumberSelected();

			if($scope.query){
				$('#chooseCustomerEmail li')
				.filter(function(){
					var list_text = $(this).text().trim().toLowerCase();
					var q = new RegExp($scope.query,'i')
					if(q.test(list_text))
						return false;
					else
						return true;
				})
				.addClass('hide');
			}
		}
	}
])


.controller('MailingListPopup', ['$scope',
	function($scope) {
		$scope.setModalValue=function(emailList){
			$scope.listOfEmails = emailList.results;
		};

		$scope.postMessagetoframe=function(){
			$scope.emailList = $.map($("input:checked").not(".select-all"),function(value,index){
				var emailObj={};
				emailObj.email = value.value;
				emailObj.name=value.name || value.value;
				return emailObj;
			});
			window.opener.emailSelectCallback($scope.emailList);
			setTimeout(function() {
				window.close();
			}, 50);
		};

		$('.cancel-btn').on('click',function(){
			window.close();
		});

		$('.select-all').on('click',function(){
			if(this.checked) { // check select status
				$('.mail-list .email-input').each(function() {
					this.checked = true;  //select all checkboxes
				});
			}else{
				$('.mail-list .email-input').each(function() {
					this.checked = false; //deselect all checkboxes
				});
			}
			changeNumberSelected();
		});
		$('body').on('change','.mail-list .email-input',function(){
			changeNumberSelected();
		});

		var changeNumberSelected = function(){
			$('.no-selected').text($('.mail-list .email-input:checked').length);
		}
		changeNumberSelected();
	}

 ])

.controller('EmailSignatureController', ['$scope', '$http',
	function($scope, $http) {
		var templateMap = {
			'Business Card' : 'business_card',
			'Simple' : 'simple_card',
			'Detailed' : 'detailed_card',
			'Vertical' : 'vertical_card',
			'Split' : 'split_card'
		};

		var templateRemap = {
			'business_card' : 'Business Card',
			'simple_card': 'Simple',
			'detailed_card' :'Detailed',
			'vertical_card' :'Vertical',
			'split_card' : 'Split'
		};

		// $scope.currentTemplate = 'Business Card';
		$scope.currentTemplate = 'Split';
		$scope.templateList = ['Split'];
		$scope.setTemplate = function(template) {
			$scope.currentTemplate = template;
			$scope.previewSignature();
		};
		$scope.checked = {
			ownerName: true
		};
		var selected_fields = [];
		var template_name;
		var content = 'Please include the content in your public profile to make it available in your signature'

		$('.show-popover').popover({
			trigger: 'hover',
			placement: 'top',
			html: true,
			content: content
		});

		function getDetails() {
			selected_fields = [];
			template_name = templateMap[$scope.currentTemplate] || $scope.currentTemplate;
			$('.selected-fields:checked').each(function() {
				selected_fields.push($(this).attr('name'));
			});
		}

		$scope.previewSignature = function() {
			getDetails();
			$http.post('/business/dashboard/grow/email_signature/preview', {template_name: template_name, selected_fields: selected_fields})
			.success(function(response, status) {
				$('.template-container').html(response);
			}).error(function(error, status) {

			});
		};

		$scope.saveSignature = function() {
			getDetails();
			$http.post('email_signature', {template_name: template_name, selected_fields: selected_fields})
			.success(function(response, status) {
				location.reload();
			}).error(function(error, status) {

			});
		}

		function initSignature() {
			var signature_theme = $('input[name="signature_theme"]').val();
			if(signature_theme) {
				$scope.currentTemplate = templateRemap[signature_theme];
			}
			$scope.previewSignature();
		}
		initSignature();
	}
])

.controller('DashboardSearchController', ['$scope',
	function($scope) {
		$scope.dashbaoardSearch = function(e) {
			e.preventDefault();
			var form = $scope.searchResultsForm;
			var searchDetails = {};
			searchDetails['insurance_type'] = "none";
			searchDetails['search_text'] = $('#searchBox').val() || 'none';
			searchDetails['email'] = $('.js-email').val();
			searchDetails['service_type'] = 'all';
			searchDetails['bizid'] = $('.js-bizid').val();
			searchDetails['near_filter'] = 'none';
			mixpanel.track('Search', searchDetails);
			document.forms.searchResultsForm.submit();
		}
	}
])

.filter('reverse', function() {
  return function(items) {
	return items.slice().reverse();
  };
})

.directive('reportsData', [ function() {
	return {
		restrict: 'A',
		scope: {
		  "plotData": "=plotData"
		},
		link: function (scope, element, attrs) {
			// Yep, not the best way to do it in D3.
			var X_AXIS_TICKS = {
				7: ['Mon','Tue','Wed','Thur','Fri','Sat','Sun'],
				12: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
			};

			var margin = {top: 20, right: 20, bottom: 70, left: 40};
			var width = 650 - margin.left - margin.right;
			var height = 440 - margin.top - margin.bottom;

			var graph = d3.select(element[0]).append("svg:svg")
						.attr('width', width + margin.left + margin.right)
						.attr('height', height + margin.top + margin.bottom)
						.append("svg:g")
						.attr("transform", "translate(" + margin.bottom + "," + margin.top + ")");

			var x = d3.scale.linear().range([0, width]);
			var y = d3.scale.linear().range([height, 0]);

			var area = d3.svg.area()
				.x(function(d, i) { return x(i+1); })
				.y0(height)
				.y1(function(d) { return y(d); });

			// Re render UI
			scope.render = function(plotData) {
				if(!plotData || !plotData.data)
					return;

				// reverse the array before rendering
				var data = plotData.data.reverse();

				// console.log("re render triggered");
				// console.log("Number of samples: " +data.length);
				// console.log(data);

				var xAxis = d3.svg.axis().scale(x).orient("bottom")
					.ticks(plotData.labels[scope.$parent.tab].length+1)
					.tickFormat(function(d, i) {
						return i === 0 ? '' : plotData.labels[scope.$parent.tab][i-1];
					});
				// graph.append("svg:g").attr("class", "x axis");

				var yAxis = d3.svg.axis().scale(y).orient("left")
					.ticks(5)
					.tickFormat(d3.format("d"));
				// graph.append("svg:g").attr("class", "y axis");

				// // scale's domains
				var yData = [], yMax = d3.max(data);
				for ( var i = 0, step = 1+Math.floor(yMax/5); i <= yMax; i+=step) {
					yData.push(i);
				}
				yData.push(i);
				x.domain([0, data.length+1]);
				y.domain([0, yData[yData.length-1]]);

				graph.selectAll('g.axis').remove();

				graph.selectAll('.horizontal').remove();
				var yenter = graph.selectAll('.horizontal')
					.data(yData)
					.enter().append('svg:g').attr({'class': 'horizontal'});
				yenter.append('svg:text')
						.attr({
							'class': 'ylabel',
							x: -5,
							y: function (d,i) { return y(yData[i])+5; },
							'text-anchor': 'end'
						})
						.text(function (d,i) { return yData[i]; });
				yenter.append("svg:line")
						.attr({
							x1: 0,
							y1: function(d, i) { return y(yData[i]); },
							x2: width,
							y2: function(d, i) { return y(yData[i]); },
						});


				// var line = d3.svg.line()
				//         .x(function(d,i) { return x(i + 1); })
				//         .y(function(d) { return y(d); });

				graph.append("svg:g")
						.attr("class", "x axis")
						.attr("transform", "translate(0," + height + ")")
						.call(xAxis);

				graph.selectAll('g.x.axis g.tick text').attr({
					'class': scope.$parent.tab,
					'style': 'text-anchor: ' + (scope.$parent.tab === 'month' ? 'end;': 'middle;'),
					'transform': scope.$parent.tab === 'month' ? 'rotate(-90) translate(-10 12)' : ''
				});

				if (false) {
					graph.append("svg:g")
						.attr("class", "y axis")
						.call(yAxis);
				}

				// var tickWidth = graph.select('.x.axis').select('tick')
				// graph.select('.x.axis').selectAll('.tick').selectAll('text')
				//     .attr("transform", "translate(110 0)");

				// d3.transition(graph).select(".y.axis")
				//     .call(yAxis);

				// d3.transition(graph).select(".x.axis")
				//     .attr("transform", "translate(0," + height + ")")
				//     .call(xAxis);

				// graph.selectAll('path').remove();
				// graph.append("svg:path").attr("d", area(data));
				graph.select(".area").remove();
				graph.selectAll(".marker").remove();

				graph.append("path")
					.datum(data)
					.attr("class", "area")
					.attr("d", area);

				graph.selectAll('.marker')
					.data(data)
					.enter()
					.append("svg:circle")
						.attr({
							"class": 'marker',
							r: 4,
							cx: 0,
							cy: 0
						})
						.attr("transform", function(d, i) {
							return "translate(" + x(i+1) + "," + y(d) + ")";
						});

			};

			// watch scope.analytics
			scope.$watch("plotData", function() {
				scope.render(scope.plotData);
			});

		}
	};
}])

.service('selectizeService', function() {
	var sel_Obj = {'selectize':''};
/*	function ReceiveMessage(evt) {
		alert(14444);
		var message = evt.data;
		if ( location.origin === evt.origin) {
			$(".ajax-loader").removeClass('hide');
			$(message).each(function( index ) {
				sel_Obj.selectize.addOption({'name':this.name,'email':this.email});

			});
			$.each(sel_Obj.selectize.options, function( key, value ) {
				sel_Obj.selectize.addItem(this.name);
			});
			$(".ajax-loader").addClass('hide')
		}
	}
	(function () {
	  if (!window['postMessage']) alert("Does't Support Cross Domain Communication!");
	  else {
		  if (window.addEventListener) {
			  //alert("standards-compliant");
			  // For standards-compliant web browsers (ie9+)
			  window.addEventListener("message", ReceiveMessage, false);
		  }
		  else {
			  //alert("not standards-compliant (ie8)");
			  window.attachEvent("onmessage", ReceiveMessage);
		  }
	  }
	})();*/

	sel_Obj.getSelectizeObject = function() {
		return sel_Obj.selectize;
	}

	return sel_Obj;
});
