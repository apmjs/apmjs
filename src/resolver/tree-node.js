const Promise = require('bluebird')
const Semver = require('semver')
const debug = require('debug')('apmjs:tree-node')
const error = require('../error.js')
const Version = require('./version.js')
const npm = require('../npm.js')
const _ = require('lodash')

function TreeNode (name, versions, parent) {
  this.name = name
  this.children = []
  if (parent) {
    this.link(parent)
  }
  this.semver = this.getSemver(versions)
  this.pickVersion(versions)
  TreeNode.nodes[this.name] = this
}

TreeNode.nodes = {}

TreeNode.packageList = function () {
  return _.map(TreeNode.nodes, node => node.pkg)
}

TreeNode.prototype.getSemver = function (versionMap) {
  if (!this.parent) {
    return '*'
  }
  if (_.has(this.parent.dependencies, this.name)) {
    return this.parent.dependencies[this.name]
  }
  var last = _.chain(versionMap).keys().sort().last().value()
  return last ? Version.abstract(last) : '*'
}

TreeNode.prototype.addDependency = function (name) {
  return npm
    .getPackageInfo(name, this.pkg)
    .then(info => {
      var node = new TreeNode(name, info.versions, this)
      return node.populateChildren().then(() => node)
    })
}

TreeNode.prototype.populateChildren = function () {
  debug('populating children for', this.name)
  var dependencies = _.map(this.dependencies, (semver, name) => name)
  return Promise.each(dependencies, name => this.addDependency(name))
}

TreeNode.prototype.isRoot = function () {
  return !this.parent
}

TreeNode.prototype.pickVersion = function (versionMap) {
  var maxSatisfiying = Version.maxSatisfyingPackage(versionMap, this.semver)

  if (!maxSatisfiying) {
    var msg = this.isRoot()
      ? 'empty versions for the root, at least one required'
      : `${this.name}@${this.semver} not available, required by ${this.parent}`
    throw new error.UnmetDependency(msg)
  }

  var node = TreeNode.nodes[this.name]
  if (node) {
    if (node.version !== maxSatisfiying.version) {
      Version.upgradeWarning(this, node)
    }
    if (Semver.gt(node.version, maxSatisfiying.version)) {
      maxSatisfiying = node.pkg
    }
    node.setVersion(maxSatisfiying)
  }
  this.setVersion(maxSatisfiying)
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

module.exports = TreeNode
