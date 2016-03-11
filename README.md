# Funneler - mash together data from multiple sources asynchronously

[![npm package](https://nodei.co/npm/funneler.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/funnler/)
[![Dependency Status](https://img.shields.io/david/funneler/funneler.svg?style=flat-square)](https://david-dm.org/funneler/funneler)
[![Gitter](https://img.shields.io/badge/gitter-join_chat-blue.svg?style=flat-square)](https://gitter.im/funneler/funneler?utm_source=badge)

## Table of contents

- [Quick start](#quick-start)
- [$map](#map)
- [$reduce](#reduce)
- [$sortData](#sort-data)
- [$sort](#sort)
- [$data](#data)

## Quick start

Here's a quick example of filtering and mashing together users from two data sources and viewing a single page of results:

```js
var Funneler = require('funneler');

var example = new Funneler({
    // custom plugin:
    {
        // non-command ($) indexes are stored as configuration options for plugins:
        results_per_page: 3,
        page: 2,

        // gather unique identifiers from databases, web services, etc.
        $map() {
            for (let i = 1; i < 50; i++) {
                this.emit(i);
            }
        }
    },

    // plugins inherit common behaviors like pagination of the results which 
    // slices your identifiers to one page:
    require('funneler/lib/pagination'),

    // gather a page's worth of data from a database:
    {
        // gather data from one source in batches of 25 documents
        $data: [ 25, function(identifiers) {
            return new Promise((resolve, reject) => {
                User.find({ "userNumber": { $in: identifiers } }).exec()
                .then(result) {
                    result.forEach(item => this.getStorage().extend(item._id, item));
                    resolve();
                });
            });
        } ]
    },

    // and mash/join it together by unique identifier from another data source:
    {
        $data(id) {
            this.getStorage().data(id, 'title', 'Item #' + id);
        }
    }
});

example.exec().then(data => {
    console.log(data);
});
```

Results in:
```js
[
    {
        userNumber: 4,
        firstName: "Steve",
        lastName: "Newman",
        title: "Item #4"
    },
    {
        userNumber: 5,
        firstName: "Sally",
        lastName: "Baker",
        title: "Item #5"
    },
    {
        userNumber: 6,
        firstName: "Al",
        lastName: "Rivers",
        title: "Item #6"
    },
]
```

Note: While the $map command gathers and fetches a complete list of identifiers, the $data command only fetches data for a single page.

## Map

The map command gathers unique identifiers either synchroneously or asynchronously by returning a promise. It does so by calling emit() with the idenfitier. Identifiers should be scalar values like strings or numbers. If your identifier is multiple separate values, you'll need combine them and use a composite key.

Note: Funneler will discard any duplicate values maintaining a unique set.

Also note: The map function will be called bound to the funneler object, so any internal function blocks should be bound to the Funneler instance or you should take advantage of the => shorthand which maintains the reference to "this":

## Reduce

The reduce command optionally filters down your identifiers. Use it as a function to be informed of every emit or in batch mode to process several emits at once (helpful for more efficient $in or IN() queries in databases):

```js
$reduce(id) {
    if (id < 5) {
        this.getStorage().remove(id);
    }
}

// or in bulk:
$reduce: [ 5, function(ids) {
    ids.forEach(id => {
        if (id < 5) {
            this.getStorage().remove(id);
        }
    });
} ]
```

Note: Either version can return a promise for asynchronous reducing.

Also note: In bulk mode, you should return a function as the second argument which will be bound to the main funneler instance. An arrow function shorthand is used internally to maintain the this reference from its parent.

## Sort data

The $sortData command is similar to the $data command and allows you to gather data specific to sorting only. $sortData is called before ($slice)[#slice], so it will be gathered for every $map'd identifier (since you need to sort ALL rows, not just a page worth for display). You should use $data for any data you need that doesn't require sorting.

Sort data can be invoked as either a single function per $map identifier or in bulk mode similiar to $reduce:

```js
$sortData: [ 5, function(ids) {
    return new Promise((resolve, reject) => {
        User.find({ userNumber: { $in: ids }}).exec().then(results => {
            results.forEach(result => {
                this.getStorage().extend(result.userNumber, result);
            });
        });
    });
} ]
```

## Sort

The $sort command sorts your identifiers by the identifier itself or anything you gathered from $sortData.

```js
$sort(a, b) {
    return a.lastName < b.lastName;
}
```

## Slice

The $slice command uses the OFFSET, LIMIT syntax to slice your idenfitiers down after sorting, reducing the identifiers to a smaller size. This is command for things like pagination. 

Note: The pagination plugin handles the slicing for you.

```js
$slice() {
    return this.getStorage().slice(0, 10); // offset, limit: returns a promise
}
```

## Data

Use $data to retrieve data from a source, either synchronously or asynchronously.

```js
$data: [ 25, function(identifiers) {
    return new Promise((resolve, reject) => {
        User.find({ "userNumber": { $in: identifiers } }).exec()
        .then(result) {
            result.forEach(item => this.getStorage().extend(item._id, item));
            resolve();
        });
    });
} ]
```

## Configuration

The funneler instance maintains a dictionary of configuration options. Specify an option using a key not prefixed by a $ (e.g.: a command):

```js
{
    page: 1
}
```

You can get or set configuration options from the funneler class instance:

```js
    $map() {
        this.getConfig('page', 1); // 1 (specify a default option as the second parameter)
        this.setConfig('page', 2);
    }
```
