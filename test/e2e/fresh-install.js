const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect

describe('Fresh Install', function () {
  var ws
  this.timeout(2000)

  beforeEach(function () {
    ws = new Workspace()
  })

  afterEach(function () {
    ws.destroy()
  })

  it('install a single package', function () {
    return ws
    .createTree({
      'package.json': JSON.stringify({
        name: 'main',
        dependencies: {
          foo: '^1.0.0'
        }})
    })
    .then(() => ws.run('$APM install').then(function () {
      ws.getInstalled('foo').then(foo => {
        expect(foo).to.have.property('name', 'foo')
        expect(foo).to.have.property('version', '1.0.0')
      })
    }))
  })
})
