/*
* Repertoire faceting ajax widgets
*
* Copyright (c) 2009 MIT Hyperstudio
* Christopher York, 09/2009
*
* Requires jquery 1.3.2+
* Support: Firefox 3+ & Safari 4+.  IE emphatically not supported.
*
*
* Register an element as the faceting context,
*   and provide user data extraction function
*
* Handles:
*       - manipulation of faceting refinements
*       - url/query-string construction
*       - data assembly for sending to webservice
*       - change publication and observing
*       - grouping faceting widgets into shared context
*       - facet count/results ajax api
*       - hooks for managing custom data
*/

//= require jquery

//= require rep.widgets

//= require deparam

repertoire.facet_context = function(context_name, state_fn, options) {
  var self = repertoire.model(options);
  
  // current query state for all facets in context
  var filter = {};
  
  //
  // Return the current refinements for one facet, or all if no facet given
  //
  // Changes to the returned object are persistent, but you must call self.state_changed()
  // to trigger an update event.
  //
  self.refinements = function(name) {
    if (!name) {
      // if no facet provided, return all
      return filter;
    } else {
      // set up refinements for this facet
      if (!filter[name])
        filter[name] = [];

      // return current refinements
      return filter[name];
    }
  };
  
  //
  // Update each facet's refinements to the stored values
  //
  // If the stored values have no entry for the facet, it is cleared.
  //
  self.update_refinements = function(state) {
    for (var facet in filter) {
      filter[facet] = state[facet] || [];
    };
  };

  //
  // Register a facet in this context.
  //
  // Necessary so context knows which parameters to read from the
  // search path on initial page load
  //
  self.register = function(facet) {
    filter[facet] = filter[facet] || [];
  }

  //
  // Convenience function for constructing faceting urls
  //
  self.facet_url = function(action, facet, ext, params) {
    var paths = [context_name, action];
    if (facet)
      paths.push(facet);
    var url = self.default_url(paths, ext),
        search = self.to_query_string(params);

    if (search)
      return url + '?' + search;
    else
      return url;
  };

  //
  // Return the state for the entire faceting context (group of widgets),
  // with any context-specific additions
  //
  self.params = function() {
    var state = state_fn ? state_fn() : {};
    return $.extend({}, { filter: self.refinements() }, state);
  };

  //
  // Return the identifying name for this context (usually the model class, pluralized)
  //
  self.name = function() {
    return context_name;
  }

  //
  // Toggle whether facet value is selected
  //
  self.toggle = function(name, item) {
    var values = self.refinements(name);
    var index  = $.inArray(item, values);

    if (index == -1)
      values.push(item);
    else
      values.splice(index, 1);

    return values;
  };
  
  //
  // Provide a public url describing refinements
  // (including any additional state defined by client app)
  //
  self.url = function() {
    var prefix = options.url || '',
        parts = [context_name];

    parts.unshift(prefix);

    var url = parts.join('/'),
        params = self.params(),
        search = self.to_query_string(params);

    if (search)
      return url + '?' + search;
    else
      return url;
  }


  // end of context factory method
  return self;
}

$.fn.facet_context = function(state_fn) {
  return this.each(function() {
    // add locator css class to element, and store faceting context data model in it
    var $elem = $(this);
    var name  = $elem.attr('id');
    var model = repertoire.facet_context(name, state_fn, repertoire.defaults);
    $elem.addClass('facet_refinement_context');
    $elem.data('context', model);
  });
};