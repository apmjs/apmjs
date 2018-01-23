# APM

[![npm](https://img.shields.io/npm/v/apmjs.svg)](https://www.npmjs.org/package/apmjs)
[![Build Status](https://travis-ci.org/apmjs/apmjs.svg?branch=master)](https://travis-ci.org/apmjs/apmjs)
[![Coveralls](https://img.shields.io/coveralls/apmjs/apmjs.svg)](https://coveralls.io/github/apmjs/apmjs?branch=master)

APM (AMD Package Manager) is a npm-based package manager for AMD. 

## Installation

If your node version >= 4.7.0, feel free to install.
```
$ [sudo] npm install -g apmjs
```

Make sure you have it
```
$ apmjs -v
```

## Enjoy
e.g. install https://registry.npmjs.org/@searchfe%2Fpromise
```
$ apmjs install @searchfe/promise
```

For more details, see: https://github.com/apmjs/apmjs/wiki.


## Differences with NPM cli

* `apmjs install`: Resolve and flatten ddependencies, see [dependency-resolving][dependency-resolving]
* `apmjs link`: Link to/from `<npm-prefix>/lib/amd_modules`, install as needed
* `apmjs unlink`: Unlink global AMD modules
* `apmjs version`: Prints apmjs version, of course.
* `.js` is not allowed in package name, since `.js` is always appended when require.js fetching scripts.

[dependency-resolving]: https://github.com/apmjs/apmjs/wiki/Dependency-Resolving
