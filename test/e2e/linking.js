'use strict'
const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('linking', function () {
  this.timeout(5000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('link to global', function () {
    it('should link the first time', function () {
      let tree = {
        'foo/package.json': JSON.stringify({
          name: 'foo',
          version: '1.2.3'
        })
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link --prefix ${ws.dirpath}`)
        .then(result => {
          let msg = `${ws.dirpath}/lib/amd_modules/foo -> ${ws.dirpath}/foo`
          expect(result.stdout).to.include(msg)
          return ws.readJson(`lib/amd_modules/foo/package.json`)
        })
        .then(bar => {
          expect(bar).to.have.property('name', 'foo')
          expect(bar).to.have.property('version', '1.2.3')
        })
      )
    })
    it('should link if already exists', function () {
      let tree = {
        'foo/package.json': JSON.stringify({
          name: 'foo',
          version: '1.2.3'
        }),
        'lib/node_modules/foo/package.json': '{}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link --prefix ${ws.dirpath} --loglevel silly`)
        .then(() => ws.readJson(`lib/amd_modules/foo/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'foo')
          expect(bar).to.have.property('version', '1.2.3')
        })
      )
    })
  })
  describe('unlink from global', function () {
    it('should unlink if not linked', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo" }'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM unlink --prefix ${ws.dirpath}`)
        .then(result => expect(result.stdout).to.contain(`unlink ${ws.dirpath}/lib/amd_modules/foo`))
      )
    })
    it('should unlink if installed already', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo" }',
        'lib/amd_modules/foo/package.json': '{"name": "bar", "version": "1.2.3"}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM unlink --prefix ${ws.dirpath}`)
        .then(() => fs.exists(`${ws.dirpath}/lib/amd_modules/foo`))
        .then(result => expect(result).to.be.false)
      )
    })
    it('should unlink if installed already', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo", "version": "4.5.6" }'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link --prefix ${ws.dirpath}`)
        .then(() => fs.readJson(`${ws.dirpath}/lib/amd_modules/foo/package.json`))
        .then(result => expect(result).to.have.property('version', '4.5.6'))
        .then(() => ws.run(`cd foo && $APM unlink --prefix ${ws.dirpath}`))
        .then(() => fs.exists(`${ws.dirpath}/lib/amd_modules/foo`))
        .then(result => expect(result).to.be.false)
      )
    })
  })
  describe('unlink local package', function () {
    it('should unlink if not linked', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo", "amdPrefix": "haa/hoo" }'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM unlink bar --prefix ${ws.dirpath}`)
        .then(result => expect(result.stdout).to.contain(`unlink ${ws.dirpath}/foo/haa/hoo/bar`))
      )
    })
    it('should unlink if installed already', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo" }',
        'foo/amd_modules/bar/package.json': '{ "name": "bar" }'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM unlink bar --prefix ${ws.dirpath}`)
        .then(() => fs.exists(`${ws.dirpath}/foo/amd_modules/bar`))
        .then(result => expect(result).to.be.false)
      )
    })
    it('should unlink if linked', function () {
      let tree = {
        'foo/package.json': '{ "name": "foo", "version": "4.5.6" }',
        'lib/amd_modules/bar/package.json': '{ "name": "bar" }'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link bar --prefix ${ws.dirpath}`)
        .then(() => fs.exists(`${ws.dirpath}/foo/amd_modules/bar`))
        .then(result => expect(result).to.be.true)
        .then(() => ws.run(`cd foo && $APM unlink bar --prefix ${ws.dirpath}`))
        .then(() => fs.exists(`${ws.dirpath}/foo/amd_modules/bar`))
        .then(result => expect(result).to.be.false)
      )
    })
  })
  describe('link to local', function () {
    it('should link if already installed locally', function () {
      let tree = {
        'foo/package.json': '{"name": "foo"}',
        'foo/amd_modules/bar/package.json': '{"name": "bar", "version": "3.2.1"}',
        'lib/amd_modules/bar/package.json': '{"name": "bar", "version": "1.2.3"}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link bar --prefix ${ws.dirpath}`)
        .then(() => ws.readJson(`foo/amd_modules/bar/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'bar')
          expect(bar).to.have.property('version', '1.2.3')
        })
      )
    })
    it('should link if not installed locally', function () {
      let tree = {
        'foo/package.json': '{"name": "foo"}',
        'lib/amd_modules/bar/package.json': '{"name": "bar", "version": "1.2.3"}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link bar --prefix ${ws.dirpath}`)
        .then(() => ws.readJson(`foo/amd_modules/bar/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'bar')
          expect(bar).to.have.property('version', '1.2.3')
        })
      )
    })
    it('should respect to amdPrefix', function () {
      let tree = {
        'foo/package.json': '{"name": "foo", "amdPrefix": "hoo/haa"}',
        'lib/amd_modules/bar/package.json': '{"name": "bar", "version": "1.2.3"}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link bar --prefix ${ws.dirpath}`)
        .then(() => ws.readJson(`foo/hoo/haa/bar/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'bar')
          expect(bar).to.have.property('version', '1.2.3')
        })
      )
    })
    it('should install and link if not installed globally', function () {
      let tree = {
        'foo/package.json': '{"name": "foo"}'
      }
      return Workspace.create(tree).then(ws => ws
        .run(`cd foo && $APM link bar --prefix ${ws.dirpath}`)
        .then(() => ws.readJson(`foo/amd_modules/bar/package.json`))
        .then(bar => {
          expect(bar).to.have.property('name', 'bar')
          expect(bar).to.have.property('version', '1.1.0')
        })
      )
    })
  })
  describe('install upon linked dependencies', function () {
    let workspace
    let result
    before(() => Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'index',
          amdDependencies: { bar: '1.0.1' }
        }),
        'amd_modules': {
          '.gitignore': 'placeholder '
        },
        'foo/bar': 'BAR'
      })
      .tap(ws => {
        workspace = ws
        let file = path.resolve(ws.dirpath, 'foo')
        let link = path.resolve(ws.dirpath, 'amd_modules/bar')
        return fs.symlink(file, link)
      })
      .then(() => workspace.run('$APM install --loglevel info'))
      .tap(res => (result = res))
    )
    it('should be successful', function () {
      expect(result.stderr).to.contain('npm info ok')
    })
    it('should install according to package.json', function () {
      return workspace.readJson(`amd_modules/bar/package.json`).then(bar => {
        expect(bar).to.have.property('name', 'bar')
        expect(bar).to.have.property('version', '1.0.1')
      })
    })
  })
})
