var foo = {
  'package.json': '{"name": "foo"}',
  'index.js': 'foo-content'
}
var bar = {
  'package.json': '{"index": "./a.js"}',
  'a.js': 'bar-content'
}
var coo = {
  'package.json': '{"browser": "./a.js", "index": "./b.js"}',
  'a.js': 'coo-content'
}

var doo = {
  'package.json': '{"name": "doo"}',
  'index.js': 'doo-content',
  'node_modules': {
    'foo': foo,
    'bar': bar
  }
}

var laa = {
  'package.json': '{"name": "laa"}',
  'index.js': 'laa-content',
  'node_modules': {
    'doo': doo
  }
}

module.exports = {foo, bar, coo, doo, laa}
