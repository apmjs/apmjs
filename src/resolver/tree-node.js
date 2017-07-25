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
  } else {
    TreeNode.nodes[this.name] = this
  }
}

TreeNode.nodes = {}

TreeNode.seq = Promise.resolve()

TreeNode.create = function (name, parent) {
  assert(parent, 'you should create root manually')
  return npm
    .getPackageInfo(name)
    .then(info => {
      var node = new TreeNode(name, info.versions, parent)
      return node.populateChildren().then(() => node)
    })
    .catch(err => {
      if (err instanceof error.UnmetDependency) {
        return parent.fallback(err)
      }
      throw err
    })
}

TreeNode.checkCompliance = function (target) {
  var node = TreeNode.nodes[target.name]
  if (node && !Semver.satisfies(target.version, target.semver)) {
    throw new error.UnmetDependency(node, target)
  }
}

TreeNode.prototype.populateChildren = function () {
  debug('populating children for', this.name)
  return Promise.all(_.map(
    this.dependencies,
    (dep, name) => TreeNode.create(name, this)
  ))
}

TreeNode.prototype.pickVersion = function (parentName) {
  var node = TreeNode.nodes[this.name]
  if (node) {
    this.versions = {}
    this.versions[node.version] = node.pkg
  }
  debug('pickVersion for', this.name, 'in', _.keys(this.versions))
  debug(this.versions)
  this.versions = _
    .filter(this.versions,
      (descriptor, version) => Semver.satisfies(version, this.semver)
    )
    .map(descriptor => new Package(descriptor))

  debug('available versions', this.versions.map(pkg => pkg.version))
  if (_.size(this.versions) === 0) {
    if (parentName === undefined) {
      throw new Error('empty versions for the root, specify at least one version of root')
    }
    var msg = `${this.name}@${this.semver} not available, required by ${parentName}`
    throw new error.UnmetDependency(msg)
  }
  this.setVersion(this.versions.pop())
}

TreeNode.prototype.setVersion = function (pkg) {
  debug('setVersion for', pkg.name, 'to', pkg.version)
  this.pkg = pkg
  this.dependencies = pkg.dependencies || {}
  this.version = pkg.version
}

TreeNode.prototype.tryAppendChild = function (name, parent) {
  return TreeNode.create(name, parent)
    .then(node => TreeNode.checkCompliance(node))
    .catch(err => {
      if (err instanceof error.UnmetDependency) {
        return err.target.fallback(err)
      }
      throw err
    })
}

TreeNode.prototype.fallback = function (err) {
  if (!this.versions.length) {
    return this.parent ? this.parent.fallback(err) : Promise.reject(err)
  }
  this.setVersion(this.versions.pop())
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
