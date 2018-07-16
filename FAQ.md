## Repertoire Faceting FAQ

### General questions

*Q* Can I use Rails migrations with Repertoire Faceting?

*A* In general, yes. However, Rails' developers recommend you use the database's native dump format rather than schema.rb. Put the following line in environment.rb:

```yml
config.active_record.schema_format = :sql
```

    You can also use migrations to install the API in your database. A simple example:

```ruby
    def self.change
      reversible do |dir
        dir.up   { execute('CREATE EXTENSION faceting') }
        dir.down { execute('DROP EXTENSION faceting CASCADE') }
      end
    end
```

In cases where you do not have superuser access to the deployment host (e.g. Heroku) and so cannot run "rake db:faceting:extensions:install", you can get use the connection's "faceting_api_sql" method to load the API by hand. See the repertoire-faceting-example application's migrations for a concrete example.

*Q* Caching for the faceted browser.

*A* Because the opening page of a faceted search is also the most computationally-intensive to produce (it integrates
counts across the entire dataset), the faceted browser is radically faster when configured to cache results. As of version
0.7.4, the controller mixin sets HTTP cache headers in responses to reasonable defaults.

  The short story is that models should have an updated_at column, which is used to compute cache keys. For models with many
  items, you may wish to add an index on updated_at.

  The detailed story:

  - Requests without an HTTP etag header are processed normally

  - For results queries, a cache key is built that combines the model's updated_at column with a count of the number of rows
    in the table. If you use Rails' built-in timestamps, this will expire the cache after updating and deleting items.

  - For facet counts on indexed facets, the most recent index refresh is used to construct a cache key. This ensures caches
    expire when you call "<Model>.index_facets" to refresh the indices (and not before).

  - For facet counts on unindexed facets, the model table's cache key is used.

  - If the model table has no updated_at column, caching falls back to Rails default. (Your query will execute every time.)

  This arrangement caches the most commonly accessed (and slowest) queries in the user's browser. Hence the first
  request from a new session will load more slowly than consecutive ones. To speed up access across all sessions,
  configure your Rails app to use an intermediate server cache, e.g. with Rack::Cache and memcached or Varnish.

  If you choose to over-ride the results web-service in your own controller, you can easily reuse Repertoire Faceting's
  cache settings by checking the value of <Model>.facet_cache_key:

```ruby
    class TodoslistController < ApplicationController
      include Repertoire::Faceting::Controller
      ...
      def results
        filter = params[:filter] || {}
        if stale?(base.facet_cache_key)
          @results = base.refine(filter)
          respond_with @results
        end
      end
      ...
```

See https://signalvnoise.com/posts/3113-how-key-based-cache-expiration-works for context.

  *Caveats*  The following caveats apply to Rails HTTP header based caching in general:

  - You must make sure your ActiveRecord associations touch the parent table's updated_at column when updating, or you
    may receive stale data. For example, if you are faceting over todos stored in a joined table:

    class Todo < ActiveRecord::Base
      belongs_to :todolist, touch: true
    end

  - It is recommended to expire all cache keys on deploying a new version of any application. However, as of Rails 4.0.5, there
    is still no standard convention for versioning apps. It may be possible to automate this in Heroku.  See
    http://stackoverflow.com/questions/8792716/reflecting-heroku-push-version-within-the-app.

  - Because the default strategy caches items in the user agent's browser, the first load of a faceted browser session will be
    slower than the rest. Installing a server-side cache like Rack::Cache will alleviate this.


### About facet indexing and the signature SQL type

*Q* What's the scalability of this thing?

*A* Up to about 500,000 items, supposing 6-8 simultaneous facets with domains anywhere from 2-100 values.  In other words, beyond the size of most commonly available datasets.  See the citizens example in the specs directory & example faceting app. It has been tested with up to 1,000,000 items, but this requires unix configuration to give Postgresql lots of shared memory.


*Q* My facets are empty.

*A* Make sure the facet indices aren't empty.  Running '<Model>.index_facets([])' from the Rails console will drop them all.


*Q* My facet count values are out of date with the model.

*A* If your facets are indexed, the indexes must be refreshed from the model table periodically.  Running '<Model>.index_facets'
(no arguments) in the Rails console will refresh them.  In a production environment, run this periodically for each indexed model
via a cron task.


*Q* Can I facet over multiple models?

*A* Not currently.  However, this may be possible using an ActiveRecord polymorphic relation on the main model.


*Q* Why a new native PostgreSQL type?

*A* As of PostgreSQL 9.3, we have a binding for the Repertoire in-database faceting functions, based on VARBIT strings. However, it is many times slower than using the C-language signature type.


### About the ajax faceting widgets


*Q* How to access the faceting API from a client on a different origin.

*A* This is easily done. Configure your rails project to accept CORS ajax GET requests, then configure the API server
    name in repertoire.defaults.path_prefix :

```js
    $().ready(function() {
      repertoire.defaults = { path_prefix: '<YOUR API SERVER>' };
      ...
```
    For future reference, here is how to enable CORS for rails. In your GEMFILE:
```
      gem 'rack-cors', :require => 'rack/cors'
```
    In your config.rb:

```ruby

      require 'rack/cors'
      use Rack::Cors do

        # allow get requests from all origins
        allow do
          origins '*'
          resource '*',
              :headers => :any,
              :methods => [:get, :options]
        end
      end
```

*Q* Rails is sending JSON data in a format that my javascript widgets don't understand.

*A* Put the following line in config/application.rb:

```ruby
   config.active_record.include_root_in_json = false
```

*Q* How do I send page-specific data (for example, a search field) to the webservice with the facet widgets' data?

*A* If you provide a function to the facet_context plugin, it will merge the params you return before dispatching to the webservice, e.g.

```js
   $('#invoices').facet_context(function() {
     return {
       search: $("#search_field").val()
     };
   });
```

*Q* I want to change the default options for all widgets of a given class.

*A* See the syntax for defining jquery plugins - you can alter the defaults for all widgets by reassigning them in your view code.


*Q* How do I make one-time, minor changes to the behaviour of a widget?  For example, I want to add a control.

*A* Use the inject option, which is part of the base functionality.  Your injector function receives a reference to the widget's jquery element and to the widget javascript object.  Use jquery to add your control's markup, then register an event handler to add its behaviour.  For example, this injector adds a clear-all button in the title:

```js
   $('#genre').facet({
      injectors: {
        '.title .controls' : function(self, data) { $(this).append('<span class="clear_control">[x]</span>'); }
      },
      handlers: {
        'click!.clear_control' : function(self) {
          var name    = self.facet_name(),
              context = self.context();
          context.refinements(name).length = 0;
          context.trigger('changed');
          return false;
        }
      }
    });
```

The injector adds markup for the control at the specific jquery selector, and the handler receives events on that markup.  Both receive a single argument 'self' for the widget object, and 'this' for the matched DOM element.

Note the syntax used to identify a handler's event and dom element: '<event.namespace>!<target>'.  Both event and namespace are optional - leave them out to register a click handler with a unique namespace.

In injectors and handlers, you have access to the complete faceting widget API (state, refinements, toggle, is_selected, etc.). You can basically build a new widget, if you need to. See the documentation for the faceting_widget class for details.


*Q* My additonal control needs to send data back to the webservice too.

*A* You can pre-process the entire context's state before it's sent to the webservice by update():

```js
   var min = 5;
   $('#genre').facet({
     injectors:  { ... },
     handlers:   { ... },
     state: function(state) { state.minimum = genre_min; }
   }
```

*Q* How do I subclass an existing widget, so I can reuse my changes repeatedly?

*A* Basically you define a new widget class and move your injectors and handlers (above) into the appropriate places.  See the results widget for the simplest possible example, and nested_facet for a real-world example that extends the default facet widget.  At a bare minimum, you will over-ride the render() method, and possibly the update() method too.  Here is a 'hello world' that extends the default facet count widget:

```js
    var hello_world = function($elem, options) {
      /* declare superclass */
    	var self = repertoire.facet($elem, options);

      /* handlers */
      handler('.hello', function() {
        alert('hello, world!');
      });

      /* injectors */
      var $template_fn = self.render;
      self.render = function(data) {
        var $markup = $template_fn(data);
        $markup.find('.title .controls').append('<div class='hello'>click me!</div');
        return $markup;
      }

      return self;
    }
```

*Q* That's great, but how do I turn it into a jquery plugin I can actually use?

*A* Call the plugin method and assign it to a variable in the jquery prototype.  If provided, the line following sets universal options defaults for the widget.

```shell
   $.fn.hello_world = repertoire.plugin(hello_world);
   $.fn.hello_world.defaults = { ... };       // put default options here
```

*Q* How do these widgets relate to each other?

*A* Here is the class hierarchy:

```
   facet_widget (abstract)
      +--- facet
           +--- nesting_facet
      +--- results
```

*Q* In my widget or handler, how do I override an event handler from the superclass?

*A* Register another handler to the exact same event and namespace.  E.g. toggling selection for facet value counts in the default facet widget is registered under the jquery event/namespace 'click.toggle_value'.  To over-ride:

```js
    /// in widget's constructor function

    self.handler('click.toggle_value!.facet .value', function() {
       ... redefined event handler
    }
    ...
```
*Q* My widget needs to send additional data to the webservice, pre-process the state, compute my own query string, or use a different webservice.

*A* You can over-ride self.update() to alter the webservice ajax call or replace it with your own. (a) if sending additional data that affects only the current widget, store it in a private variable and add it in update().  (b) if the additional data affects all other facets, store it in the structure returned by self.state() and make sure the other widgets/webservices can process it correctly.


*Q* What Javascript OOP convention is this?

*A* It's based on section 5.4, "Functional Inheritance" of Douglas Crockford, "Javascript: The Good Parts."


*Q* Explain the naming conventions.

*A* $foo is a jquery object, e.g. var $foo = $('.foo')
self is the object you're currently defining (as opposed to the one it inherits from, javascript's 'this', or its dom view)


*Q* Why not support the metadata jquery plugin?  Why not automatically turn all elements with a 'facet' class into facet widgets?

*A* Possibly.  It needs some thought.
