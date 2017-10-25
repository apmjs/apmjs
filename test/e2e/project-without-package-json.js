const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const Registry = require('../stub/registry.js')

describe('fresh project without package.json', function () {
  var port = process.env.REGISTRY_PORT || '8723'
  var ws
  var reg
  this.timeout(2000)

  before(function () {
    ws = new Workspace(port)
    reg = new Registry(port)
    return Promise.all([ws.create(), reg.startServer()])
  })
  after(function () {
    return Promise.all([ws.destroy(), reg.stopServer()])
  })

  it('should install latest by default', function () {
    return ws.createTree({})
    .then(() => ws.run('$APM install bar'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(foo => {
      expect(foo).to.have.property('name', 'bar')
      expect(foo).to.have.property('version', '1.1.0')
    })
  })

  it('should install a latest satisfying version', function () {
    return ws.createTree({})
    .then(() => ws.run('$APM install bar@~1.0.0'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(foo => {
      expect(foo).to.have.property('name', 'bar')
      expect(foo).to.have.property('version', '1.0.1')
    })
  })

  it('should install a specific version', function () {
    return ws.createTree({})
    .then(() => ws.run('$APM install bar@1.0.0'))
    .then(() => ws.readJson(`amd_modules/bar/package.json`))
    .then(foo => {
      expect(foo).to.have.property('name', 'bar')
      expect(foo).to.have.property('version', '1.0.0')
    })
  })
})
