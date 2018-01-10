const chai = require('chai')
const registry = require('../stub/registry.js')
const sinon = require('sinon')
const log = require('npmlog')
const expect = chai.expect
const Promise = require('bluebird')
const npm = require('../../src/utils/npm.js')
const _ = require('lodash')
const error = require('../../src/utils/error.js')
const debug = require('debug')('apmjs:test:tree-node')
const TreeNode = require('../../src/resolver/tree-node.js')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))
require('mocha-sinon')

describe('TreeNode', function () {
  this.timeout(1000)

  before(() => Promise
    .all([
      npm.load({'@baidu:registry': registry.url, 'registry': registry.url}),
      Promise.fromCallback(cb => registry.startServer(cb))
    ])
  )
  after(cb => registry.stopServer(cb))

  beforeEach(() => {
    TreeNode.nodes = {}
    TreeNode.pending = {}
    TreeNode.lock = {dependencies: {}}
  })

  describe('new TreeNode()', function () {
    it('should create root without error', function () {
      function gn () { return new TreeNode({name: 'foo'}) }
      expect(gn).to.not.throw()
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
    it('should take specified version over dependencies', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '1.0.1'}})
      return parent.addDependency('bar', '<=1.0.0').then(bar => {
        expect(bar.name).to.equal('bar')
        expect(bar.version).to.equal('1.0.0')
      })
    })
    it('should install latest if not listed in dependencies', function () {
      var parent = new TreeNode({name: 'parent'})
      return parent.addDependency('bar').then(bar => {
        expect(bar.name).to.equal('bar')
        expect(bar.version).to.equal('1.1.0')
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
        .each(['bar', 'bar', 'bar'], id => parent.addDependency(id, '1.x'))
        .then(() => expect(_.size(TreeNode.nodes)).to.equal(2))
    })
    it('should throw when not available', function () {
      var parent = new TreeNode({name: 'parent', dependencies: {'bar': '2.0.0'}})
      return expect(parent.addDependency('bar', '2.0.0'))
        .to.be.rejectedWith(
          error.UnmetDependency,
          /bar@2.0.0 not available, required by parent/
        )
    })
  })
  describe('dependency trees', function () {
    beforeEach(() => {
      sinon.stub(log, 'error')
      sinon.stub(console, 'log')
    })
    afterEach(() => {
      log.error.restore()
      console.log.restore()
    })
    it('should install latest available', function () {
      var root = new TreeNode({
        name: 'root',
        dependencies: { foo: '1.0.0', bar: '*' }
      })
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.bar).to.have.property('version', '1.1.0')
      })
    })
    it('should install latest satisfying', function () {
      var root = new TreeNode({
        name: 'root',
        version: '1.0.0',
        dependencies: { foo: '1.0.0', bar: '1.0.x' }
      })
      return root.populateChildren().then(() => {
        expect(_.size(TreeNode.nodes)).to.equal(3)
        expect(TreeNode.nodes.bar).to.have.property('version', '1.0.1')
      })
    })
    it('should print dependency tree', function () {
      var root = new TreeNode({
        name: 'root',
        version: '1.0.0',
        dependencies: { foo: '1.0.0', bar: '1.0.x' }
      })
      return root.populateChildren().then(() => {
        root.printTree()
        var tree = [
          'root@1.0.0',
          '├── foo@1.0.0',
          '└── bar@1.0.1'
        ].join('\n')
        expect(console.log).to.have.been.calledOnce
        expect(console.log.args[0][0]).to.equal(tree)
      })
    })
    it('should warn to upgrade former packages', function () {
      var root = new TreeNode({
        name: 'root',
        version: '1.0.0',
        dependencies: { bar: '1.1.0', coo: '1.0.x' }
      })
      return root.populateChildren().then(() => {
        var msg = 'version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match 1.1.0 (required by root@1.0.0)'
        expect(log.error).to.have.been.called
        expect(log.error.args[0][0]).to.equal(msg)
      })
    })
    it('should warn to upgrade latter packages', function () {
      var root = new TreeNode({
        version: '0.0.1',
        name: 'root',
        dependencies: { bar: '1.0.x', coo: '1.0.0' }
      })
      return root.populateChildren().then(() => {
        var msg = 'version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match 1.0.x (required by root@0.0.1)'
        expect(log.error).to.have.been.called
        expect(log.error.args[0][0]).to.equal(msg)
      })
    })
  })
})
