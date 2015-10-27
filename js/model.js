"use strict";

angular.module('kcApp.dashboard')

.factory('Quote', ['RestResource', function(RestResource) {
  var Quote = RestResource('/business/:bizid/quote:multiple/:id/:action',
    {
      bizid: '@bizid',
      id: '@id'
    },
    {
      query: {
        params: {
          multiple: 's'
        },
        isArray: true
      },
      updateBulk: {
        method: 'put',
        params: {
          multiple: 's'
        }
      },
      saveNote: {
        method: 'put',
        params: {
          action: 'add_note'
        }
      }
    }
  );

  return Quote;

}])

.factory('Reports', ['RestResource', function(RestResource) {
  var Reports = RestResource('/business/profile/:bizid/analytics',
    {
      bizid: '@bizid',
    },
    {
      query: {
        method: 'get',
        params: {}
      },
    }
  );

  return Reports;
}])

.factory('BusinessProfile', ['RestResource', function(RestResource) {
	var BusinessProfile = RestResource('/business/dashboard/profile/json',
		{},
		{
			query: {
				isArray: false
			}
		}
	);

	return BusinessProfile;
}]);
