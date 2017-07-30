const chai = require('chai')
const path = require('path')
const fs = require('fs-extra')
const expect = chai.expect
const Promise = require('bluebird')
const npm = require('../src/npm.js')
const _ = require('lodash')
const error = require('../src/error.js')
const debug = require('debug')('apmjs:test:tree-node')
const nock = require('nock')
const TreeNode = require('../src/resolver/tree-node.js')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))
require('mocha-sinon')

describe('TreeNode', function () {
  this.timeout(1000)

  before(() => {
    ['foo', 'bar', 'baz', 'baa', 'coo', 'laa', 'hoo', 'haa']
    .reduce((server, id) => {
      var file = path.resolve(__dirname, `stub/${id}.info.json`)
      return server.get(`/${id}`).reply(200, fs.readFileSync(file))
    }, nock('http://apm'))
    return npm.load({registry: 'http://apm'})
  })
  after(() => nock.cleanAll())
  beforeEach(() => {
    TreeNode.nodes = {}
    TreeNode.referenceCounts = {}
  })

  describe('new TreeNode()', function () {
    it('should create child without error', function () {
      var versions = {'1.0.0': {name: 'foo'}}
      var parent = new TreeNode({name: 'mine', dependencies: {'foo': '1.0.x'}})
      function fn () { return new TreeNode('foo', versions, parent) }
      expect(fn).to.not.throw()
    })
    it('should create root without error', function () {
      var versions = {'1.0.0': {name: 'foo'}}
      function gn () { return new TreeNode('foo', versions) }
      expect(gn).to.not.throw()
    })
  })
  describe('#latestPackage()', function () {
    it('should throw EUNMET if no version available', function () {
      var parent = new TreeNode({name: 'mine'})
      function gn () {
        return parent.latestPackage({name: 'foo'}, '1.0.x')
      }
      expect(gn).to.throw('foo@1.0.x not available, required by mine')
    })
  })
  describe('#addDependency()', function () {
    it('should retrieve info and create a TreeNode', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'foo': '1.0.x'}})
      return parent.addDependency('foo').then(foo => {
        expect(_.size(TreeNode.nodes)).to.equal(2)
        expect(foo.name).to.equal('foo')
        expect(foo.version).to.equal('1.0.0')
      })
    })
    it('should append the TreeNode as child', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'foo': '1.0.x'}})
      return parent.addDependency('foo').then(() => {
        var parent = TreeNode.nodes.parent
        expect(parent.children.foo).to.have.property('name', 'foo')
      })
    })
    it('should respect to dependencies field', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.0.0'}})
      return parent.addDependency('bar').then(bar => {
        expect(bar.name).to.equal('bar')
        expect(bar.version).to.equal('1.0.0')
      })
    })
    it('should respect to the version argument over dependencies declaration', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.0.0'}})
      return parent.addDependency('bar', '>=1.0.1').then(bar => {
        expect(bar.name).to.equal('bar')
        expect(bar.version).to.equal('1.0.1')
      })
    })
    it('should install latest if not listed in the dependencies field', function () {
      var parent = new TreeNode({name: 'parent'})
      return parent.addDependency('bar').then(bar => {
        expect(bar.name).to.equal('bar')
        expect(bar.version).to.equal('1.0.1')
      })
    })
    it('should populate dependencies field if not listed', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {}})
      return parent.addDependency('bar').then(() => {
        expect(parent.dependencies).to.have.property('bar', '1.0.x')
      })
    })
    it('should resave dependency', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.0.0'}})
      return parent.addDependency('bar', '1.0.x').then(() => {
        expect(parent.dependencies).to.deep.equal({ 'bar': '1.0.x' })
      })
    })
    it("should update internal package's dependency", function () {
      var pkg = {name: 'parent', dependencies: {'bar': '1.0.0'}}
      var parent = new TreeNode(pkg)
      return parent.addDependency('bar', '1.0.x').then(() => {
        console.log(pkg)
        expect(pkg.dependencies).to.deep.equal({ 'bar': '1.0.x' })
      })
    })
    it('should not throw when creating the same', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.x'}})
      return parent.addDependency('bar').then(() => {
        expect(parent.addDependency('bar')).to.be.fulfilled
      })
    })
    it('should not create new if already exist', function () {
      expect(_.size(TreeNode.nodes)).to.equal(0)
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.x'}})
      expect(_.size(TreeNode.nodes)).to.equal(1)
      return Promise
        .each(['bar', 'bar'], id => parent.addDependency(id))
        .then(() => expect(_.size(TreeNode.nodes)).to.equal(2))
    })
    it('should throw when not available', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '2.0.0'}})
      return expect(parent.addDependency('bar'))
        .to.be.rejectedWith(
          error.UnmetDependency,
          /bar@2.0.0 not available, required by parent/
        )
    })
    it('should install newer when not compliant 1', function () {
      return Promise.each([
        new TreeNode({name: 'parent2', dependencies: {'bar': '>=1.0.1'}}),
        new TreeNode({name: 'parent1', dependencies: {'bar': '1.0.0'}})
      ], parent => parent.addDependency('bar'))
      .then(() => {
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
      })
    })
    it('should install newer when not compliant 2', function () {
      return Promise.each([
        new TreeNode({name: 'parent1', dependencies: {'bar': '1.0.0'}}),
        new TreeNode({name: 'parent2', dependencies: {'bar': '>=1.0.1'}})
      ], parent => parent.addDependency('bar'))
      .then(() => {
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
      })
    })
    it('should remove isolated node', function () {
      var root = new TreeNode({
        version: '0.0.1',
        name: 'root',
        dependencies: { haa: '1.0.0' }
      })
      return root.populateChildren()
      .then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(4)
        return root.addDependency('hoo')
      })
      .then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(4)
      })
    })
  })
  describe('dependency trees', function () {
    beforeEach(function () {
      this.sinon.stub(console, 'warn')
    })
    afterEach(function () {
      console.warn.restore()
    })
    it('should install latest available', function () {
      var root = new TreeNode({
        name: 'root',
        dependencies: { foo: '1.0.0', baz: '1.x' }
      })
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.baz).to.have.property('version', '1.1.0')
      })
    })
    it('should install latest compatible', function () {
      var root = new TreeNode({
        name: 'root',
        version: '1.0.0',
        dependencies: { foo: '1.0.0', baz: '1.0.x' }
      })
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.baz).to.have.property('version', '1.0.1')
      })
    })
    it('should warn to upgrade former packages', function () {
      var root = new TreeNode({
        name: 'root',
        version: '1.0.0',
        dependencies: { bar: '1.0.0', coo: '1.0.x' }
      })
      return root.populateChildren().then(() => {
        var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in root@1.0.0) to match 1.0.1 (as required by coo@1.0.1)'
        expect(console.warn).to.have.been.called
        expect(console.warn.args[0][0]).to.equal(msg)
      })
    })
    it('should warn to upgrade latter packages', function () {
      var root = new TreeNode({
        version: '0.0.1',
        name: 'root',
        dependencies: { bar: '1.0.x', laa: '1.0.0' }
      })
      return root.populateChildren().then(() => {
        var msg = 'WARN: multi versions of bar, upgrade bar@1.0.0 (in laa@1.0.0) to match 1.0.x (as required by root@0.0.1)'
        expect(console.warn).to.have.been.called
        expect(console.warn.args[0][0]).to.equal(msg)
      })
    })
  })
})
