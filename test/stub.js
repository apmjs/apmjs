var foo = {
  'package.json': '{"name": "foo", "version": "1.2"}',
  'index.js': 'foo-content'
}
var bar = {
  'package.json': '{"index": "./a.js", "name": "bar", "version": "1.1"}',
  'a.js': 'bar-content'
}
var coo = {
  'package.json': '{"browser": "./a.js", "index": "./b.js", "name": "coo", "version": "1.3"}',
  'a.js': 'coo-content'
}

var doo = {
  'package.json': '{"name": "doo", "version": "1.4"}',
  'index.js': 'doo-content',
  'node_modules': {
    'foo': foo,
    'bar': bar
  }
}

var laa = {
  'package.json': '{"name": "laa", "version": "1.0"}',
  'index.js': 'laa-content',
  'node_modules': {
    'doo': doo
  }
}

module.exports = {foo, bar, coo, doo, laa}
