var fooJson = {'name': 'foo', 'version': '1.2'}
var foo = {
  'package.json': JSON.stringify(fooJson),
  'index.js': 'foo-content'
}

var barJson = {'index': './a.js', 'name': 'bar', 'version': '1.1'}
var bar = {
  'package.json': JSON.stringify(barJson),
  'a.js': 'bar-content'
}

var cooJson = {'browser': './a.js', 'index': './b.js', 'name': 'coo', 'version': '1.3'}
var coo = {
  'package.json': JSON.stringify(cooJson),
  'a.js': 'coo-content'
}

var dooJson = {
  name: 'doo',
  version: '1.4',
  dependencies: {
    foo: '1.2',
    bar: '1.1'
  }
}
var doo = {
  'package.json': JSON.stringify(dooJson),
  'index.js': 'doo-content',
  'amd_modules': {foo, bar}
}

var laaJson = {
  name: 'laa',
  version: '1.0',
  dependencies: {
    doo: '1.4'
  }
}
var laa = {
  'package.json': JSON.stringify(laaJson),
  'index.js': 'laa-content',
  'amd_modules': {doo}
}

module.exports = {
  foo, fooJson, bar, barJson, coo, cooJson, doo, dooJson, laa, laaJson
}
