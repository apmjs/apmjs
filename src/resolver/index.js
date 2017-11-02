const TreeNode = require('./tree-node.js')

function loadRoot (pkg) {
  var root = new TreeNode(pkg)
  root.isRoot = true
  return root.populateChildren()
}

module.exports = {loadRoot}
