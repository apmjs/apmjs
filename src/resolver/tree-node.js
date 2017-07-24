const Promise = require('bluebird')
const Semver = require('semver')
const Package = require('../package.js')
const debug = require('debug')('apmjs:tree-node')
const error = require('../error.js')
const npm = require('../npm.js')
const assert = require('assert')
const _ = require('lodash')

function TreeNode (name, versions, parent) {
  this.name = name
  this.children = []
  this.semver = parent ? parent.dependencies[this.name] : '*'
  this.versions = versions
  this.pickVersion(parent ? parent.name : undefined)
  if (parent) {
    this.link(parent)
  }
}

TreeNode.nodes = {}

TreeNode.seq = Promise.resolve()

TreeNode.create = function (name, parent) {
  assert(parent, 'you should create root manually')
  return npm
    .getPackageInfo(name)
    .then(info => new TreeNode(name, info.versions, parent))
}

TreeNode.checkCompliance = function (target) {
  var node = TreeNode.nodes[target.name]
  if (node && !Semver.satisfies(target.version, target.semver)) {
    throw new error.UnmetDependency(node, target)
  }
}

TreeNode.prototype.pickVersion = function (parentName) {
  debug('pickVersion for', this.name)

  var node = TreeNode.nodes[this.name]
  if (node) {
    this.versions = {}
    this.versions[node.version] = node.pkg
  }
  this.versions = _
    .filter(this.versions,
      (descriptor, version) => Semver.satisfies(version, this.semver)
    )
    .map(descriptor => new Package(descriptor))

  if (_.size(this.versions) === 0) {
    if (parentName === undefined) {
      throw new Error('empty versions for the root, specify at least one version of root')
    }
    var msg = `${this.name}@${this.semver} not available, required by ${parentName}`
    throw new error.UnmetDependency(msg)
  }
  this.pkg = this.versions.pop()
  this.dependencies = this.pkg.dependencies
  this.version = this.pkg.version
}

TreeNode.prototype.tryAppendChild = function (name, versions, parent) {
  return TreeNode.create(name, versions, parent)
    .then(node => TreeNode.checkCompliance(node))
    .catch(err => {
      if (err.code === 'EUNMET') {
        return err.target.fallback(err)
      }
      throw err
    })
}

TreeNode.prototype.fallback = function (err) {
  if (!this.versions.length) {
    return this.parent ? this.parent.fallback(err) : Promise.reject(err)
  }
  this.version = this.versions.pop()
  this.removeChildren()
}

TreeNode.prototype.remove = function () {
  this.unlink()
  this.destroy()
}

TreeNode.prototype.link = function (parent) {
  debug('linking', this.name, 'to', parent.name)
  TreeNode.nodes[this.name] = this
  this.parent = parent
  if (parent && parent.children) {
    parent.children.push(this)
  }
}

TreeNode.prototype.unlink = function () {
  assert(this.parent, 'parent undefined')
  var idx = this.parent.children.indexOf(this)
  if (idx > -1) {
    this.parent.children.splice(idx, 1)
  }
  this.parent = null
}

TreeNode.prototype.destroy = function () {
  if (TreeNode.nodes[this.name] === this) {
    delete TreeNode.nodes[this.name]
  }
  this.removeChildren()
}

TreeNode.prototype.removeChildren = function () {
  this.children.forEach(child => child.destroy())
  this.children = []
}

module.exports = TreeNode
