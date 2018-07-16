## In-database support for Repertoire faceting module

These libraries add scalable faceted indexing to the PostgreSQL database.

Basic approach is similar to other faceted browsers (Solr, Exhibit): an inverted bitmap index
allows fast computation of facet value counts, given a base context and prior facet refinements.
Bitsets can also be used to compute the result set of items.

There are three bindings for the API. The first extends PostgreSQL with a new bitset datatype
written in C (called 'signature'). This version provides scaleable faceting up to 1,000,000 items
and beyond, but requires control over the PostgreSQL server instance to build and load the C
extensions.

The second is implemented using PostgreSQL's built-in VARBIT data type, and scales to a rough
limit of about 30,000 items. It works in exactly the same way as the 'signature' data type above,
but is about a factor of 5-10 slower. However, it does not require administrative control over
the database server to install or use and so is suited to shared host deployment.

The third uses PostgreSQL's built-in BYTEA data type, processed via the Google Javascript
language binding plv8 (https://code.google.com/p/plv8js/wiki/PLV8). Scalability and performance
are unknown, but should be similar to the native C 'signature' type. However, the server needs
to have the PLV8 language extension installed.

Only one binding of the API needs to be loaded at any time.  Each consists of:

  1. Functions for accessing the bitset data types. These are used to store inverted indices from facet values to item ids. Functions are provided for doing refinements and counts on items with a given facet value.
  2. Facilities for adding a packed (continuous) id sequence to the main item table.  Packed ids are used in the facet value indexes.
  3. Utility functions for creating/updating packed ids and facet value index tables, e.g. in a crontab task.

The API bindings can each be built as a PostgreSQL extension, and then loaded and dropped using
CREATE EXTENSION <faceting|faceting_bytea|faceting_varbit> and DROP EXTENSION ...

For hosts without administrative access, the individual sql files can be sourced directly.

Installation (in a Rails app)

```
  $ cd repertoire-faceting
  $ rake db:faceting:extensions:install
```

Installation (PostgreSQL APIs only)

```
  $ cd repertoire-faceting/ext
  $ make; sudo make install
```

N.B. Policy to date is to keep the PostgreSQL API version numbers in sync with the Rubygems
module version numbers.  To bump versions, alter these files:

```
  ext/Makefile                               # the PostgreSQL API version number
  lib/repertoire-faceting/version.rb         # the Rubygems version number
```

Because this policy alters default_version in each postgresql extension control file with each
bump, only the most recent version of the PostgreSQL faceting API is available in any server
(legacy API support is not available.)  To date, database servers have mapped onto applications
one-to-one, so this is not a problem.
