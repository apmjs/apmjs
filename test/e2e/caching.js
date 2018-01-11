'use strict'
const chai = require('chai')
const path = require('path')
const fs = require('fs-extra')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('caching', function () {
  this.timeout(5000)
  let ws

  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))
  beforeEach(() => Workspace.create()
    .then(workspace => {
      ws = workspace
      return ws.run('$APM install foo')
    })
    .then(() => fs.remove(path.join(ws.dirpath, 'amd_modules')))
  )

  it('should use cache', function () {
    return ws
    .run('$APM install foo --loglevel verbose')
    .then(result => {
      expect(result.stderr).contain('use cache for foo@1.0.0')
      expect(result.stderr).to.not.contain('http tarball')
    })
    .then(() => ws.readJson(`amd_modules/foo/package.json`))
    .then(foo => expect(foo).to.have.property('name', 'foo'))
  })

  it('should invalidate cache', function () {
    let tgzPath = path.resolve(ws.cache, 'foo/1.0.0/package.tgz')
    return fs.writeFile(tgzPath, 'bad content')
    .then(() => ws.run('$APM install foo --loglevel verbose'))
    .then(result => {
      expect(result.stderr).to.contain('cache integrity failed for foo@1.0.0')
      expect(result.stderr).to.match(/http tarball .*foo-1.0.0.tgz/)
    })
    .then(() => ws.readJson(`amd_modules/foo/package.json`))
    .then(foo => expect(foo).to.have.property('name', 'foo'))
  })
})
