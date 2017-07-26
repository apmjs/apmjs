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
  parent && this.link(parent)
  this.semver = parent ? parent.dependencies[this.name] : '*'
  this.pickVersion(versions)
  TreeNode.nodes[this.name] = this
}

TreeNode.nodes = {}

TreeNode.create = function (name, parent) {
  assert(parent, 'you should create root manually')
  return npm
    .getPackageInfo(name)
    .then(info => {
      var node = new TreeNode(name, info.versions, parent)
      return node.populateChildren().then(() => node)
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
  var dependencies = _.map(this.dependencies, (semver, name) => name)
  return Promise.each(dependencies, name => TreeNode.create(name, this))
}

TreeNode.prototype.availableVersions = function (versionMap) {
  var versions = versionMap
  return _
    .filter(versions,
      (descriptor, version) => Semver.satisfies(version, this.semver)
    )
    .map(descriptor => new Package(descriptor))
}

TreeNode.prototype.isRoot = function () {
  return !this.parent
}

TreeNode.prototype.pickVersion = function (versionMap) {
  var versions = this.availableVersions(versionMap)
  var msg
  if (_.size(versions) === 0) {
    msg = this.isRoot()
      ? 'empty versions for the root, at least one required'
      : `${this.name}@${this.semver} not available, required by ${this.parent}`
    throw new error.UnmetDependency(msg)
  }
  var latest = versions.pop()

  var node = TreeNode.nodes[this.name]
  if (node) {
    complianceWarning(this, node)
    if (Semver.gt(node.version, latest.version)) {
      latest = node.pkg
    }
    node.setVersion(latest)
  }
  this.setVersion(latest)
}

function complianceWarning (current, former) {
  var greater = Semver.gtr(former.version, current.semver) ? former : current
  var less = current === greater ? former : current
  var msg = `WARN: multi versions of ${greater.name}, ` +
    `upgrade ${less.toString(true)} (in ${less.parent.name}) to match ` +
    `${greater.semver} (as required by ${greater.parent})`
  console.warn(msg)
}

TreeNode.prototype.toString = function (isSemantic) {
  var version = isSemantic ? this.semver : this.version
  return this.name + '@' + version
}

TreeNode.prototype.setVersion = function (pkg) {
  debug('setVersion for', pkg.name, 'to', pkg.version)
  this.pkg = pkg
  this.dependencies = pkg.dependencies || {}
  this.version = pkg.version
}

TreeNode.prototype.link = function (parent) {
  debug('linking', this.name, 'to', parent.name)
  this.parent = parent
  if (parent && parent.children) {
    parent.children.push(this)
  }
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
